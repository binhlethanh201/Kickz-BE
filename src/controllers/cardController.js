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

      const card = await Card.findOne({ userId: req.user.id });
      if (!card || card.balance < amount) {
        return res.status(400).json({
          message: `Số dư không đủ (hiện có: ${card?.balance || 0}đ)`,
        });
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

      const withdrawal = new Withdrawal({
        userId: req.user.id,
        amount,
        bankName,
        accountName,
        accountNumber,
      });
      await withdrawal.save();

      res.status(201).json({
        message: "Yêu cầu rút tiền đã gửi. Vui lòng chờ admin duyệt.",
        withdrawalId: withdrawal._id,
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
      const withdrawal = await Withdrawal.findOne({
        _id: req.params.withdrawalId,
        status: "pending",
      });

      if (!withdrawal) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      withdrawal.status = "rejected";
      withdrawal.adminNote = req.body.reason || "";
      withdrawal.rejectedAt = new Date();
      await withdrawal.save();

      res.json({
        message: "Đã từ chối yêu cầu rút tiền",
        data: withdrawal,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  async completeWithdrawal(req, res) {
    try {
      const withdrawal = await Withdrawal.findOne({
        _id: req.params.withdrawalId,
        status: "approved",
      });

      if (!withdrawal) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu" });
      }

      const card = await Card.findOne({ userId: withdrawal.userId });
      if (!card || card.balance < withdrawal.amount) {
        return res.status(400).json({ message: "Số dư không đủ" });
      }

      card.balance -= withdrawal.amount;
      await card.save();

      withdrawal.status = "completed";
      withdrawal.completedAt = new Date();
      await withdrawal.save();

      res.json({
        message: "Đã hoàn tất rút tiền",
        data: withdrawal,
        cardBalance: card.balance,
      });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }
}

module.exports = new CardController();
