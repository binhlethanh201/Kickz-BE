const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const refundController = require("../controllers/refundController");
const verifyToken = require("../middlewares/auth");

router.post("/payos/webhook", orderController.payosWebhook);

router.get("/", verifyToken, orderController.getAll);
router.post("/", verifyToken, orderController.createOrder);

router.get("/detail/:orderId", verifyToken, orderController.getOrderDetail);
router.post("/:orderId/cancel", verifyToken, orderController.cancelOrder);
router.put("/:orderId/status", verifyToken, orderController.updateStatus);
router.delete("/:orderId", verifyToken, orderController.deleteOrder);

router.get("/refunds/mine", verifyToken, refundController.getMyRequests);
router.post(
  "/:orderId/refund-request",
  verifyToken,
  refundController.createRequest,
);
router.get(
  "/refunds/:refundId",
  verifyToken,
  refundController.getMyRequestDetail,
);
router.patch(
  "/refunds/:refundId/ship-back",
  verifyToken,
  refundController.submitReturnShipping,
);
router.patch(
  "/refunds/:refundId/cancel",
  verifyToken,
  refundController.cancelRequest,
);

router.get("/:userId", verifyToken, orderController.getByUser);

module.exports = router;
