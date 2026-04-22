const  Wishlist = require("../wishlist/model");


const getWishlistService = async (userId) => {
    return await Wishlist.findOne({ userId });
};


const addToWishlistService = async (userId, productId) => {
 let wishlist = await Wishlist.findOne({ userId });

 if (!wishlist) {
    wishlist = await Wishlist.create({
        userId,
        products: [{ productId }],
    });
    return wishlist;
 }


 const exists = wishlist.products.some(
    (item) => item.productId.toString() === productId.toString()
 );

 if (exists) {
    return { alreadyExists: true, wishlist };
 }

 wishlist.products.push({ productId });
 await wishlist.save();
 return wishlist;
};


const removeFromWishlistService = async (userId, productId) => {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) return null;

    wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId.toString()
    );

    await wishlist.save();
    return wishlist;
};


const clearWishlistService = async (userId) => {
    return await Wishlist.findOneAndDelete({ userId });
};

module.exports = {
    getWishlistService,
    addToWishlistService,
    removeFromWishlistService,
    clearWishlistService,
};
