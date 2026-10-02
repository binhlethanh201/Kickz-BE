const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Voucher = require("../models/Voucher");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const PayOS = require("@payos/node");

// Khởi tạo PayOS
const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY,
);

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
      const order = await Order.findOne({
        _id: orderId,
        userId: userId,
      }).populate("items.productId", "name price img brand");

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

      // Sinh mã orderCode (số nguyên) bắt buộc cho PayOS
      const payosOrderCode = Number(String(Date.now()).slice(-9));
      const initialStatus = "pending";

      const newOrder = new Order({
        userId,
        orderCode: payosOrderCode,
        items: orderItems,
        shippingMethod,
        shippingFee,
        address,
        paymentMethod,
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

      let checkoutUrl = null;

      // Xử lý tạo link thanh toán nếu chọn PayOS
      if (paymentMethod === "payos") {
        const body = {
          orderCode: payosOrderCode,
          amount: finalPrice, // Đảm bảo finalPrice tính bằng VNĐ
          description: `Thanh toan don hang`,
          returnUrl: process.env.PAYOS_RETURN_URL,
          cancelUrl: process.env.PAYOS_CANCEL_URL,
        };

        const paymentLinkResponse = await payos.createPaymentLink(body);
        checkoutUrl = paymentLinkResponse.checkoutUrl;
      }

      await session.commitTransaction();
      res.status(201).json({
        message: "Order placed successfully",
        order: newOrder,
        checkoutUrl: checkoutUrl, // Frontend dùng link này để mở trang quét QR
      });
    } catch (err) {
      await session.abortTransaction();
      console.error("Create order error:", err);
      res.status(400).json({ message: err.message || "Server error" });
    } finally {
      session.endSession();
    }
  };

  // API nhận Webhook từ PayOS khi khách thanh toán thành công
  payosWebhook = async (req, res) => {
    try {
      // Xác thực dữ liệu gửi từ PayOS bằng Checksum Key
      const webhookData = payos.verifyPaymentWebhookData(req.body);

      // Nếu trạng thái thành công
      if (
        ["PAYMENT_SUCCESS", "00"].includes(webhookData.code) ||
        webhookData.success === true
      ) {
        await Order.findOneAndUpdate(
          { orderCode: webhookData.orderCode },
          { status: "paid" },
        );
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("PayOS Webhook Error:", error);
      res.status(400).json({ success: false, message: error.message });
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

      // Hoàn trả số lượng vào kho
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
      ]);

      let message = "Order cancelled successfully";
      if (previousStatus === "paid") {
        // Lưu ý: PayOS không tự động hoàn tiền qua API ở bản miễn phí,
        // Admin cần check Dashboard và chuyển khoản hoàn tay, nên ở đây chỉ đổi trạng thái DB.
        message = "Order cancelled. Please contact admin for a refund.";
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
      res
        .status(500)
        .json({
          message: "Server error while deleting order",
          error: err.message,
        });
    }
  }
}

module.exports = new OrderController();
