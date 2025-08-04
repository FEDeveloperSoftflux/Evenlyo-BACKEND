const asyncHandler = require('express-async-handler');
const BookingRequest = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

// Helper function to check listing availability for multi-day bookings
const checkAvailability = async (listingId, startDate, endDate) => {
  // Normalize dates to start of day for accurate comparison
  const checkStart = new Date(startDate);
  checkStart.setHours(0, 0, 0, 0);
  
  const checkEnd = new Date(endDate);
  checkEnd.setHours(23, 59, 59, 999);
  
  // Check for overlapping bookings that are not rejected or cancelled
  const overlappingBookings = await BookingRequest.find({
    listingId,
    status: { $nin: ['rejected', 'cancelled'] },
    $or: [
      {
        // Booking starts before our period ends and ends after our period starts
        'details.startDate': { $lte: checkEnd },
        'details.endDate': { $gte: checkStart }
      }
    ]
  }).select('details.startDate details.endDate status trackingId');

  // If any overlapping bookings found, list them for debugging
  if (overlappingBookings.length > 0) {
    console.log('Conflicting bookings found:', overlappingBookings.map(booking => ({
      trackingId: booking.trackingId,
      startDate: booking.details.startDate,
      endDate: booking.details.endDate,
      status: booking.status
    })));
  }

  return overlappingBookings.length === 0;
};

// @desc    Create a booking request
// @route   POST /api/booking/request
// @access  Private (User)
const createBookingRequest = asyncHandler(async (req, res) => {
  const {
    listingId,
    vendorId,
    details: {
      startDate,
      endDate,
      startTime,
      endTime,
      eventLocation,
      eventType,
      guestCount,
      specialRequests,
      contactPreference
    }
  } = req.body;

  // Validate required fields
  if (!listingId || !vendorId || !startDate || !endDate || !startTime || !endTime || !eventLocation) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  // Check if listing exists and is active
  const listing = await Listing.findOne({
    _id: listingId,
    isActive: true,
    status: 'active'
  }).populate('vendor');

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found or not available'
    });
  }

  // Verify vendor matches
  if (listing.vendor._id.toString() !== vendorId) {
    return res.status(400).json({
      success: false,
      message: 'Vendor mismatch'
    });
  }

  // Check availability for all days in the range
  const isAvailable = await checkAvailability(listingId, new Date(startDate), new Date(endDate));
  if (!isAvailable) {
    return res.status(409).json({
      success: false,
      message: 'Selected dates are not available. Some days may already be booked.'
    });
  }

  // Calculate duration and multi-day details
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
  const isMultiDay = diffDays > 1;
  
  // Calculate hours per day
  const calculateHours = (startTime, endTime) => {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    let diffHours = (end - start) / (1000 * 60 * 60);
    if (diffHours < 0) diffHours += 24; // Handle overnight
    return Math.max(diffHours, 0);
  };
  
  const dailyHours = calculateHours(startTime, endTime);
  const totalHours = dailyHours * diffDays;

  // Enhanced pricing calculation for multi-day bookings
  let bookingPrice = 0;
  
  if (listing.pricing.type === 'daily' && listing.pricing.perDay) {
    bookingPrice = listing.pricing.perDay * diffDays;
  } else if (listing.pricing.type === 'hourly' && listing.pricing.perHour) {
    bookingPrice = listing.pricing.perHour * totalHours;
  } else if (listing.pricing.type === 'per_event' && listing.pricing.perEvent) {
    // For multi-day events, might need special handling
    bookingPrice = listing.pricing.perEvent * (isMultiDay ? diffDays : 1);
  }
  
  // Apply multi-day discounts if configured
  if (isMultiDay && listing.pricing.multiDayDiscount) {
    const discountPercent = listing.pricing.multiDayDiscount.percent || 0;
    const minDays = listing.pricing.multiDayDiscount.minDays || 2;
    
    if (diffDays >= minDays) {
      const discount = (bookingPrice * discountPercent) / 100;
      bookingPrice = bookingPrice - discount;
    }
  }

  // Create booking request with multi-day support
  const bookingRequest = new BookingRequest({
    userId: req.user.id,
    vendorId,
    listingId,
    details: {
      startDate,
      endDate,
      startTime,
      endTime,
      duration: {
        hours: dailyHours,
        days: diffDays,
        totalHours: totalHours,
        isMultiDay: isMultiDay
      },
      eventLocation,
      eventType,
      guestCount,
      specialRequests,
      contactPreference: contactPreference || 'email'
    },
    pricing: {
      bookingPrice,
      securityPrice: listing.pricing.securityFee || 0,
      totalPrice: bookingPrice + (listing.pricing.securityFee || 0),
      ...(isMultiDay && {
        dailyRate: Math.round(bookingPrice / diffDays),
        multiDayDiscount: listing.pricing.multiDayDiscount || null
      })
    }
  });

  await bookingRequest.save();

  // Populate the response
  await bookingRequest.populate([
    { path: 'userId', select: 'firstName lastName email contactNumber' },
    { path: 'vendorId', select: 'businessName businessEmail businessPhone' },
    { path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Booking request created successfully',
    data: {
      bookingRequest
    }
  });
});

