const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    // Customer
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Ordered Items
    orderItems: [
      {
        itemType: {
          type: String,
          enum: ["product", "service"],
          default: "product",
        },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
        },
        title: String,
        Discription: String,
        image: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        profitAmount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],

    commissionDistributed: {
      type: Boolean,
      default: false,
    },
    mlmProfitTotal: {
      type: Number,
      default: 0,
    },
    adminProfitShare: {
      type: Number,
      default: 0,
    },
    mlmProfitShare: {
      type: Number,
      default: 0,
    },

    // Address
    shippingAddress: {
      fullName: String,
      phone: Number,
      addressLine: String,
      city: String,
      state: String,
      pincode: Number,
      country: {
        type: String,
        require: true,
        default: "India",
      },
    },

    // Price Breakdown (Amazon style)
    itemsPrice: {
      type: Number,
      required: true,
    },
    taxPrice: {
      type: Number,
      default: 0,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    discountPrice: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
    },

    // Payment
    paymentMethod: {
      type: String,
      enum: ["CARD", "UPI", "NETBANKING", "RAZORPAY"],
      required: true,
    },
    paymentResult: {
      transactionId: String,
      status: String,
      paidAt: Date,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },

    // Order Status & Tracking
    orderStatus: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "PACKED",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
        "REFUNDED",
      ],
      default: "PLACED",
    },

    deliveredAt: Date,

    // Amazon-like extras
    invoiceNumber: String,
    deliveryPartner: String,
    trackingId: String,
    expectedDeliveryDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
