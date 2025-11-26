const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    heading: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "booking_created",
        "booking_accepted",
        "booking_rejected",
        "sale_item_added",
        "sale_item_order_placed",
        "sale_item_order_delivered"
      ],
    },
    description: {
      type: String,
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingRequest",
    },
    ActivityType: {
      type: String,
      default: "booking"
    }
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;