const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();
const JWT_SECRET = process.env.JWT_SECRET;

class AuthController {
  async register(req, res) {
    try {
      let {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        address,
        email,
        password,
      } = req.body;
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      if (phone) {
        const phoneRegex = /^(?:\+?\d{1,3})?[ -]?\d{8,15}$/;
        if (!phoneRegex.test(phone)) {
          return res
            .status(400)
            .json({ message: "Invalid phone number format" });
        }
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      if (dateOfBirth) {
        const parsedDate = new Date(dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        dateOfBirth = parsedDate;
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        address,
        email,
        password: hashedPassword,
      });

      await newUser.save();

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      const payload = {
        id: user._id,
        email: user.email,
        role: user.role,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
      res.status(200).json({ message: "Login successful", token });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
}

module.exports = new AuthController();
