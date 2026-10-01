const mongoose = require("mongoose");
const schema = mongoose.Schema;

const CartItemSchema = new schema(
  {
    productId: { type: schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: Number },
    color: { type: String },
  },
  { _id: false },
);

const CartSchema = new schema(
  {
    userId: { type: schema.Types.ObjectId, ref: "User", required: true },
    items: [CartItemSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Cart", CartSchema, "carts");
