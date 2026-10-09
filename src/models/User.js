const mongoose = require("mongoose");
const schema = mongoose.Schema;

const AddressSchema = new schema(
  {
    street: { type: String },
    city: { type: String },
    district: { type: String },
    country: { type: String },
  },
  { _id: false },
);

const UserSchema = new schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["M", "F", "O"], default: "M" },
    phone: { type: String },
    address: { type: AddressSchema },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "admin", "owner", "staff"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema, "users");
