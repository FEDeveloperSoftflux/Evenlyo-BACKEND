const asyncHandler = require("express-async-handler");
const Booking = require("../../models/Booking");
const Vendor = require("../../models/Vendor");
const BookingRequest = require("../../models/Booking");
const notificationController = require("../notificationController");
const Listing = require("../../models/Listing");
const StockLog = require("../../models/StockLog");
const {
  getAvailabilityDetails,
  checkAvailability,
} = require("../../utils/bookingUtils");
const { createActivityLog } = require("../../utils/activityLogger");

// GET /api/vendor/bookings/analytics
const getVendorBookingAnalytics = async (req, res) => {
  console.log("HAHAHAHHA");
  
  try {
    const vendorId = req.user?.id;
    if (!vendorId)
      return res
        .status(400)
        .json({ success: false, message: "Vendor not found in request." });

    // Booking status counts
    const [total, completed, requested, inProcess, bookings] =
      await Promise.all([
        Booking.countDocuments({ vendorId }),
        Booking.countDocuments({ vendorId, status: "completed" }),
        Booking.countDocuments({ vendorId, status: "pending" }),
        Booking.countDocuments({
          vendorId,
          status: {
            $in: ["accepted", "paid", "on_the_way", "received", "picked_up"],
          },
        }),
        Booking.find({ vendorId })
          .sort({ createdAt: -1 })
          .populate("userId", "firstName lastName email")
          .populate("listingId", "title")
          .select(
            "details status trackingId userId listingId description eventLocation createdAt statusHistory listingDetails"
          ),
      ]);
    console.log(bookings, "bookingsbookingsbookingsbookingsbookings");

    // Get unique listing IDs
    const listingIds = [
      ...new Set(bookings.map((b) => b.listingId).filter((id) => id)),
    ];

    const bookingsList = bookings.map((b) => ({
      id: b._id,
      startDate: b.details?.startDate,
      endDate: b.details?.endDate,
      startTime: b.details?.startTime,
      endTime: b.details?.endTime,
      status: b.status,
      title: b.listingDetails?.title || "",
      customer: b.userId ? `${b.userId.firstName} ${b.userId.lastName}` : "",
      description:
        b.details?.specialRequests?.en || b.details?.specialRequests || "",
      ListingId: b.listingId?._id,
      location: b.details?.eventLocation || "",
      trackingId: b.trackingId,
      statusHistory: b.statusHistory,
      createdAt: b.createdAt,
    }));

    res.json({
      success: true,
      stats: {
        totalBookings: total,
        completedBookings: completed,
        requestBookings: requested,
        inProcessBookings: inProcess,
      },
      bookings: bookingsList,
    });
  } catch (err) {
    console.error("Vendor booking analytics error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
// @desc    Accept booking request
// @route   POST /api/booking/:id/accept
// @access  Private (Vendor)
const acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor profile not found",
    });
  }

  const booking = await BookingRequest.findOne({
    _id: id,
    vendorId: vendor.userId,
    status: "pending",
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking request not found or already processed",
    });
  }

  const availabilityResult = await getAvailabilityDetails(
    booking.listingId,
    booking.details.startDate,
    booking.details.endDate,
    booking._id
  );

  if (!availabilityResult.isAvailable) {
    console.log(
      `Booking acceptance failed for booking ${id}: conflicting bookings found for listing ${booking.listingId}`
    );
    return res.status(409).json({
      success: false,
      message: "Booking is no longer available due to conflicting bookings",
      details:
        "Another booking has been accepted for overlapping dates. Please check the booking calendar and try a different time slot.",
      conflictingBookings: availabilityResult.conflictingBookings,
    });
  }

  console.log(`Accepting booking ${id} for vendor ${vendor.userId}`);

  const decrementBy = 1;
  const updatedListing = await Listing.findOneAndUpdate(
    {
      _id: booking.listingId,
      vendor: vendor.userId,
      quantity: { $gte: decrementBy },
    },
    { $inc: { quantity: -decrementBy } },
    { new: true }
  );

  if (!updatedListing) {
    return res.status(400).json({
      success: false,
      message: "Not enough stock to accept this booking",
    });
  }

  try {
    await StockLog.create({
      listing: updatedListing._id,
      type: "checkout",
      quantity: decrementBy,
      note: `Checked out for booking ${booking._id}`,
      createdBy: req.user?._id,
    });
  } catch (e) {
    console.error("Failed to create stock log for booking accept", e);
  }

  booking.status = "accepted";
  try {
    await booking.save();
  } catch (e) {
    console.error("Failed to save booking after stock update", e);
    try {
      await Listing.updateOne(
        { _id: updatedListing._id },
        { $inc: { quantity: decrementBy } }
      );
    } catch (rbErr) {
      console.error(
        "Failed to rollback listing quantity after booking save failure",
        rbErr
      );
    }
    return res.status(500).json({
      success: false,
      message: "Failed to accept booking",
    });
  }

  try {
    await createActivityLog({
      vendorId: vendor.userId,
      heading: "Booking Accepted",
      type: "booking_accepted",
      description: `Booking ${booking.trackingId} has been accepted`,
      bookingId: booking._id,
      userId: req.user?._id,
    });
  } catch (e) {
    console.error("Failed to create activity log", e);
  }

  try {
    await notificationController.createNotification({
      user: booking.userId,
      bookingId: booking._id,
      message: `Your booking has been accepted.`,
    });
  } catch (e) {
    console.error(
      "Failed to create client notification for accepted booking:",
      e
    );
  }

  await booking.populate([
    { path: "userId", select: "firstName lastName email contactNumber" },
    { path: "listingId", select: "title featuredImage pricing" },
  ]);

  res.json({
    success: true,
    message: "Booking request accepted successfully",
    data: {
      booking,
    },
  });
});

const rejectBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor profile not found",
    });
  }

  const booking = await BookingRequest.findOne({
    _id: id,
    vendorId: vendor.userId,
    status: "pending",
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking request not found or already processed",
    });
  }

  booking.status = "rejected";
  booking.rejectionReason = { en: rejectionReason || "No reason provided" };
  await booking.save();

  try {
    await createActivityLog({
      vendorId: vendor.userId,
      heading: "Booking Rejected",
      type: "booking_rejected",
      description: `Booking ${booking.trackingId} has been rejected. Reason: ${
        rejectionReason || "No reason provided"
      }`,
      bookingId: booking._id,
      userId: req.user?.id,
    });
  } catch (e) {
    console.error("Failed to create activity log", e);
  }

  try {
    await notificationController.createNotification({
      user: booking.userId,
      bookingId: booking._id,
      message: `Your booking has been rejected.`,
    });
  } catch (e) {
    console.error(
      "Failed to create client notification for rejected booking:",
      e
    );
  }

  await booking.populate([
    { path: "userId", select: "firstName lastName email contactNumber" },
    { path: "listingId", select: "title featuredImage pricing" },
  ]);

  res.json({
    success: true,
    message: "Booking request rejected",
    data: {
      booking,
    },
  });
});

module.exports = {
  acceptBooking,
  rejectBooking,
  getVendorBookingAnalytics,
};
