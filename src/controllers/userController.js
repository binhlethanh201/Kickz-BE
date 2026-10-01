const User = require("../models/User");
const bcrypt = require("bcrypt");
class UserController {
  async getAll(req, res, next) {
    try {
      const users = await User.find();
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ message: "Error", error: err.message });
    }
  }
  async getProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).select("-password");
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(200).json({ user });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      let { firstName, lastName, dateOfBirth, gender, phone, address, email } =
        req.body;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (dateOfBirth) {
        const parsedDate = new Date(dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        user.dateOfBirth = parsedDate;
      }
      if (gender)
        user.gender = ["M", "F", "O"].includes(gender) ? gender : user.gender;
      if (phone) {
        const phoneRegex = /^(?:\+?\d{1,3})?[ -]?\d{8,15}$/;
        if (!phoneRegex.test(phone)) {
          return res
            .status(400)
            .json({ message: "Invalid phone number format" });
        }
        user.phone = phone;
      }
      if (address && typeof address === "object") {
        if (!user.address) {
          user.address = {};
        }
        user.address.street = address.street || user.address.street;
        user.address.city = address.city || user.address.city;
        user.address.district = address.district || user.address.district;
        user.address.country = address.country || user.address.country;
      }

      if (email && email !== user.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ message: "Invalid email format" });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
        }
        user.email = email;
      }

      await user.save();

      res.status(200).json({
        message: "Profile updated successfully",
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          phone: user.phone,
          address: user.address,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async updatePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Missing oldPassword or newPassword" });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Old password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
}
module.exports = new UserController();
