const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Voucher = require("../models/Voucher");
const Product = require("../models/Product");
const Card = require("../models/Card");
const mongoose = require("mongoose");
const moment = require("moment");
const qs = require("qs");
const crypto = require("crypto");

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(
      obj[decodeURIComponent(str[key])],
    ).replace(/%20/g, "+");
  }
  return sorted;
}

class OrderController {
  async getAll(req, res) {
    try {
      const orders = await Order.find()
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "name price img brand");
      res.status(200).json(orders);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching orders", error: err.message });
    }
  }

  async getByUser(req, res) {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }
      const orders = await Order.find({ userId })
        .populate("items.productId", "name price img brand")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Get orders successfully",
        count: orders.length,
        orders,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching orders", error: err.message });
    }
  }

  async getOrderDetail(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      const order = await Order.findOne({ _id: orderId, userId: userId })
        .populate("items.productId", "name price img brand")
        .populate("cardId", "cardNumber cardName");
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.status(200).json({ message: "Get order detail successfully", order });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid order ID format" });
      }
      res
        .status(500)
        .json({ message: "Error fetching order detail", error: err.message });
    }
  }

  createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.user.id;
      const {
        selectedItems,
        shippingMethod,
        address,
        paymentMethod,
        voucherCode,
        cardId,
        cvv,
      } = req.body;

      if (!selectedItems || selectedItems.length === 0) {
        throw new Error("No items selected for checkout");
      }

      const cart = await Cart.findOne({ userId })
        .session(session)
        .populate("items.productId");
      if (!cart) throw new Error("Cart not found");

      const orderItems = [];
      let totalPrice = 0;
      const stockUpdates = [];

      for (const item of selectedItems) {
        const found = cart.items.find(
          (ci) =>
            ci.productId._id.toString() === item.productId &&
            ci.size === item.size &&
            ci.color === item.color,
        );

        if (!found)
          throw new Error(`Item ${item.productId} not found in cart.`);
        const product = await Product.findById(found.productId._id).session(
          session,
        );
        if (!product)
          throw new Error(`Product ${found.productId.name} not found.`);
        if (product.quantity < found.quantity) {
          throw new Error(
            `Not enough stock for ${product.name}. Only ${product.quantity} left.`,
          );
        }

        totalPrice += found.productId.price * found.quantity;

        orderItems.push({
          productId: found.productId._id,
          quantity: found.quantity,
          price: found.productId.price,
        });

        stockUpdates.push({
          updateOne: {
            filter: { _id: product._id },
            update: { $inc: { quantity: -found.quantity } },
          },
        });
      }

      let discount = 0;
      if (voucherCode) {
        const voucher = await Voucher.findOne({
          code: voucherCode,
          isActive: true,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        }).session(session);

        if (!voucher) throw new Error("Invalid or expired voucher");
        if (totalPrice < voucher.minOrderValue) {
          throw new Error(
            `Order must be at least $${voucher.minOrderValue} to use voucher`,
          );
        }
        discount =
          voucher.discountType === "percent"
            ? (totalPrice * voucher.discountValue) / 100
            : voucher.discountValue;
        if (discount > totalPrice) discount = totalPrice;
      }

      const shippingFee = shippingMethod === "express" ? 5 : 0;
      const finalPrice = totalPrice - discount + shippingFee;

      let initialStatus = "pending";
      let paymentCardId = undefined;

      if (paymentMethod === "credit_card") {
        if (!cardId) throw new Error("Please select a card for payment.");
        if (!cvv)
          throw new Error("Please enter CVV/Password to confirm payment.");

        const card = await Card.findOne({ _id: cardId, userId }).session(
          session,
        );
        if (!card)
          throw new Error("Card not found or you don't own this card.");
        if (card.cvv !== cvv) throw new Error("Invalid CVV/Password.");

        const currentBalance = card.balance || 0;
        if (currentBalance < finalPrice) {
          throw new Error(
            `Insufficient funds. Current balance is $${currentBalance.toFixed(2)}.`,
          );
        }

        card.balance = currentBalance - finalPrice;
        await card.save({ session });

        initialStatus = "paid";
        paymentCardId = card._id;
      }

      const newOrder = new Order({
        userId,
        items: orderItems,
        shippingMethod,
        shippingFee,
        address,
        paymentMethod,
        cardId: paymentCardId,
        voucherCode,
        discount,
        totalPrice: finalPrice,
        status: initialStatus,
      });

      await newOrder.save({ session });

      if (stockUpdates.length > 0) {
        await Product.bulkWrite(stockUpdates, { session });
      }

      cart.items = cart.items.filter(
        (ci) =>
          !selectedItems.some(
            (si) =>
              si.productId === ci.productId._id.toString() &&
              si.size === ci.size &&
              si.color === ci.color,
          ),
      );
      await cart.save({ session });

      if (paymentMethod === "vnpay") {
        const vnpayUrl = await this.generateVNPURL(
          req,
          newOrder._id.toString(),
          finalPrice,
        );

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
          message: "Redirect to VNPay",
          vnpayUrl: vnpayUrl,
        });
      }

      await session.commitTransaction();
      res.status(201).json({
        message:
          initialStatus === "paid"
            ? "Order placed and paid successfully"
            : "Order placed successfully",
        order: newOrder,
      });
    } catch (err) {
      await session.abortTransaction();
      console.error("Create order error:", err);
      if (
        err.message.includes("Not enough stock") ||
        err.message.includes("Insufficient funds") ||
        err.message.includes("CVV") ||
        err.message.includes("Please select a card") ||
        err.message.includes("voucher")
      ) {
        res.status(400).json({ message: err.message });
      } else {
        res.status(500).json({ message: err.message || "Server error" });
      }
    } finally {
      session.endSession();
    }
  };

  generateVNPURL = async (req, orderId, amount) => {
    let date = new Date();
    let createDate = moment(date).format("YYYYMMDDHHmmss");
    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      "127.0.0.1";

    let tmnCode = process.env.VNP_TMN_CODE;
    let secretKey = process.env.VNP_HASH_SECRET;
    let vnpUrl = process.env.VNP_URL;
    let returnUrl = process.env.VNP_RETURN_URL;

    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = "VND";
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = "Thanh toan don hang: " + orderId;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = Math.round(amount * 25000 * 100);
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;

    vnp_Params = sortObject(vnp_Params);

    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;

    return vnpUrl + "?" + qs.stringify(vnp_Params, { encode: false });
  };

  vnpayReturn = async (req, res) => {
    try {
      let vnp_Params = { ...req.query };
      let secureHash = vnp_Params["vnp_SecureHash"];

      delete vnp_Params["vnp_SecureHash"];
      delete vnp_Params["vnp_SecureHashType"];

      vnp_Params = sortObject(vnp_Params);

      let secretKey = process.env.VNP_HASH_SECRET;
      let signData = qs.stringify(vnp_Params, { encode: false });
      let hmac = crypto.createHmac("sha512", secretKey);
      let signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      if (secureHash === signed) {
        const orderId = vnp_Params["vnp_TxnRef"];
        const responseCode = vnp_Params["vnp_ResponseCode"];

        if (responseCode === "00") {
          await Order.findByIdAndUpdate(orderId, { status: "paid" });

          // Trả về HTML giao diện thành công và tự động gọi Deep Link
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thanh toán thành công</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px 20px; background-color: #f8f9fa; }
                    .icon { color: #28a745; font-size: 80px; margin-bottom: 20px; }
                    h2 { color: #333; margin-bottom: 10px; }
                    p { color: #6c757d; font-size: 16px; margin-bottom: 30px; line-height: 1.5; }
                    .btn { display: inline-block; padding: 15px 30px; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                </style>
            </head>
            <body>
                <div class="icon">✔️</div>
                <h2>Thanh toán thành công!</h2>
                <p>Đơn hàng của bạn đã được ghi nhận.<br>Đang tự động quay trở lại ứng dụng...</p>
                <a href="kickzstore://payment-success" class="btn">Mở lại KickzStore ngay</a>
                
                <script>
                    // Tự động chuyển hướng về App sau 1 giây
                    setTimeout(function() {
                        window.location.href = "kickzstore://payment-success";
                    }, 1000);
                </script>
            </body>
            </html>
          `);
        } else {
          // Xử lý hoàn lại kho khi thất bại
          const order = await Order.findByIdAndUpdate(orderId, {
            status: "cancelled",
          });
          if (order) {
            const stockUpdates = order.items.map((item) => ({
              updateOne: {
                filter: { _id: item.productId },
                update: { $inc: { quantity: item.quantity } },
              },
            }));
            if (stockUpdates.length > 0) {
              await Product.bulkWrite(stockUpdates);
            }
          }

          // Trả về HTML giao diện thất bại
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Thanh toán thất bại</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px 20px; background-color: #f8f9fa; }
                    .icon { color: #dc3545; font-size: 80px; margin-bottom: 20px; }
                    h2 { color: #333; margin-bottom: 10px; }
                    p { color: #6c757d; font-size: 16px; margin-bottom: 30px; }
                    .btn { display: inline-block; padding: 15px 30px; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; border-radius: 5px; font-size: 16px; }
                </style>
            </head>
            <body>
                <div class="icon">❌</div>
                <h2>Thanh toán thất bại</h2>
                <p>Giao dịch đã bị hủy hoặc có lỗi xảy ra.<br>Vui lòng thử lại sau.</p>
                <a href="kickzstore://payment-failed" class="btn">Quay lại ứng dụng</a>
                
                <script>
                    setTimeout(function() {
                        window.location.href = "kickzstore://payment-failed";
                    }, 1000);
                </script>
            </body>
            </html>
          `);
        }
      } else {
        res.status(400).json({ message: "Invalid signature" });
      }
    } catch (err) {
      console.error("VNPay Return Error:", err);
      res.status(500).json({ message: err.message });
    }
  };

  async updateStatus(req, res) {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const order = await Order.findByIdAndUpdate(
        orderId,
        { status },
        { new: true },
      );
      if (!order) return res.status(404).json({ message: "Order not found" });

      res.status(200).json({ message: "Order status updated", order });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating order", error: err.message });
    }
  }

  async cancelOrder(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.findOne({ _id: orderId, userId }).session(
        session,
      );

      if (!order) {
        await session.abortTransaction();
        return res
          .status(404)
          .json({ message: "Order not found or unauthorized" });
      }

      if (!["pending", "paid"].includes(order.status)) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Cannot cancel order with status "${order.status}". Only "pending" or "paid" orders can be cancelled.`,
        });
      }

      if (
        order.status === "paid" &&
        order.paymentMethod === "credit_card" &&
        order.cardId
      ) {
        const card = await Card.findById(order.cardId).session(session);
        if (card) {
          card.balance += order.totalPrice;
          await card.save({ session });
        }
      }

      const stockUpdates = order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { quantity: item.quantity } },
        },
      }));

      if (stockUpdates.length > 0) {
        await Product.bulkWrite(stockUpdates, { session });
      }

      const previousStatus = order.status;
      order.status = "cancelled";
      const updatedOrder = await order.save({ session });

      await session.commitTransaction();
      await updatedOrder.populate([
        { path: "items.productId", select: "name price img brand" },
        { path: "cardId", select: "cardNumber cardName" },
      ]);

      let message = "Order cancelled successfully";
      if (previousStatus === "paid") {
        message = "Order cancelled and refunded successfully";
      }

      res.status(200).json({ message, order: updatedOrder });
    } catch (err) {
      await session.abortTransaction();
      res
        .status(500)
        .json({ message: "Server error cancelling order", error: err.message });
    } finally {
      session.endSession();
    }
  }

  async deleteOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      const deletedOrder = await Order.findOneAndDelete({
        _id: orderId,
        userId: userId,
        status: "cancelled",
      });
      if (!deletedOrder) {
        const order = await Order.findOne({ _id: orderId, userId: userId });
        if (!order) {
          return res
            .status(404)
            .json({ message: "Order not found or you are not authorized" });
        }
        return res.status(400).json({
          message: `Order cannot be deleted. Its status is "${order.status}", not "cancelled".`,
        });
      }
      res.status(200).json({ message: "Order successfully deleted" });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({ message: "Invalid order ID format" });
      }
      res.status(500).json({
        message: "Server error while deleting order",
        error: err.message,
      });
    }
  }
}

module.exports = new OrderController();
