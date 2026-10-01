const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const verifyToken = require("../middlewares/auth");

router.get("/", cartController.getAll);
router.get("/user/:userId", verifyToken, cartController.getByUserId);
router.post("/", verifyToken, cartController.addToCart);
router.put("/:productId", verifyToken, cartController.updateCartItem);
router.delete("/:productId", verifyToken, cartController.deleteCartItem);

module.exports = router;
