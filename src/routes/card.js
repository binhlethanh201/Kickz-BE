const express = require("express");
const router = express.Router();
const cardController = require("../controllers/cardController");
const verifyToken = require("../middlewares/auth");

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Chỉ admin có quyền" });
  }
  next();
};

router.get("/balance", verifyToken, cardController.getMyCard);
router.post("/withdraw", verifyToken, cardController.requestWithdrawal);
router.get("/my-withdrawals", verifyToken, cardController.getMyWithdrawals);
router.get(
  "/admin/list",
  verifyToken,
  adminOnly,
  cardController.getWithdrawals,
);
router.post(
  "/admin/:withdrawalId/approve",
  verifyToken,
  adminOnly,
  cardController.approveWithdrawal,
);
router.post(
  "/admin/:withdrawalId/reject",
  verifyToken,
  adminOnly,
  cardController.rejectWithdrawal,
);
router.post(
  "/admin/:withdrawalId/complete",
  verifyToken,
  adminOnly,
  cardController.completeWithdrawal,
);

module.exports = router;
