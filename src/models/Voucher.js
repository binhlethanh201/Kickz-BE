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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Voucher", VoucherSchema, "vouchers");
