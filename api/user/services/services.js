const User = require("../model/model");
const { resolveSponsorByCode } = require("../../mlm/referral");
const { validateSponsorForSignup } = require("../../mlm/orgLevel");
const { resolveAdminListLimit } = require("../../../config/adminList");

const createUserService = async (data) => {
    const payload = { ...data };
    const role = payload.role || "user";

    if (payload.sponsorId && !payload.sponsor) {
        payload.sponsor = payload.sponsorId;
        delete payload.sponsorId;
    }

    if (role !== "admin" && role !== "vendor" && role !== "delivery") {
        if (!payload.sponsor) {
            const code = String(payload.referralCode || "").trim();
            if (!code) {
                throw new Error("Referral code is required");
            }
            const sponsor = await resolveSponsorByCode(code);
            if (!sponsor) {
                throw new Error("Invalid referral code");
            }
            payload.sponsor = sponsor._id;
        }

        const { orgLevel } = await validateSponsorForSignup(payload.sponsor);
        payload.orgLevel = orgLevel;
    }

    delete payload.referralCode;

    return await User.create(payload);
};

const getAllUsersService = async (queryParams = {}) => {
    const {
        page = 1,
        limit = 10000,
        sort = "-createdAt",
        role,
        isActive,
        verified,
        blocked,
        search,
    } = queryParams;

    const filter = {};

    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (verified !== undefined) filter.verified = verified === "true";
    if (blocked !== undefined) filter.blocked = blocked === "true";

    if (search) {
        filter.$or = [
            { name: {$regex: search, $options: "i"} },
            { email: {$regex: search, $options: "i"} },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const pageLimit = resolveAdminListLimit(limit);

    const users = await User.find(filter)
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("sponsor", "name email referralCode")
    .populate("wishlist", "title slug imgCover price")
    .sort(sort)
    .skip(skip)
    .limit(pageLimit);

    // Get total count for pagination
    const total = await User.countDocuments (filter);

    return {
        users,
        pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / pageLimit),
            totalUsers: total,
            hasNextPage: Number(page) < Math.ceil(total / pageLimit),
            hasPrevPage: Number(page) > 1,
        },
    };
};

const getUserByIdService = async (id) => {
    return await User.findById(id)
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("sponsor", "name email referralCode")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount");
};

const getUserByEmailService = async (email) => {
    return await User.findOne({ email })
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount");
};

const updateUserService = async (id, data) => {

    delete data.password;
    delete data.passwordResetToken;
    delete data.passwordResetExpires;

    return await User.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
    })
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount");
};

const deleteUserService = async (id) => {
    return await User.findByIdAndDelete(id);
};

const updateUserPasswordService = async (id, newPassword) => {
    const user = await User.findById(id);
    if (!user) return null;

    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    return user;
};

const toggleUserBlockedService = async (id) => {
    const user = await User.findById(id);
    if (!user) return null;

    user.blocked = !user.blocked;
    await user.save();

    return user;
};

const addAddressService = async (userId, addressData) => {
    const user = await User.findById(userId);
    if (!user) return null;

    if (addressData.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));  
    }

    user.addresses.push(addressData);
    await user.save();

    return user;
};

const updateAddressService = async (userId, addressId, addressData) => {
    const user = await User.findById(userId);
    if (!user) return null;

    const address = user.addresses.id(addressId);
    if (!address) return null;

    if (addressData.isDefault) {
        user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    Object.assign(address, addressData);
    await user.save();

    return user;
};

const deleteAddressService = async (userId, addressId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.addresses.pull(addressId);
    await user.save();

    return user;
};

const addToWishlistService = async (userId, productId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    if (!user.wishlist.includes(productId)) {
        user.wishlist.push(productId);
        await user.save();
    }

    return await User.findById(userId)
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount");
};

const removeFromWishlistService = async (userId, productId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.wishlist.pull(productId);
    await user.save();

    return await User.findById(userId)
    .select("-password -passwordResetToken -passwordResetExpires")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount");
};

const getWishlistService = async (userId) => {
    const user = await User.findById(userId)
    .select("wishlist")
    .populate("wishlist", "title slug imgCover price priceAfterDiscount discountPercentage");

    return user ? user.wishlist : null;
};

const toggleNewsletterService = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return null;

    user.subscribedToNewsletter = !user.subscribedToNewsletter;
    await user.save();

    return user;
};

module.exports = {
    createUserService,
    getAllUsersService,
    getUserByIdService,
    getUserByEmailService,
    updateUserService,
    deleteUserService,
    updateUserPasswordService,
    toggleUserBlockedService,
    addAddressService,
    updateAddressService,
    deleteAddressService,
    addToWishlistService,
    removeFromWishlistService,
    getWishlistService,
    toggleNewsletterService,
};