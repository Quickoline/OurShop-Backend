const {
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
} = require("../services/services");


const createUser = async (req, res) => {
    try {
        const user = await createUserService(req.body);
        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: user,
        }) ;
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Email already exists",
            });
        }
        if (error.message === "Invalid referral code") {
            return res.status(400).json({
                success: false,
                message: error.message,
            });
        }
    res.status(500).json({ success: false,
        message: error.message || error.messsage });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const result = await getAllUsersService(req.query);
        res.status(200).json({
            success: true,
            data: result.users,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserById = async (req, res) => {
    try {
        const user = await getUserByIdService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getUserByEmail = async (req, res) => {
    try {
        const user = await getUserByEmailService(req.params.email);
        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const updateUser = async (req, res) => {
    try {
        if (req.file) {
            req.body.profileImage = req.file.filename;
        }
        const user = await updateUserService(req.params.id, req.body);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
const user = await deleteUserService(req.params.id);
if (!user) {
    return res.status(404).json({
        success: false,
        message: "User not found",
    });
}
res.status(200).json({
    success: true,
    message: "User deleted successfully",
});
} catch (error) {
    res.status(500).json({ success: false, message: error.message });
}
};

const updateUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password is required",
            });
        }

     const user = await updateUserPasswordService(req.params.id, newPassword);
     if (!user) {
        return res.status(404).json({
            success: false,
            message: "User not found",
        });
     }
     res.status(200).json({
        success: true,
        message: "Password updated successfully",
     });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleUserBlocked = async (req, res) => {
    try {
        const user = await toggleUserBlockedService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: `User ${user.blocked ? "blocked" : "unblocked"} successfully`,
            data: { blocked: user.blocked },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message});
    }
};

const addAddress = async (req, res) => {
    try{
        const user = await addAddressService(req.params.id, req.body);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateAddress = async (req, res) => {
    try{
        const user = await updateAddressService(
            req.params.id,
            req.params.addressId,
            req.body
        );
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User or address not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Address updates successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAddress = async (req, res) => {
    try{
        const user = await deleteAddressService(req.params.id, req.params.addressId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Address deleted successfully",
            data: user.addresses,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        const user = await addToWishlistService(req.params.id, productId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product added to wishlist",
            data: user.wishlist,
        });
    } catch (error) {
        res.status(500).json({ suucess: false, message: error.message });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const user = await removeFromWishlistService(
        req.params.id,
        req.params.productId
        );
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            message: "Product removed from wishlist",
            data: user.wishlist,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getWishlist = async (req, res) => {
    try{
        const wishlist = await getWishlistService(req.params.id);
        if (wishlist === null) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        res.status(200).json({
            success: true,
            data: wishlist,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleNewsletter = async (req, res) => {
    try{
        const user = await toggleNewsletterService(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        response.status(200).json({
            success: true,
            message: `Newsletter ${user.subscribedToNewsletter ? "subscribed" : "unsubcribed"} successfully`,
            data: { subscribedToNewsletter: user.subscribedToNewsletter },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    getUserByEmail,
    updateUser,
    deleteUser,
    updateUserPassword,
    toggleUserBlocked,
    addAddress,
    updateAddress,
    deleteAddress,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    toggleNewsletter,
};