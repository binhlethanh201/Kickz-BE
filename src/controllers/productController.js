const Product = require("../models/Product");
const Brand = require("../models/Brand");
const Category = require("../models/Category");

class ProductController {
  async getAll(req, res, next) {
    try {
      const { brand, category, featured } = req.query;

      const filter = {};
      if (brand) filter.brand = brand;
      if (category) filter.category = category;
      if (featured) filter.isFeatured = featured === "true";

      const products = await Product.find(filter)
        .populate("brand")
        .populate("category")
        .sort({ createdAt: -1 });

      res.status(200).json(products);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching products", error: err.message });
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const product = await Product.findById(id)
        .populate("brand")
        .populate("category");

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(200).json(product);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching product by ID", error: err.message });
    }
  }

  async search(req, res, next) {
    try {
      const query = req.query.q?.trim();
      if (!query) {
        return res.status(400).json({ message: "Missing search query" });
      }
      const matchedBrands = await Brand.find({
        name: { $regex: query, $options: "i" },
      }).select("_id");
      const matchedCategories = await Category.find({
        name: { $regex: query, $options: "i" },
      }).select("_id");
      const brandIds = matchedBrands.map((b) => b._id);
      const categoryIds = matchedCategories.map((c) => c._id);
      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { brand: { $in: brandIds } },
          { category: { $in: categoryIds } },
        ],
      })
        .populate("brand")
        .populate("category")
        .limit(20);

      if (!products.length) {
        return res.status(404).json({ message: "No products found" });
      }

      res.status(200).json(products);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error searching products", error: err.message });
    }
  }

  async getByPrice(req, res, next) {
    try {
      const products = await Product.find({}).sort({ price: -1 }).limit(10);
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({
        message: "Error fetching products by price",
        error: err.message,
      });
    }
  }

  async getByQuantity(req, res, next) {
    try {
      const products = await Product.find({}).sort({ quantity: -1 }).limit(10);
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({
        message: "Error fetching products by quantity",
        error: err.message,
      });
    }
  }

  async getByColorCount(req, res, next) {
    try {
      const products = await Product.aggregate([
        {
          $addFields: {
            colorCount: { $size: "$color" },
          },
        },
        {
          $sort: { colorCount: -1 },
        },
        {
          $limit: 10,
        },
        {
          $project: {
            colorCount: 0,
          },
        },
      ]);
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({
        message: "Error fetching products by color count",
        error: err.message,
      });
    }
  }

  async createProduct(req, res, next) {
    try {
      const newProduct = new Product(req.body);
      const savedProduct = await newProduct.save();
      res.status(201).json(savedProduct);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating product", error: err.message });
    }
  }

  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true },
      );

      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(200).json(updatedProduct);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating product", error: err.message });
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      const deletedProduct = await Product.findByIdAndDelete(id);

      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      res
        .status(200)
        .json({ message: "Product has been deleted successfully" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting product", error: err.message });
    }
  }
}

module.exports = new ProductController();
