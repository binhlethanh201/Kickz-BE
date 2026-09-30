const Brand = require("../models/Brand");

class BrandController {
  async getBrands(req, res, next) {
    try {
      const brands = await Brand.find();
      res.status(200).json(brands);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching brands", error: err.message });
    }
  }

  async createBrand(req, res, next) {
    try {
      const newBrand = new Brand(req.body);
      const savedBrand = await newBrand.save();
      res.status(201).json(savedBrand);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating brand", error: err.message });
    }
  }

  async updateBrand(req, res, next) {
    try {
      const { id } = req.params;
      const updatedBrand = await Brand.findByIdAndUpdate(
        id,
        { $set: req.body },
        { new: true },
      );

      if (!updatedBrand) {
        return res.status(404).json({ message: "Brand not found" });
      }

      res.status(200).json(updatedBrand);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating brand", error: err.message });
    }
  }

  async deleteBrand(req, res, next) {
    try {
      const { id } = req.params;
      const deletedBrand = await Brand.findByIdAndDelete(id);

      if (!deletedBrand) {
        return res.status(404).json({ message: "Brand not found" });
      }

      res.status(200).json({ message: "Brand has been deleted successfully" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting brand", error: err.message });
    }
  }
}

module.exports = new BrandController();
