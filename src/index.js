const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT;
const connectDB = require("./config/db");
const router = require("./routes/index");
const cors = require("cors");
const morgan = require("morgan");

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(morgan("dev"));
app.use(express.json());
connectDB();

app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

app.use("/api", router);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
