const mongoose = require("mongoose");
const schema = mongoose.Schema;

const REFUND_REASONS = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "late_delivery",
  "changed_mind",
  "other",
];

const REFUND_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "shipped_back",
  "received",
  "refunded",
  "cancelled",
];

const REFUND_METHODS = ["wallet"];

const RefundSchema = new schema(
  {
    orderId: {
      type: schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    userId: {
      type: schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      enum: REFUND_REASONS,
    },
    description: {
      type: String,
      default: null,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: "requested",
      index: true,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvalDeadlineAt: {
      type: Date,
      default: null,
    },
    returnTrackingCode: {
      type: String,
      default: null,
      minlength: 3,
      maxlength: 50,
    },
    returnCarrier: {
      type: String,
      default: null,
      enum: [null, "ghn", "ghtk", "viettelpost", "jne", "other"],
    },

    adminNote: {
      type: String,
      default: null,
      maxlength: 500,
    },
    refundMethod: {
      type: String,
      default: null,
      enum: [null, ...REFUND_METHODS],
    },

    refundReference: {
      type: String,
      default: null,
      maxlength: 100,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    handledBy: {
      type: schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    history: [
      {
        action: {
          type: String,
          enum: [
            "requested",
            "approved",
            "rejected",
            "shipped_back",
            "received",
            "refunded",
            "cancelled",
          ],
          required: true,
        },
        by: {
          type: schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        note: {
          type: String,
          default: null,
          maxlength: 200,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);
RefundSchema.index({ orderId: 1, status: 1 });
RefundSchema.index({ userId: 1, createdAt: -1 });
RefundSchema.index({ status: 1, createdAt: -1 });
RefundSchema.statics.REFUND_REASONS = REFUND_REASONS;
RefundSchema.statics.REFUND_STATUSES = REFUND_STATUSES;
RefundSchema.statics.REFUND_METHODS = REFUND_METHODS;
RefundSchema.statics.REQUIRE_RETURN = [
  "damaged",
  "wrong_item",
  "not_as_described",
];

module.exports = mongoose.model("Refund", RefundSchema, "refunds");
