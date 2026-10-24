const User = require("../api/user/model/model");
const { signToken } = require("./auth");

const sanitizeUser = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  blocked: user.blocked,
  isActive: user.isActive,
  verified: user.verified,
  referralCode: user.referralCode,
  walletBalance: user.walletBalance ?? 0,
  sponsor: user.sponsor,
});

const login = async (req, res, requiredRole = null) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.blocked || user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked or inactive.",
      });
    }

    if (requiredRole) {
      const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied for this login route.",
        });
      }
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const userLogin = async (req, res) => {
  return login(req, res);
};

const adminLogin = async (req, res) => {
  return login(req, res, ["admin", "vendor", "delivery"]);
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("sponsor", "name email referralCode");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const user = await User.findOne({ email });

    // Keep same response shape to avoid email-enumeration leaks.
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists, a reset link has been generated.",
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrlBase = (
      process.env.FRONTEND_URL || "https://quickoshop.com"
    ).replace(/\/$/, "");
    const resetUrl = `${resetUrlBase}/reset-password/${resetToken}`;

    return res.status(200).json({
      success: true,
      message:
        "Use the reset link below to choose a new password. The link expires in 10 minutes.",
      resetUrl,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = req.resetUser;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Password reset successful.",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  userLogin,
  adminLogin,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};
