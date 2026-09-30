const Category = require("../models/Category");

class CategoryController {
  async getCategories(req, res, next) {
    try {
      const categories = await Category.find();
      res.status(200).json(categories);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching categories", error: err.message });
    }
  }

  async createCategory(req, res, next) {
    try {
      const newCategory = new Category(req.body);
      const savedCategory = await newCategory.save();
      res.status(201).json(savedCategory);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating category", error: err.message });
    }
  }

  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const updatedCategory = await Category.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true },
      );

      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(200).json(updatedCategory);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating category", error: err.message });
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const deletedCategory = await Category.findByIdAndDelete(id);

      if (!deletedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      res
        .status(200)
        .json({ message: "Category has been deleted successfully" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting category", error: err.message });
    }
  }
}

module.exports = new CategoryController();
