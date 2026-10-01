const Cart = require("../models/Cart");
class CartController {
  async getAll(req, res, next) {
    try {
      const carts = await Cart.find();
      res.status(200).json(carts);
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }

  async getByUserId(req, res) {
    try {
      const { userId } = req.params;
      if (req.user.id !== userId) {
        return res
          .status(403)
          .json({ message: "Unauthorized access to this cart" });
      }

      const cart = await Cart.findOne({ userId }).populate(
        "items.productId",
        "name price img brand",
      );

      if (!cart) {
        return res
          .status(404)
          .json({ message: "Cart not found for this user" });
      }

      res.status(200).json({
        message: "Get user cart successfully",
        cart,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async addToCart(req, res) {
    try {
      const userId = req.user.id;
      const { productId, quantity, size, color } = req.body;

      if (!productId || !quantity) {
        return res
          .status(400)
          .json({ message: "Missing productId or quantity" });
      }

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

      await cart.save();
      res
        .status(200)
        .json({ message: "Item added/updated successfully", cart });
    } catch (error) {
      console.error("Add to cart error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async updateCartItem(req, res) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;
      const { quantity, size, color } = req.body;

      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId.toString() === productId &&
          item.size === size &&
          item.color === color,
      );

      if (itemIndex === -1) {
        return res.status(404).json({ message: "Item not found in cart" });
      }

      if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }

      await cart.save();
      res.status(200).json({ message: "Cart updated successfully", cart });
    } catch (error) {
      console.error("Update cart error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async deleteCartItem(req, res) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;
      let { size, color } = req.body;
      if (size !== undefined) size = Number(size);
      if (color !== undefined) color = String(color);

      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });

      const initialLength = cart.items.length;
      cart.items = cart.items.filter(
        (item) =>
          !(
            item.productId.toString() === productId &&
            item.size === size &&
            item.color === color
          ),
      );

      if (cart.items.length === initialLength) {
        return res.status(404).json({ message: "Item not found in cart" });
      }

      await cart.save();
      res.status(200).json({ message: "Item deleted successfully", cart });
    } catch (error) {
      console.error("Delete cart item error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
}
module.exports = new CartController();
