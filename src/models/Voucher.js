const mongoose = require("mongoose");
const schema = mongoose.Schema;

const VoucherSchema = new schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String },
    discountType: { type: String, enum: ["percent", "amount"], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: {
      type: Number,
      default: null,
      description: "Max total uses allowed for this voucher",
    },
    usedCount: {
      type: Number,
      default: 0,
      description: "Current number of times voucher has been used",
    },
    maxPerUser: {
      type: Number,
      default: null,
      description: "Max times same user can use this voucher",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Voucher", VoucherSchema, "vouchers");
