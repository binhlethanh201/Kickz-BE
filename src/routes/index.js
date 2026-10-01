const express = require("express");
const router = express.Router();
const productRouter = require("./product");
const brandRouter = require("./brand");
const categoryRouter = require("./category");
const cartRouter = require("./cart");
const userRouter = require("./user");
const wishListRouter = require("./wishList");
const voucherRouter = require("./voucher");
const reviewRouter = require("./review");
const authRouter = require("./auth");

router.use("/products", productRouter);
router.use("/brands", brandRouter);
router.use("/categories", categoryRouter);
router.use("/carts", cartRouter);
router.use("/users", userRouter);
router.use("/wishlists", wishListRouter);
router.use("/vouchers", voucherRouter);
router.use("/reviews", reviewRouter);
router.use("/auth", authRouter);

module.exports = router;
