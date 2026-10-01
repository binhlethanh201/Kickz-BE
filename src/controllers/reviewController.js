const Review = require("../models/Review");

class ReviewController {
  async createReview(req, res) {
    try {
      const { productId, rating, comment, images } = req.body;
      const userId = req.user.id;

      const newReview = new Review({
        productId,
        userId,
        rating,
        comment,
        images,
      });

      await newReview.save();
      res.status(201).json({ message: "Review submitted!", review: newReview });
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }

  async getByProduct(req, res) {
    try {
      const { productId } = req.params;
      const reviews = await Review.find({ productId, isHidden: false })
        .populate("userId", "firstName lastName")
        .populate("replies.userId", "firstName lastName")
        .sort({ createdAt: -1 });

      res.status(200).json(reviews);
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }

  async replyReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      const review = await Review.findById(reviewId);
      if (!review) return res.status(404).json({ message: "Review not found" });

      review.replies.push({ userId, comment });
      await review.save();

      res.status(200).json({ message: "Reply added!", review });
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }

  async moderateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { isHidden } = req.body;

      const review = await Review.findByIdAndUpdate(
        reviewId,
        { isHidden },
        { new: true },
      );

      res.status(200).json({ message: "Status updated", review });
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }
}

module.exports = new ReviewController();
