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

  async validateVoucher(req, res) {
    try {
      const { code, orderTotal } = req.body;
      const voucher = await Voucher.findOne({
        code: code.toUpperCase().trim(),
      });

      if (!voucher) {
        return res.status(404).json({
          valid: false,
          message: "Mã voucher không tồn tại",
        });
      }

      if (!voucher.isActive) {
        return res.status(400).json({
          valid: false,
          message: "Mã voucher đã bị vô hiệu hóa",
        });
      }

      const now = new Date();
      if (now > voucher.endDate || now < voucher.startDate) {
        return res.status(400).json({
          valid: false,
          message: "Mã voucher đã hết hạn",
        });
      }

      if (orderTotal < voucher.minOrderValue) {
        return res.status(400).json({
          valid: false,
          message: `Đơn hàng phải từ ${voucher.minOrderValue.toLocaleString("vi-VN")} đ`,
        });
      }

      if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
        return res.status(400).json({
          valid: false,
          message: "Mã voucher đã hết lượt sử dụng",
        });
      }

      let discount = 0;
      if (voucher.discountType === "percent") {
        discount = Math.floor((orderTotal * voucher.discountValue) / 100);
      } else {
        discount = voucher.discountValue;
      }

      const finalDiscount = Math.min(discount, orderTotal);
      return res.status(200).json({
        valid: true,
        voucher: {
          _id: voucher._id,
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          description: voucher.description,
        },
        discount: finalDiscount,
        newTotal: orderTotal - finalDiscount,
        message: "Mã voucher có hiệu lực",
      });
    } catch (err) {
      res.status(500).json({
        valid: false,
        message: "Lỗi kiểm tra voucher",
        error: err.message,
      });
    }
  }

  async getActiveVouchers(req, res) {
    try {
      const now = new Date();
      const vouchers = await Voucher.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .select(
          "code discountType discountValue minOrderValue description usageLimit usedCount",
        )
        .sort({ createdAt: -1 })
        .limit(10);

      res.status(200).json({
        vouchers,
        count: vouchers.length,
      });
    } catch (err) {
      res.status(500).json({
        message: "Lỗi lấy danh sách voucher",
        error: err.message,
      });
    }
  }
}

module.exports = new VoucherController();
