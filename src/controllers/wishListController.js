const Wishlist = require("../models/WishList");
const Cart = require("../models/Cart");

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

  async moveToCart(req, res) {
    try {
      const userId = req.user.id;
      // Yêu cầu Frontend phải gửi đủ thông tin size, color, quantity (mặc định là 1)
      const { productId, size, color, quantity = 1 } = req.body;

      if (!productId || !size || !color) {
        return res.status(400).json({
          message:
            "Vui lòng cung cấp đủ productId, size và color để thêm vào giỏ hàng",
        });
      }

      // 1. Kiểm tra xem sản phẩm có trong Wishlist không
      const wishlist = await Wishlist.findOne({ userId });
      if (!wishlist || !wishlist.products.includes(productId)) {
        return res
          .status(404)
          .json({ message: "Sản phẩm không tồn tại trong Wishlist" });
      }

      // 2. Thêm sản phẩm vào Cart (Logic tương tự addToCart)
      let cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }

      const existingItem = cart.items.find(
        (item) =>
          item.productId.toString() === productId &&
          item.size === size &&
          item.color === color,
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity, size, color });
      }

      await cart.save(); // Lưu giỏ hàng

      // 3. Xóa sản phẩm khỏi Wishlist
      wishlist.products = wishlist.products.filter(
        (p) => p.toString() !== productId,
      );

      await wishlist.save(); // Lưu lại wishlist

      res.status(200).json({
        message: "Chuyển sản phẩm vào giỏ hàng thành công",
        cart,
        wishlist: wishlist.products, // Trả về danh sách wishlist mới cho Frontend cập nhật UI
      });
    } catch (err) {
      console.error("Move to cart error:", err);
      res
        .status(500)
        .json({ message: "Lỗi khi chuyển sang giỏ hàng", error: err.message });
    }
  }
}

module.exports = new WishlistController();