// @desc    Get pending bookings for vendor
// @route   GET /api/booking/pending
// @access  Private (Vendor)
const getPendingBookings = asyncHandler(async (req, res) => {
  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const pendingBookings = await BookingRequest.find({
    vendorId: vendor._id,
    status: 'pending'
  })
  .populate('userId', 'firstName lastName email contactNumber')
  .populate('listingId', 'title featuredImage pricing')
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      bookings: pendingBookings,
      count: pendingBookings.length
    }
  });
});

// @desc    Accept booking request
// @route   POST /api/booking/:id/accept
// @access  Private (Vendor)
const acceptBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: id,
    vendorId: vendor._id,
    status: 'pending'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking request not found or already processed'
    });
  }

  // Double-check availability before accepting
  const isAvailable = await checkAvailability(
    booking.listingId,
    booking.details.startDate,
    booking.details.endDate
  );

  if (!isAvailable) {
    return res.status(409).json({
      success: false,
      message: 'Booking is no longer available due to conflicting bookings'
    });
  }

  booking.status = 'accepted';
  await booking.save();

  await booking.populate([
    { path: 'userId', select: 'firstName lastName email contactNumber' },
    { path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.json({
    success: true,
    message: 'Booking request accepted successfully',
    data: {
      booking
    }
  });
});

// @desc    Reject booking request
// @route   POST /api/booking/:id/reject
// @access  Private (Vendor)
const rejectBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: id,
    vendorId: vendor._id,
    status: 'pending'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking request not found or already processed'
    });
  }

  booking.status = 'rejected';
  booking.rejectionReason = rejectionReason || 'No reason provided';
  await booking.save();

  await booking.populate([
    { path: 'userId', select: 'firstName lastName email contactNumber' },
    { path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.json({
    success: true,
    message: 'Booking request rejected',
    data: {
      booking
    }
  });
});

// @desc    Get accepted bookings for user (before payment)
// @route   GET /api/booking/accepted
// @access  Private (User)
const getAcceptedBookings = asyncHandler(async (req, res) => {
  const acceptedBookings = await BookingRequest.find({
    userId: req.user.id,
    status: 'accepted'
  })
  .populate('vendorId', 'businessName businessEmail businessPhone')
  .populate('listingId', 'title featuredImage pricing')
  .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      bookings: acceptedBookings,
      count: acceptedBookings.length
    }
  });
});

// @desc    Mark booking as paid
// @route   POST /api/booking/:id/pay
// @access  Private (User)
const markBookingAsPaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;

  const booking = await BookingRequest.findOne({
    _id: id,
    userId: req.user.id,
    status: 'accepted'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not in accepted status'
    });
  }

  booking.status = 'paid';
  booking.paymentStatus = 'paid';
  booking.paymentMethod = paymentMethod || 'stripe';
  
  if (transactionId) {
    booking.transactionId = transactionId;
  }

  await booking.save();

  await booking.populate([
    { path: 'vendorId', select: 'businessName businessEmail businessPhone' },
    { path: 'listingId', select: 'title featuredImage pricing' }
  ]);

  res.json({
    success: true,
    message: 'Payment confirmed successfully',
    data: {
      booking
    }
  });
});

// @desc    Get user's booking history
// @route   GET /api/booking/history
// @access  Private (User)
const getBookingHistory = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  const filter = { userId: req.user.id };
  if (status) {
    filter.status = status;
  }

  const bookings = await BookingRequest.find(filter)
    .populate('vendorId', 'businessName businessEmail businessPhone')
    .populate('listingId', 'title featuredImage pricing')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await BookingRequest.countDocuments(filter);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});

// @desc    Get vendor's booking history
// @route   GET /api/booking/vendor-history
// @access  Private (Vendor)
const getVendorBookingHistory = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const filter = { vendorId: vendor._id };
  if (status) {
    filter.status = status;
  }

  const bookings = await BookingRequest.find(filter)
    .populate('userId', 'firstName lastName email contactNumber')
    .populate('listingId', 'title featuredImage pricing')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await BookingRequest.countDocuments(filter);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});

module.exports = {
  createBookingRequest,
  getPendingBookings,
  acceptBooking,
  rejectBooking,
  getAcceptedBookings,
  markBookingAsPaid,
  getBookingHistory,
  getVendorBookingHistory
};
