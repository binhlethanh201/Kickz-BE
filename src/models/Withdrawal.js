const mongoose = require("mongoose");
const schema = mongoose.Schema;

const WithdrawalSchema = new schema(
  {
    userId: {
      type: schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "completed", "rejected"],
      default: "pending",
      index: true,
    },

    bankName: String,
    accountName: String,
    accountNumber: String,

    note: String,
    adminNote: String,

    completedAt: Date,
    rejectedAt: Date,
  },
  {
    timestamps: true,
  },
);

WithdrawalSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

module.exports = mongoose.model("Withdrawal", WithdrawalSchema, "withdrawals");
