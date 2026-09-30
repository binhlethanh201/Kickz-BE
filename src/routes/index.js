const express = require("express");
const router = express.Router();
const productRouter = require("./product");
const brandRouter = require("./brand");
const categoryRouter = require("./category");

router.use("/products", productRouter);
router.use("/brands", brandRouter);
router.use("/categories", categoryRouter);

module.exports = router;
