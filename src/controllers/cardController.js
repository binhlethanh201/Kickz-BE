const Card = require("../models/Card");

class CardController {
  async getMyCard(req, res) {
    try {
      const card = await Card.findOne({ userId: req.user.id });
      res.status(200).json({
        message: "Lấy số dư hoàn tiền thành công",
        balance: card ? card.balance : 0,
        card,
      });
    } catch (err) {
      console.error("Get my card error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }
}

module.exports = new CardController();
