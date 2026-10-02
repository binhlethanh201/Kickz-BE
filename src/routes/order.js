const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const verifyToken = require("../middlewares/auth");

router.post("/payos/webhook", orderController.payosWebhook);

router.get("/", verifyToken, orderController.getAll);
router.post("/", verifyToken, orderController.createOrder);

router.get("/detail/:orderId", verifyToken, orderController.getOrderDetail);
router.put("/:orderId/cancel", verifyToken, orderController.cancelOrder);
router.put("/:orderId/status", verifyToken, orderController.updateStatus);
router.delete("/:orderId", verifyToken, orderController.deleteOrder);

router.get("/:userId", verifyToken, orderController.getByUser);

module.exports = router;
