const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Voucher = require("../models/Voucher");
const Product = require("../models/Product");
const Refund = require("../models/Refund");
const Card = require("../models/Card");
const mongoose = require("mongoose");

const { PayOS } = require("@payos/node");

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

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

      if (order.paymentMethod === "payos" && order.status === "pending") {
        try {
          const paymentInfo = await payos.paymentRequests.get(order.orderCode);
          if (paymentInfo && paymentInfo.status === "PAID") {
            order.status = "paid";
            order.paidAt = order.paidAt || new Date();
            await order.save();
          }
        } catch (payosErr) {
          console.error("PayOS Sync Error:", payosErr.message);
        }
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
    try {
      const userId = req.user.id;
      const {
        selectedItems,
        shippingMethod,
        address,
        paymentMethod,
        voucherCode,
        isUseWallet,
      } = req.body;

      if (!selectedItems || selectedItems.length === 0) {
        throw new Error("No items selected for checkout");
      }

      const cart = await Cart.findOne({ userId }).populate("items.productId");
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

        const product = await Product.findById(found.productId._id);
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

      const shippingFee = shippingMethod === "express" ? 20000 : 0;
      const totalBeforeDiscount = totalPrice + shippingFee;

      let discount = 0;
      let appliedVoucherCode = null;

      if (voucherCode && voucherCode.trim()) {
        const voucher = await Voucher.findOne({
          code: voucherCode.toUpperCase().trim(),
        });

        if (!voucher) {
          return res.status(400).json({
            message: "Mã voucher không tồn tại",
          });
        }

        if (!voucher.isActive) {
          return res.status(400).json({
            message: "Mã voucher đã bị vô hiệu hóa",
          });
        }

        const now = new Date();
        if (now > voucher.endDate || now < voucher.startDate) {
          return res.status(400).json({
            message: "Mã voucher đã hết hạn",
          });
        }

        if (totalBeforeDiscount < voucher.minOrderValue) {
          return res.status(400).json({
            message: `Đơn hàng phải từ ${voucher.minOrderValue.toLocaleString("vi-VN")} đ để áp dụng voucher này`,
          });
        }

        if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
          return res.status(400).json({
            message: "Mã voucher đã hết lượt sử dụng",
          });
        }

        if (voucher.discountType === "percent") {
          discount = Math.floor(
            (totalBeforeDiscount * voucher.discountValue) / 100,
          );
        } else {
          discount = voucher.discountValue;
        }
        discount = Math.min(discount, totalBeforeDiscount);
        appliedVoucherCode = voucher.code;
      }
      let finalPrice = totalBeforeDiscount - discount;

      let walletUsedAmount = 0;
      let finalPaymentMethod = paymentMethod;
      let orderStatus = "pending";
      let paidAtTime = null;

      if (isUseWallet) {
        const card = await Card.findOne({ userId });
        if (card && card.balance > 0) {
          if (card.balance >= finalPrice) {
            walletUsedAmount = finalPrice;
            card.balance -= finalPrice;
            finalPrice = 0;
            finalPaymentMethod = "wallet";
            orderStatus = "paid";
            paidAtTime = new Date();
          } else {
            walletUsedAmount = card.balance;
            finalPrice -= card.balance;
            card.balance = 0;
          }
          await card.save();
        }
      }

      const payosOrderCode = Number(String(Date.now()).slice(-9));
      const newOrder = new Order({
        userId,
        orderCode: payosOrderCode,
        items: orderItems,
        shippingMethod,
        shippingFee,
        address,
        paymentMethod: finalPaymentMethod,
        voucherCode: appliedVoucherCode,
        discount,
        walletUsed: walletUsedAmount,
        totalPrice: finalPrice,
        status: orderStatus,
        paidAt: paidAtTime,
      });

      await newOrder.save();

      if (appliedVoucherCode) {
        await Voucher.findOneAndUpdate(
          { code: appliedVoucherCode },
          { $inc: { usedCount: 1 } },
        );
      }

      if (stockUpdates.length > 0) {
        await Product.bulkWrite(stockUpdates);
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
      await cart.save();

      let checkoutUrl = null;
      if (finalPaymentMethod === "payos" && finalPrice > 0) {
        const FRONTEND_URL =
          process.env.FRONTEND_URL || "http://localhost:3000";
        const body = {
          orderCode: payosOrderCode,
          amount: Math.round(finalPrice),
          description: `Thanh toan don hang`,
          returnUrl: `${FRONTEND_URL}/order/${newOrder._id}`,
          cancelUrl: `${FRONTEND_URL}/order/${newOrder._id}`,
        };

        const paymentLinkResponse = await payos.paymentRequests.create(body);
        checkoutUrl = paymentLinkResponse.checkoutUrl;
      }

      res.status(201).json({
        message: "Order placed successfully",
        order: newOrder,
        checkoutUrl: checkoutUrl,
      });
    } catch (err) {
      console.error("Create order error:", err);
      res.status(400).json({ message: err.message || "Server error" });
    }
  };

  async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      const order = await Order.findOne({ _id: orderId, userId });

      if (!order) {
        return res
          .status(404)
          .json({ message: "Order not found or unauthorized" });
      }

      if (!["pending", "paid"].includes(order.status)) {
        return res.status(400).json({
          message:
            `Cannot cancel order with status "${order.status}". ` +
            `Only "pending" or "paid" orders can be cancelled.`,
        });
      }

      const stockUpdates = order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { quantity: item.quantity } },
        },
      }));

      if (stockUpdates.length > 0) {
        await Product.bulkWrite(stockUpdates);
      }

      const previousStatus = order.status;
      const wasPaid = previousStatus === "paid" && !!order.paidAt;
      order.status = "cancelled";

      let createdRefund = null;
      if (wasPaid) {
        if (order.paymentMethod === "cod") {
          order.refundRequested = true;
          order.refundRequestedAt = new Date();
          order.refundReason = reason || "User requested cancellation";
        }
        const existingRefund = await Refund.findOne({
          orderId: order._id,
          status: { $nin: ["rejected", "refunded", "cancelled"] },
        });
        if (!existingRefund) {
          const approvalDeadline = new Date();
          approvalDeadline.setDate(approvalDeadline.getDate() + 3);
          createdRefund = new Refund({
            orderId: order._id,
            userId: order.userId,
            reason: "other",
            description: reason || "User cancelled paid order",
            refundAmount: order.totalPrice,
            approvalDeadlineAt: approvalDeadline,
            history: [
              {
                action: "requested",
                by: userId,
                note: reason || "User cancelled paid order",
              },
            ],
          });
          await createdRefund.save();
        } else {
          createdRefund = existingRefund;
        }
      }

      const updatedOrder = await order.save();

      await updatedOrder.populate([
        { path: "items.productId", select: "name price img brand" },
      ]);

      let message = "Order cancelled successfully";
      let refundInfo = null;

      if (!wasPaid) {
        message = "Order cancelled successfully. No refund needed.";
      } else {
        if (order.paymentMethod === "payos") {
          message = "Order cancelled. Refund will be processed in 12-24 hours.";
          refundInfo = {
            type: "payos",
            status: "processing",
            timeline: "12-24 hours",
            refundId: createdRefund?._id || null,
          };
        } else if (order.paymentMethod === "cod") {
          message =
            "Cancellation request sent to admin. " +
            "Refund will be processed within 3-5 business days.";
          refundInfo = {
            type: "cod",
            status: "pending_admin_confirmation",
            timeline: "3-5 business days",
            refundId: createdRefund?._id || null,
          };
        }
      }

      res.status(200).json({
        message,
        refundInfo,
        order: updatedOrder,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Server error cancelling order", error: err.message });
    }
  }

  payosWebhook = async (req, res) => {
    try {
      const webhookData = await payos.webhooks.verify(req.body);
      if (webhookData.code === "00") {
        const order = await Order.findOneAndUpdate(
          { orderCode: webhookData.orderCode },
          {
            status: "paid",
            paidAt: new Date(),
          },
          { new: true },
        );

        if (order) {
          console.log(
            `[PayOS Webhook] Đơn hàng ${order._id} đã thanh toán thành công lúc ${new Date()}`,
          );
        } else {
          console.log(
            `[PayOS Webhook] Không tìm thấy đơn hàng với mã: ${webhookData.orderCode}`,
          );
        }
      }
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("PayOS Webhook Error:", error.message);
      res.status(200).json({ success: false, message: error.message });
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
