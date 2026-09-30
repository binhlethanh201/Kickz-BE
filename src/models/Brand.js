const mongoose = require("mongoose");
const schema = mongoose.Schema;

const BrandSchema = new schema(
  {
    name: { type: String, required: true, unique: true },
    logoUrl: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Brand", BrandSchema, "brands");
