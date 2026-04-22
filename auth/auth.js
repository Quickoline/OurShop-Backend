const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../api/user/model/model");

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (user) => {
  // Always store a string id in JWT payload — ObjectId objects can stringify oddly and break lookups.
  const id = user?._id != null ? String(user._id) : null;
  return jwt.sign(
    {
      id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const normalizeJwtSubjectId = (decoded) => {
  let raw = decoded?.id ?? decoded?.userId ?? decoded?.sub;
  if (raw == null) return null;
  if (typeof raw === "object") {
    if (typeof raw.$oid === "string") return raw.$oid;
    if (typeof raw.toHexString === "function") return raw.toHexString();
    if (typeof raw.toString === "function") return String(raw);
    return null;
  }
  return String(raw);
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Bearer token is required.",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const subjectId = normalizeJwtSubjectId(decoded);
    if (!subjectId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await User.findById(subjectId).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    if (user.blocked || user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked or inactive.",
      });
    }

    req.user = {
      id: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please login first.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
};

const allowSelfOrAdmin = (paramKey = "id") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please login first.",
      });
    }

    if (req.user.role === "admin" || req.user.id === req.params[paramKey]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You can only access your own account resources.",
    });
  };
};

const validateResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required.",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired.",
      });
    }

    req.resetUser = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  signToken,
  normalizeJwtSubjectId,
  authenticate,
  authorizeRoles,
  allowSelfOrAdmin,
  validateResetToken,
};
