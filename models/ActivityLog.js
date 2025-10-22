const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
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
  },
  { timestamps: true }
);

activityLogSchema.index({ vendorId: 1, createdAt: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;