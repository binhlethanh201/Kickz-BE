const express = require("express");
const router = express.Router();
const cardController = require("../controllers/cardController");
const verifyToken = require("../middlewares/auth");

router.get("/mine", verifyToken, cardController.getMyCard);

module.exports = router;
