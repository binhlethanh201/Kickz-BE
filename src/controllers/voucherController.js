const Voucher = require("../models/Voucher");

class VoucherController {
  async getAll(req, res) {
    try {
      const vouchers = await Voucher.find().sort({ createdAt: -1 });
      res.status(200).json(vouchers);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching vouchers", error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const voucher = await Voucher.findById(id);
      if (!voucher)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json(voucher);
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error fetching voucher", error: err.message });
    }
  }

  async create(req, res) {
    try {
      const data = req.body;
      const newVoucher = new Voucher(data);
      await newVoucher.save();
      res.status(201).json({ message: "Voucher created", voucher: newVoucher });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error creating voucher", error: err.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await Voucher.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!updated)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json({ message: "Voucher updated", voucher: updated });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error updating voucher", error: err.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Voucher.findByIdAndDelete(id);
      if (!deleted)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json({ message: "Voucher deleted" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Error deleting voucher", error: err.message });
    }
  }
}

module.exports = new VoucherController();
