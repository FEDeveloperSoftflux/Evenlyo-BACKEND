// models/Order.js
const mongoose = require("mongoose");

const SaleOrderPurchase = new mongoose.Schema(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        items: { type: Array, default: [] },  // multiple items
        totalAmount: { type: Number, required: true },
        status: {
            type: String,
            enum: ["pending", "processing", "completed", "cancelled"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("saleorders", SaleOrderPurchase);
