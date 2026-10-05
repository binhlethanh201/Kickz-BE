const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishListController");
const verifyToken = require("../middlewares/auth");

router.get("/", wishlistController.getAll);
router.post("/move-to-cart", verifyToken, wishlistController.moveToCart);
router.get("/user/:userId", verifyToken, wishlistController.getByUser);
router.post("/", verifyToken, wishlistController.addToWishlist);
router.delete(
  "/:productId",
  verifyToken,
  wishlistController.removeFromWishlist,
);

module.exports = router;
