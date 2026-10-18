const Refund = require("../models/Refund");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Card = require("../models/Card");
const ELIGIBLE_STATUSES = ["paid", "processing", "shipped", "completed"];
const TERMINAL_STATUSES = ["rejected", "refunded", "cancelled"];
const REFUND_REASONS = Refund.REFUND_REASONS;
const REFUND_METHODS = Refund.REFUND_METHODS;
const REQUIRE_RETURN = Refund.REQUIRE_RETURN;
function isValidTrackingCode(code) {
  if (!code) return false;
  return /^[a-zA-Z0-9\-]{3,50}$/.test(code);
}
function pushHistory(refund, action, by, note) {
  refund.history.push({ action, by: by || null, note: note || null });
}

class RefundController {
  async createRequest(req, res) {
    try {
      const { orderId } = req.params;
      const { reason, description } = req.body;
      const userId = req.user.id;
      if (!reason || !REFUND_REASONS.includes(reason)) {
        return res.status(400).json({
          message: `Lý do không hợp lệ. Hợp lệ: ${REFUND_REASONS.join(", ")}`,
        });
      }
      if (description && description.length > 500) {
        return res.status(400).json({
          message: "Mô tả không vượt quá 500 ký tự",
        });
      }
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.status(404).json({
          message: "Không tìm thấy đơn hàng",
        });
      }
      if (!ELIGIBLE_STATUSES.includes(order.status)) {
        return res.status(400).json({
          message: `Đơn hàng trạng thái "${order.status}" không thể hoàn tiền. Chỉ có thể hoàn: ${ELIGIBLE_STATUSES.join(", ")}`,
        });
      }
      const existing = await Refund.findOne({
        orderId,
        status: { $nin: TERMINAL_STATUSES },
      });
      if (existing) {
        return res.status(400).json({
          message: "Đơn hàng đã có yêu cầu hoàn tiền đang xử lý",
          refundId: existing._id,
        });
      }
      const approvalDeadline = new Date();
      approvalDeadline.setDate(approvalDeadline.getDate() + 3);

      const refund = new Refund({
        orderId,
        userId,
        reason,
        description: description || null,
        refundAmount: order.totalPrice,
        approvalDeadlineAt: approvalDeadline,
      });

      pushHistory(refund, "requested", userId, description || null);
      await refund.save();
      await refund.populate("orderId", "orderCode totalPrice status");

      res.status(201).json({
        message: "Đã gửi yêu cầu hoàn tiền. Admin sẽ xem xét trong 3 ngày.",
        approvalDeadline: approvalDeadline.toLocaleDateString("vi-VN"),
        refund,
      });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({ message: "ID đơn hàng không hợp lệ" });
      }
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Create refund error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async getMyRequests(req, res) {
    try {
      const refunds = await Refund.find({ userId: req.user.id })
        .populate("orderId", "orderCode totalPrice status createdAt")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Lấy danh sách yêu cầu hoàn tiền thành công",
        count: refunds.length,
        refunds,
      });
    } catch (err) {
      console.error("Get my refunds error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async getMyRequestDetail(req, res) {
    try {
      const refund = await Refund.findOne({
        _id: req.params.refundId,
        userId: req.user.id,
      }).populate("orderId", "orderCode totalPrice status paymentMethod items");

      if (!refund) {
        return res.status(404).json({
          message: "Không tìm thấy yêu cầu hoàn tiền",
        });
      }

      res.status(200).json({
        message: "Lấy chi tiết thành công",
        refund,
      });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({ message: "ID không hợp lệ" });
      }
      console.error("Get refund detail error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async submitReturnShipping(req, res) {
    try {
      const { returnTrackingCode, returnCarrier } = req.body;
      if (!isValidTrackingCode(returnTrackingCode)) {
        return res.status(400).json({
          message:
            "Mã vận đơn phải từ 3-50 ký tự, chỉ chứa chữ, số và dấu gạch (-)",
        });
      }

      const refund = await Refund.findOne({
        _id: req.params.refundId,
        userId: req.user.id,
        status: "approved",
      });

      if (!refund) {
        return res.status(404).json({
          message: "Yêu cầu không ở trạng thái đã duyệt để gửi hàng trả về",
        });
      }

      refund.status = "shipped_back";
      refund.returnTrackingCode = returnTrackingCode;
      refund.returnCarrier = returnCarrier || null;
      pushHistory(refund, "shipped_back", req.user.id, returnTrackingCode);
      await refund.save();

      res.status(200).json({
        message: "Đã cập nhật thông tin gửi hàng trả về",
        trackingCode: returnTrackingCode,
        refund,
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Submit return shipping error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async cancelRequest(req, res) {
    try {
      const refund = await Refund.findOne({
        _id: req.params.refundId,
        userId: req.user.id,
        status: { $in: ["requested", "approved"] },
      });

      if (!refund) {
        return res.status(404).json({
          message:
            "Không thể hủy yêu cầu ở trạng thái hiện tại. Chỉ có thể hủy khi chờ duyệt hoặc đã duyệt.",
        });
      }

      refund.status = "cancelled";
      pushHistory(refund, "cancelled", req.user.id, null);
      await refund.save();

      res.status(200).json({
        message: "Đã hủy yêu cầu hoàn tiền",
        refund,
      });
    } catch (err) {
      console.error("Cancel refund error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async adminList(req, res) {
    try {
      const filter = {};
      if (req.query.status) {
        if (!REFUND_STATUSES.includes(req.query.status)) {
          return res.status(400).json({
            message: `Trạng thái không hợp lệ: ${req.query.status}`,
          });
        }
        filter.status = req.query.status;
      }

      const refunds = await Refund.find(filter)
        .populate("userId", "firstName lastName email phone")
        .populate("orderId", "orderCode totalPrice status paymentMethod")
        .populate("handledBy", "firstName lastName email")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Lấy danh sách hoàn tiền thành công",
        count: refunds.length,
        refunds,
      });
    } catch (err) {
      console.error("Admin list refunds error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async adminDetail(req, res) {
    try {
      const refund = await Refund.findById(req.params.refundId)
        .populate("userId", "firstName lastName email phone address")
        .populate({
          path: "orderId",
          populate: { path: "items.productId", select: "name price img" },
        })
        .populate("handledBy", "firstName lastName email");

      if (!refund) {
        return res.status(404).json({
          message: "Không tìm thấy yêu cầu hoàn tiền",
        });
      }

      res.status(200).json({
        message: "Lấy chi tiết thành công",
        refund,
      });
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({ message: "ID không hợp lệ" });
      }
      console.error("Admin detail refund error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async approve(req, res) {
    try {
      const { adminNote } = req.body;

      const refund = await Refund.findOne({
        _id: req.params.refundId,
        status: "requested",
      });

      if (!refund) {
        return res.status(404).json({
          message: "Yêu cầu không ở trạng thái chờ duyệt",
        });
      }

      refund.status = "approved";
      refund.handledBy = req.user.id;
      if (adminNote) refund.adminNote = adminNote;
      pushHistory(refund, "approved", req.user.id, adminNote || null);
      await refund.save();

      res.status(200).json({
        message:
          "Đã duyệt. Admin xác nhận đủ điều kiện rồi tiến hành hoàn tiền.",
        refund,
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Approve refund error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async reject(req, res) {
    try {
      const { adminNote } = req.body;
      if (!adminNote || adminNote.trim().length === 0) {
        return res.status(400).json({
          message: "Cần ghi lý do từ chối để lưu hồ sơ",
        });
      }

      if (adminNote.length > 500) {
        return res.status(400).json({
          message: "Lý do không vượt quá 500 ký tự",
        });
      }

      const refund = await Refund.findOne({
        _id: req.params.refundId,
        status: "requested",
      });

      if (!refund) {
        return res.status(404).json({
          message: "Yêu cầu không ở trạng thái chờ duyệt",
        });
      }

      refund.status = "rejected";
      refund.adminNote = adminNote;
      refund.handledBy = req.user.id;
      pushHistory(refund, "rejected", req.user.id, adminNote);
      await refund.save();

      res.status(200).json({
        message: "Đã từ chối yêu cầu hoàn tiền",
        refund,
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Reject refund error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async markReceived(req, res) {
    try {
      const { adminNote } = req.body;

      const refund = await Refund.findOne({
        _id: req.params.refundId,
        status: { $in: ["approved", "shipped_back"] },
      });

      if (!refund) {
        return res.status(404).json({
          message: "Yêu cầu chưa ở trạng thái đã duyệt (approved)",
        });
      }

      refund.status = "received";
      refund.handledBy = req.user.id;
      if (adminNote) refund.adminNote = adminNote;
      pushHistory(refund, "received", req.user.id, adminNote || null);
      await refund.save();

      res.status(200).json({
        message:
          "Đã xác nhận đủ điều kiện hoàn tiền. Tiến hành hoàn tiền cho khách.",
        refund,
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Mark received error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async markRefunded(req, res) {
    try {
      const { refundMethod, refundReference, adminNote } = req.body;
      if (!refundMethod || !REFUND_METHODS.includes(refundMethod)) {
        return res.status(400).json({
          message: `Phương thức không hợp lệ. Hợp lệ: ${REFUND_METHODS.join(", ")}`,
        });
      }
      if (refundMethod === "bank_transfer" && !refundReference) {
        return res.status(400).json({
          message:
            "Chuyển khoản ngân hàng cần mã tham chiếu (STK, mã check, mã transaction...)",
        });
      }

      if (refundReference && refundReference.length > 100) {
        return res.status(400).json({
          message: "Mã tham chiếu không vượt quá 100 ký tự",
        });
      }

      const refund = await Refund.findOne({
        _id: req.params.refundId,
        status: { $in: ["approved", "shipped_back", "received"] },
      }).populate("orderId");

      if (!refund) {
        return res.status(404).json({
          message:
            "Yêu cầu chưa ở trạng thái có thể hoàn tiền (approved/received)",
        });
      }
      const isPayosOrder = refund.orderId?.paymentMethod === "payos";
      if (isPayosOrder && refundMethod !== "payos_reversal") {
        return res.status(400).json({
          message:
            "Đơn PayOS chỉ hoàn tiền vào số dư (payos_reversal). Vui lòng chọn hoàn tiền PayOS.",
        });
      }
      if (!isPayosOrder && refundMethod === "payos_reversal") {
        return res.status(400).json({
          message:
            "Đơn COD không hoàn vào số dư. Vui lòng chọn chuyển khoản hoặc tiền mặt.",
        });
      }
      const order = refund.orderId;
      if (order?.items?.length > 0) {
        const stockUpdates = order.items.map((item) => ({
          updateOne: {
            filter: { _id: item.productId },
            update: { $inc: { quantity: item.quantity } },
          },
        }));
        await Product.bulkWrite(stockUpdates);
      }
      refund.status = "refunded";
      refund.refundMethod = refundMethod;
      refund.refundReference = refundReference || null;
      if (adminNote) refund.adminNote = adminNote;
      refund.refundedAt = new Date();
      refund.handledBy = req.user.id;
      pushHistory(
        refund,
        "refunded",
        req.user.id,
        `${refundMethod}${refundReference ? ` - ${refundReference}` : ""}`,
      );
      await refund.save();
      let cardBalance = null;
      if (isPayosOrder) {
        const card = await Card.findOneAndUpdate(
          { userId: refund.userId },
          { $inc: { balance: refund.refundAmount } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        cardBalance = card.balance;
      }
      if (order) {
        order.status = "cancelled";
        await order.save();
      }

      res.status(200).json({
        message: isPayosOrder
          ? "Đã hoàn tiền vào số dư của khách và cập nhật kho"
          : "Đã hoàn tiền thành công và cập nhật kho",
        cardBalance,
        refund,
      });
    } catch (err) {
      if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Mark refunded error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }
}

module.exports = new RefundController();
