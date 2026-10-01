const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const verifyToken = require("../middlewares/auth");
const checkAdmin = require("../middlewares/admin");

router.get("/product/:productId", reviewController.getByProduct);
router.post("/", verifyToken, reviewController.createReview);
router.post("/:reviewId/reply", verifyToken, reviewController.replyReview);
router.patch(
  "/:reviewId/moderate",
  verifyToken,
  checkAdmin,
  reviewController.moderateReview,
);

module.exports = router;
