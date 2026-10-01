const jwt = require("jsonwebtoken");
function verifyToken(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  const token = authHeader.replace(/Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      req.tokenError = err.message;
      req.user = null;
      req.token = token;
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = decoded;
    req.token = token;
    next();
  });
}
module.exports = verifyToken;
