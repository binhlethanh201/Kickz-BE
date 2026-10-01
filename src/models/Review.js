const mongoose = require("mongoose");
const schema = mongoose.Schema;

const ReplySchema = new schema(
  {
    userId: { type: schema.Types.ObjectId, ref: "User", required: true },
    comment: { type: String, required: true },
  },
  { timestamps: true },
);

const ReviewSchema = new schema(
  {
    productId: { type: schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    images: [{ type: String }],
    isHidden: { type: Boolean, default: false },
    replies: [ReplySchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Review", ReviewSchema, "reviews");
