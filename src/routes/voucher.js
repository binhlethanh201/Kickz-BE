const express = require("express");
const router = express.Router();
const voucherController = require("../controllers/voucherController");
const verifyToken = require("../middlewares/auth");
const checkAdmin = require("../middlewares/admin");

router.post("/", verifyToken, checkAdmin, voucherController.create);
router.put("/:id", verifyToken, checkAdmin, voucherController.update);
router.delete("/:id", verifyToken, checkAdmin, voucherController.delete);
router.get("/", voucherController.getAll);
router.get("/:id", voucherController.getById);

module.exports = router;
