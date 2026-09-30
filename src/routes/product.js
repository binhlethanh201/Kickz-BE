const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");

router.get("/search", productController.search);
router.get("/by-price", productController.getByPrice);
router.get("/by-quantity", productController.getByQuantity);
router.get("/by-color-count", productController.getByColorCount);
router.get("/", productController.getAll);
router.post("/", productController.createProduct);
router.get("/:id", productController.getById);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
