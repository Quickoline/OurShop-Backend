const services = require("./services");
const { distributeOrderCommissions } = require("../mlm/distribute");
const { MLM_LEVEL_RATES, ADMIN_SHARE_OF_PROFIT, MLM_SHARE_OF_PROFIT } = require("../mlm/constants");

const getMyWallet = async (req, res) => {
  try {
    const data = await services.getWalletSummary(req.user.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyTransactions = async (req, res) => {
  try {
    const data = await services.getTransactions(req.user.id, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyTeam = async (req, res) => {
  try {
    const data = await services.getMlmTeam(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMlmConfig = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      adminSharePercent: ADMIN_SHARE_OF_PROFIT * 100,
      mlmSharePercent: MLM_SHARE_OF_PROFIT * 100,
      headIsBuyer: true,
      levelsAreUplineOnly: true,
      unallocatedLevelsToCompany: true,
      levelRates: Object.fromEntries(
        Object.entries(MLM_LEVEL_RATES).map(([k, v]) => [k, v * 100])
      ),
    },
  });
};

const adminGetCompanyWallet = async (req, res) => {
  try {
    const data = await services.getCompanyWallet(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminListWallets = async (req, res) => {
  try {
    const data = await services.adminListWallets(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminAdjustWallet = async (req, res) => {
  try {
    const { amount, description } = req.body;
    const data = await services.adminAdjustWallet(
      req.params.userId,
      { amount, description },
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: "Wallet updated",
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const adminGetUserTransactions = async (req, res) => {
  try {
    const data = await services.getTransactions(req.params.userId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const distributeOrder = async (req, res) => {
  try {
    const result = await distributeOrderCommissions(req.params.orderId);
    if (result?.skipped) {
      return res.status(400).json({
        success: false,
        message: `MLM not applied: ${result.reason}`,
        data: result,
      });
    }
    res.status(200).json({
      success: true,
      message: "MLM commissions distributed",
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMyWallet,
  getMyTransactions,
  getMyTeam,
  getMlmConfig,
  adminGetCompanyWallet,
  adminListWallets,
  adminAdjustWallet,
  adminGetUserTransactions,
  distributeOrder,
};
