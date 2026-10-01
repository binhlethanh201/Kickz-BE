const Wishlist = require("../models/WishList");

class WishlistController {
  async getAll(req, res) {
    try {
      const wishlists = await Wishlist.find()
        .populate("userId", "firstName lastName email")
        .populate(
          "products",
          "name price img brand size color description category",
        );
      res.status(200).json(wishlists);
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }

  async getByUser(req, res) {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      let wishlist = await Wishlist.findOne({ userId }).populate(
        "products",
        "name price img brand size color description category",
      );
      if (!wishlist) wishlist = { products: [] };

      res.status(200).json({
        message: "Get wishlist successfully",
        count: wishlist.products.length,
        wishlist: wishlist.products,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching wishlist", error: err.message });
    }
  }

  async addToWishlist(req, res) {
    try {
      const userId = req.user.id;
      const { productId } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Missing productId" });
      }

      let wishlist = await Wishlist.findOne({ userId });

      if (!wishlist) {
        wishlist = new Wishlist({ userId, products: [productId] });
      } else {
        if (wishlist.products.includes(productId)) {
          return res
            .status(200)
            .json({ message: "Product already in wishlist", wishlist });
        }
        wishlist.products.push(productId);
      }

      await wishlist.save();

      res.status(201).json({
        message: "Added to wishlist successfully",
        wishlist,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error adding to wishlist", error: err.message });
    }
  }

  async removeFromWishlist(req, res) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;

      const wishlist = await Wishlist.findOne({ userId });
      if (!wishlist || !wishlist.products.includes(productId)) {
        return res
          .status(404)
          .json({ message: "Product not found in wishlist" });
      }

      wishlist.products = wishlist.products.filter(
        (p) => p.toString() !== productId,
      );
      await wishlist.save();

      res
        .status(200)
        .json({ message: "Removed from wishlist successfully", wishlist });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error removing from wishlist", error: err.message });
    }
  }
}

module.exports = new WishlistController();
