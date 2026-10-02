const mongoose = require("mongoose");
const schema = mongoose.Schema;

const OrderSchema = new schema(
  {
    userId: { type: schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        productId: {
          type: schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    shippingMethod: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },
    shippingFee: { type: Number, default: 0 },
    address: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ["qrcode", "cod"],
      default: "cod",
    },
    cardId: { type: schema.Types.ObjectId, ref: "Card" },
    voucherCode: { type: String },
    discount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", OrderSchema, "orders");
