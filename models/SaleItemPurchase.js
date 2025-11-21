// models/Order.js
const mongoose = require("mongoose");

const SaleOrderPurchase = new mongoose.Schema(
    {
        trackingId: {
            type: String,
            unique: true,
            required: true
        },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        items: { type: Array, default: [] },  // multiple items
        totalAmount: { type: Number, required: true },
        deliveryAmount: { type: Number, required: true },
        itemLocation: {
            type: {
                fullAddress: String,
                coordinates: {
                    lat: Number,
                    lng: Number
                }
            },
            default: {
                fullAddress: "",
                coordinates: {
                    lat: 0,
                    lng: 0
                }
            }
        },
        deliveryLocation: {
            type: {
                fullAddress: String,
                coordinates: {
                    lat: Number,
                    lng: Number
                }
            },
            default: {
                fullAddress: "",
                coordinates: {
                    lat: 0,
                    lng: 0
                }
            }
        },
        totalKms: { type: String, default: 0 },
        status: {
            type: String,
            enum: ["Order Placed", "On the way", "Delivered"],
            default: "Order Placed",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("saleorders", SaleOrderPurchase);
