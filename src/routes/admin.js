const express = require("express");
const router = express.Router();
const AdminController = require("../controllers/adminController");
const verifyToken = require("../middlewares/auth");
const checkAdmin = require("../middlewares/admin");
const adminController = require("../controllers/adminController");
const refundController = require("../controllers/refundController");

router.use(verifyToken, checkAdmin);
//Report And Analytics
router.get("/dashboard-stats", AdminController.getDashboardStats);
router.get("/reports/orders", AdminController.getOrderReport);
router.get("/reports/users", AdminController.getUserReport);
router.get("/reports/products", AdminController.getProductReport);
//Users Management
router.get("/users", AdminController.getAllUsers);
router.get("/users/:id", AdminController.getUserById);
router.post("/users", AdminController.createUser);
router.put("/users/:id", AdminController.updateUser);
router.delete("/users/:id", AdminController.deleteUser);
//Orders Management
router.get("/orders", AdminController.getAllOrders);
router.get("/orders/:id", AdminController.getOrderById);
router.put("/orders/:id/status", AdminController.updateOrderStatus);
router.delete("/orders/:id", AdminController.deleteOrder);
router.patch(
  "/orders/:orderId/confirm-payment",
  adminController.confirmCODPayment,
);
//Refunds Management
router.get("/refunds", refundController.adminList);
router.get("/refunds/:refundId", refundController.adminDetail);
router.patch("/refunds/:refundId/approve", refundController.approve);
router.patch("/refunds/:refundId/reject", refundController.reject);
router.patch("/refunds/:refundId/received", refundController.markReceived);
router.patch("/refunds/:refundId/refunded", refundController.markRefunded);
//Products Management
router.get("/products", AdminController.getAllProducts);
router.get("/products/:id", AdminController.getProductById);
router.post("/products", AdminController.createProduct);
router.put("/products/:id", AdminController.updateProduct);
router.delete("/products/:id", AdminController.deleteProduct);

module.exports = router;
