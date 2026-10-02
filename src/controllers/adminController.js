const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Voucher = require("../models/Voucher");
const bcrypt = require("bcryptjs");

class AdminController {
  //Users Management
  async getAllUsers(req, res) {
    try {
      const users = await User.find().select("-password");
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id).select("-password");
      if (!user) return res.status(404).json({ message: "User not found" });
      res.status(200).json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async createUser(req, res) {
    try {
      const { firstName, lastName, email, password, role } = req.body;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || "user",
      });
      await newUser.save();
      const userResponse = newUser.toObject();
      delete userResponse.password;

      res.status(201).json(userResponse);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async updateUser(req, res) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      user.firstName = req.body.firstName || user.firstName;
      user.lastName = req.body.lastName || user.lastName;
      user.email = req.body.email || user.email;
      user.role = req.body.role || user.role;
      user.phone = req.body.phone || user.phone;

      if (req.body.address) {
        user.address = { ...user.address, ...req.body.address };
      }
      await user.save();
      const userResponse = user.toObject();
      delete userResponse.password;
      res.status(200).json(userResponse);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async deleteUser(req, res) {
    try {
      const deletedUser = await User.findByIdAndDelete(req.params.id);
      if (!deletedUser)
        return res.status(404).json({ message: "User not found" });
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  //Orders Management
  async getAllOrders(req, res) {
    try {
      const orders = await Order.find({})
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "name price")
        .sort({ createdAt: -1 });
      res.status(200).json(orders);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async getOrderById(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "name price img brand");
      if (!order) return res.status(404).json({ message: "Order not found" });
      res.status(200).json(order);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      const validStatuses = Order.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status: "${status}"` });
      }
      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { status: status },
        { new: true },
      );
      if (!updatedOrder)
        return res.status(404).json({ message: "Order not found" });
      res.status(200).json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async deleteOrder(req, res) {
    try {
      const deletedOrder = await Order.findByIdAndDelete(req.params.id);
      if (!deletedOrder)
        return res.status(404).json({ message: "Order not found" });
      res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  //Vouchers Management
  async getAllVouchers(req, res) {
    try {
      const vouchers = await Voucher.find({}).sort({ createdAt: -1 });
      res.status(200).json(vouchers);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async getVoucherById(req, res) {
    try {
      const voucher = await Voucher.findById(req.params.id);
      if (!voucher)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json(voucher);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async createVoucher(req, res) {
    try {
      const {
        code,
        description,
        discountType,
        discountValue,
        minOrderValue,
        expiresAt,
        maxUsage,
        isActive,
      } = req.body;
      let dbDiscountType;
      if (discountType === "Percentage") {
        dbDiscountType = "percent";
      } else if (discountType === "Fixed") {
        dbDiscountType = "amount";
      } else {
        return res.status(400).json({
          message: `Invalid discountType: ${discountType}. Must be 'Percentage' or 'Fixed'.`,
        });
      }
      const dbStartDate = new Date();
      let dbEndDate;
      if (expiresAt) {
        dbEndDate = new Date(expiresAt);
        if (isNaN(dbEndDate.getTime())) {
          return res.status(400).json({
            message: "Invalid expiresAt date format. Use YYYY-MM-DD.",
          });
        }
      } else {
        dbEndDate = new Date(dbStartDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      const newVoucher = new Voucher({
        code,
        description,
        discountType: dbDiscountType,
        discountValue,
        minOrderValue: minOrderValue || 0,
        startDate: dbStartDate,
        endDate: dbEndDate,
        isActive,
      });
      await newVoucher.save();
      res.status(201).json(newVoucher);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: "Voucher code must be unique." });
      }
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
  async updateVoucher(req, res) {
    try {
      const updateData = { ...req.body };
      if (updateData.discountType) {
        if (updateData.discountType === "Percentage") {
          updateData.discountType = "percent";
        } else if (updateData.discountType === "Fixed") {
          updateData.discountType = "amount";
        } else {
          return res.status(400).json({
            message: `Invalid discountType: ${updateData.discountType}`,
          });
        }
      }
      if (updateData.expiresAt) {
        const dbEndDate = new Date(updateData.expiresAt);
        if (isNaN(dbEndDate.getTime())) {
          return res.status(400).json({
            message: "Invalid expiresAt date format. Use YYYY-MM-DD.",
          });
        }
        updateData.endDate = dbEndDate;
        delete updateData.expiresAt;
      }
      if (updateData.maxUsage !== undefined) {
        delete updateData.maxUsage;
      }
      if (updateData.code) {
        const existing = await Voucher.findOne({
          code: updateData.code,
          _id: { $ne: req.params.id },
        });
        if (existing) {
          return res
            .status(400)
            .json({ message: "This voucher code is already in use." });
        }
      }
      const updatedVoucher = await Voucher.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true },
      );
      if (!updatedVoucher)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json(updatedVoucher);
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
  async deleteVoucher(req, res) {
    try {
      const deletedVoucher = await Voucher.findByIdAndDelete(req.params.id);
      if (!deletedVoucher)
        return res.status(404).json({ message: "Voucher not found" });
      res.status(200).json({ message: "Voucher deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  //Products Managements
  async createProduct(req, res) {
    try {
      const newProduct = new Product(req.body);
      await newProduct.save();
      res.status(201).json(newProduct);
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
  async getAllProducts(req, res) {
    try {
      const products = await Product.find({}).sort({ createdAt: -1 });
      res.status(200).json(products);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async getProductById(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.status(200).json(product);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async updateProduct(req, res) {
    try {
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true },
      );
      if (!updatedProduct)
        return res.status(404).json({ message: "Product not found" });
      res.status(200).json(updatedProduct);
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
  }
  async deleteProduct(req, res) {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct)
        return res.status(404).json({ message: "Product not found" });
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  //Report And Analytics
  //Dashboard Overview Stats
  async getDashboardStats(req, res) {
    try {
      const totalUsers = await User.countDocuments({ role: "user" });
      const totalProducts = await Product.countDocuments();
      const totalOrders = await Order.countDocuments();

      const revenueResult = await Order.aggregate([
        {
          $match: {
            status: { $in: ["paid", "completed", "shipped", "processing"] },
          },
        },
        { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } },
      ]);
      const totalRevenue =
        revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      const pendingOrders = await Order.countDocuments({ status: "pending" });

      res.status(200).json({
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue,
        pendingOrders,
      });
    } catch (error) {
      res.status(500).json({
        message: "Error fetching dashboard stats",
        error: error.message,
      });
    }
  }
  //Order & Revenue Report (Flexible by Month, Quarter, Year)
  async getOrderReport(req, res) {
    try {
      const { type, year } = req.query;

      const currentYear = new Date().getFullYear();
      const reportYear = year ? parseInt(year) : currentYear;

      let groupBy, sortOrder;
      let matchStage = {
        createdAt: {
          $gte: new Date(`${reportYear}-01-01`),
          $lte: new Date(`${reportYear}-12-31T23:59:59.999Z`),
        },
        status: { $in: ["paid", "completed", "shipped", "processing"] },
      };

      if (type === "month") {
        groupBy = { month: { $month: "$createdAt" } };
        sortOrder = { "_id.month": 1 };
      } else if (type === "quarter") {
        groupBy = {
          quarter: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } },
        };
        sortOrder = { "_id.quarter": 1 };
      } else if (type === "year") {
        matchStage = {
          status: { $in: ["paid", "completed", "shipped", "processing"] },
        };
        groupBy = { year: { $year: "$createdAt" } };
        sortOrder = { "_id.year": 1 };
      } else {
        groupBy = { month: { $month: "$createdAt" } };
        sortOrder = { "_id.month": 1 };
      }

      const report = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: groupBy,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$totalPrice" },
          },
        },
        { $sort: sortOrder },
      ]);
      const formattedReport = report.map((item) => {
        let label;
        if (item._id.month) label = `Month ${item._id.month}`;
        else if (item._id.quarter) label = `Q${item._id.quarter}`;
        else if (item._id.year) label = `Year ${item._id.year}`;

        return {
          label,
          ...item._id,
          totalOrders: item.totalOrders,
          totalRevenue: item.totalRevenue,
        };
      });

      res.status(200).json(formattedReport);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching order report", error: error.message });
    }
  }
  //User Registration Report
  async getUserReport(req, res) {
    try {
      const { type, year } = req.query;
      const currentYear = new Date().getFullYear();
      const reportYear = year ? parseInt(year) : currentYear;

      let groupBy,
        matchStage = {
          createdAt: {
            $gte: new Date(`${reportYear}-01-01`),
            $lte: new Date(`${reportYear}-12-31`),
          },
        };

      if (type === "year") {
        matchStage = {};
        groupBy = { year: { $year: "$createdAt" } };
      } else if (type === "quarter") {
        groupBy = {
          quarter: { $ceil: { $divide: [{ $month: "$createdAt" }, 3] } },
        };
      } else {
        groupBy = { month: { $month: "$createdAt" } };
      }

      const report = await User.aggregate([
        { $match: { role: "user", ...matchStage } },
        { $group: { _id: groupBy, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const formattedReport = report.map((item) => {
        let label;
        if (item._id.month) label = `Month ${item._id.month}`;
        else if (item._id.quarter) label = `Q${item._id.quarter}`;
        else if (item._id.year) label = `Year ${item._id.year}`;
        return { label, ...item._id, count: item.count };
      });

      res.status(200).json(formattedReport);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error fetching user report", error: error.message });
    }
  }
  //Top Selling Products Report
  async getProductReport(req, res) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 5;

      const topProducts = await Order.aggregate([
        {
          $match: {
            status: { $in: ["paid", "completed", "shipped", "processing"] },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productInfo",
          },
        },
        { $unwind: "$productInfo" },
        {
          $project: {
            _id: 1,
            name: "$productInfo.name",
            img: "$productInfo.img",
            price: "$productInfo.price",
            totalSold: 1,
            totalRevenue: 1,
          },
        },
      ]);

      res.status(200).json(topProducts);
    } catch (error) {
      res.status(500).json({
        message: "Error fetching product report",
        error: error.message,
      });
    }
  }
}

module.exports = new AdminController();
