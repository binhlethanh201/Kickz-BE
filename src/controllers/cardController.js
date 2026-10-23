const Card = require("../models/Card");
const Withdrawal = require("../models/Withdrawal");
const Refund = require("../models/Refund");

class CardController {
  async getMyCard(req, res) {
    try {
      let card = await Card.findOne({ userId: req.user.id });
      if (!card) {
        card = await Card.create({ userId: req.user.id, balance: 0 });
      }

      res.json({
        message: "Lấy số dư thành công",
        balance: card.balance,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async requestWithdrawal(req, res) {
    try {
      const { amount, bankName, accountName, accountNumber } = req.body;
      if (!amount || amount < 10000) {
        return res.status(400).json({ message: "Tối thiểu 10.000 VNĐ" });
      }
      if (!bankName || !accountName || !accountNumber) {
        return res
          .status(400)
          .json({ message: "Điền đầy đủ thông tin ngân hàng" });
      }

      const pending = await Withdrawal.findOne({
        userId: req.user.id,
        status: "pending",
      });
      if (pending) {
        return res.status(400).json({
          message:
            "Bạn đang có 1 yêu cầu rút tiền chờ xử lý. Vui lòng đợi hoàn tất.",
        });
      }
      const lastRequest = await Withdrawal.findOne({
        userId: req.user.id,
        status: { $ne: "rejected" },
      }).sort({ createdAt: -1 });
      if (lastRequest) {
        const hoursSinceLastRequest =
          (new Date() - new Date(lastRequest.createdAt)) / (1000 * 60 * 60);
        if (hoursSinceLastRequest < 24) {
          return res.status(400).json({
            message:
              "Để đảm bảo an toàn, bạn chỉ được thực hiện 1 giao dịch rút tiền mỗi 24 giờ.",
          });
        }
      }

      let withdrawal;
      try {
        withdrawal = await Withdrawal.create({
          userId: req.user.id,
          amount,
          bankName,
          accountName,
          accountNumber,
        });
      } catch (e) {
        if (e.code === 11000) {
          return res.status(400).json({
            message:
              "Bạn đang có 1 yêu cầu rút tiền chờ xử lý. Vui lòng đợi hoàn tất.",
          });
        }
        throw e;
      }

      const card = await Card.findOneAndUpdate(
        { userId: req.user.id, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true },
      );
      if (!card) {
        await Withdrawal.deleteOne({ _id: withdrawal._id });
        return res.status(400).json({ message: "Số dư không đủ" });
      }

      res.status(201).json({
        message: "Yêu cầu rút tiền đã gửi. Vui lòng chờ admin duyệt.",
        withdrawalId: withdrawal._id,
        balance: card.balance,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async getMyWithdrawals(req, res) {
    try {
      const withdrawals = await Withdrawal.find({ userId: req.user.id }).sort({
        createdAt: -1,
      });

      res.json({
        message: "Lấy danh sách thành công",
        count: withdrawals.length,
        data: withdrawals,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async getWithdrawals(req, res) {
    try {
      const { status } = req.query;
      const filter = {};

      if (status) {
        filter.status = status;
      }

      const withdrawals = await Withdrawal.find(filter)
        .populate("userId", "firstName lastName email phone")
        .sort({ createdAt: -1 });

      res.json({
        message: "Lấy danh sách thành công",
        count: withdrawals.length,
        data: withdrawals,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async approveWithdrawal(req, res) {
    try {
      const withdrawal = await Withdrawal.findOne({
        _id: req.params.withdrawalId,
        status: "pending",
      });

      if (!withdrawal) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      withdrawal.status = "approved";
      withdrawal.adminNote = req.body.note || "";
      await withdrawal.save();

      res.json({
        message: "Đã duyệt yêu cầu rút tiền",
        data: withdrawal,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async rejectWithdrawal(req, res) {
    try {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: req.params.withdrawalId, status: "pending" },
        {
          $set: {
            status: "rejected",
            adminNote: req.body.reason || "",
            rejectedAt: new Date(),
          },
        },
        { new: true },
      );
      if (!withdrawal) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      const card = await Card.findOneAndUpdate(
        { userId: withdrawal.userId },
        { $inc: { balance: withdrawal.amount } },
        { new: true, upsert: true },
      );

      res.json({
        message: "Đã từ chối yêu cầu rút tiền",
        data: withdrawal,
        cardBalance: card.balance,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async completeWithdrawal(req, res) {
    try {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: req.params.withdrawalId, status: "approved" },
        { $set: { status: "completed", completedAt: new Date() } },
        { new: true },
      );
      if (!withdrawal) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }
      res.json({ message: "Đã hoàn tất rút tiền", data: withdrawal });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }
}

module.exports = new CardController();
