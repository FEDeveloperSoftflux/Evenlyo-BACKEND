const asyncHandler = require('express-async-handler');
const notificationController = require('./notificationController');
const BookingRequest = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const {checkAvailability} = require('../utils/bookingUtils')

// @desc    Leave a review and rating for a booking
// @route   POST /api/booking/:id/review
// @access  Private (Client)
const reviewBooking = asyncHandler(async (req, res) => {
  // Accept both {stars, message} and {rating, review} for flexibility
  const rating = req.body.rating || req.body.stars;
  const review = req.body.review || req.body.message;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be between 1 and 5.'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    userId: req.user.id,
    status: 'completed'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for review.'
    });
  }

  // Save review in booking feedback
  if (review) {
    booking.feedback.clientFeedback = toMultilingualText(review);
  }
  booking.feedback.rating = rating;
  await booking.save();

  // Update listing's average rating and count
  const listing = await Listing.findById(booking.listingId);
  if (listing) {
    const prevTotal = (listing.ratings.average || 0) * (listing.ratings.count || 0);
    const newCount = (listing.ratings.count || 0) + 1;
    const newAverage = (prevTotal + rating) / newCount;
    listing.ratings.average = newAverage;
    listing.ratings.count = newCount;
    await listing.save();
  }

  res.json({
    success: true,
    message: 'Review submitted successfully.',
    data: { booking }
  });
});


// Helper function to convert string to multilingual object
const toMultilingualText = (text) => {
  if (typeof text === 'string') {
    return {
      en: text,
      nl: text // Use same value for Dutch, can be translated later
    };
  }
  return text; // If already an object, return as-is
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

  // Calculate duration and multi-day details early to determine validation
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const diffTime = Math.abs(endDateObj - startDateObj);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
  const isMultiDay = diffDays > 1;

  // Validate required fields
  if (!listingId || !vendorId || !startDate || !endDate || !eventLocation) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }
  if (!isMultiDay && (!startTime || !endTime)) {
    return res.status(400).json({
      success: false,
      message: 'Start time and end time are required for single-day bookings.'
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

  // Calculate hours per day (only for single-day)
  let dailyHours = 0;
  let totalHours = 0;
  if (!isMultiDay) {
    const calculateHours = (startTime, endTime) => {
      const startTimeObj = new Date(`2000-01-01 ${startTime}`);
      const endTimeObj = new Date(`2000-01-01 ${endTime}`);
      let diffHours = (endTimeObj - startTimeObj) / (1000 * 60 * 60);
      if (diffHours < 0) diffHours += 24; // Handle overnight
      return Math.max(diffHours, 0);
    };
    dailyHours = calculateHours(startTime, endTime);
    totalHours = dailyHours;
  } else {
    dailyHours = 0;
    totalHours = 0;
  }

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

  // Transform eventType and specialRequests to multilingual format if they are strings
  let processedEventType = eventType;
  let processedSpecialRequests = specialRequests;

  // If eventType is a string, convert to multilingual object
  if (typeof eventType === 'string') {
    processedEventType = {
      en: eventType,
      nl: eventType // Use same value for Dutch, can be translated later
    };
  }

  // If specialRequests is a string, convert to multilingual object
  if (typeof specialRequests === 'string') {
    processedSpecialRequests = {
      en: specialRequests,
      nl: specialRequests // Use same value for Dutch, can be translated later
    };
  }

  // Create booking request with multi-day support
  const bookingRequest = new BookingRequest({
    userId: req.user.id,
    vendorId,
    listingId,
    details: {
      startDate,
      endDate,
      ...(isMultiDay ? {} : { startTime, endTime }),
      duration: {
        hours: dailyHours,
        days: diffDays,
        totalHours: totalHours,
        isMultiDay: isMultiDay
      },
      eventLocation,
      eventType: processedEventType,
      guestCount,
      specialRequests: processedSpecialRequests,
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

  // Notify vendor of new booking request
  try {
    const vendor = await Vendor.findById(bookingRequest.vendorId);
    if (vendor && vendor.userId) {
      await notificationController.createNotification({
        user: vendor.userId, // vendor's user account receives notification
        booking: bookingRequest._id,
        message: `You have received a new booking request.`
      });
    }
  } catch (e) {
    console.error('Failed to create vendor notification for new booking:', e);
  }
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

  // Notify vendor of payment
  try {
    const vendor = await Vendor.findById(booking.vendorId);
    if (vendor && vendor.userId) {
      await notificationController.createNotification({
        user: vendor.userId,
        booking: booking._id,
        message: `A client has paid for a booking.`
      });
    }
  } catch (e) {
    console.error('Failed to create vendor notification for paid booking:', e);
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
  const { status, page = 1, limit = 30 } = req.query;
  
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

  // Format bookings with action buttons based on status
  const formattedBookings = bookings.map(booking => {
    const bookingData = {
      _id: booking._id,
      trackingId: booking.trackingId,
      bookingDateTime: {
        start: booking.details.startDate,
        end: booking.details.endDate,
        startTime: booking.details.startTime,
        endTime: booking.details.endTime
      },
      totalPrice: booking.pricing.totalPrice,
      status: booking.status,
      vendor: booking.vendorId,
      listing: booking.listingId,
      createdAt: booking.createdAt,
      statusHistory: booking.statusHistory,
      // Action buttons based on status for client
      actionButtons: getClientActionButtons(booking.status),
      // Additional details
      eventLocation: booking.details.eventLocation,
      guestCount: booking.details.guestCount,
      specialRequests: booking.details.specialRequests,
      paymentStatus: booking.paymentStatus,
      rejectionReason: booking.rejectionReason,
      claimDetails: booking.claimDetails
    };

    return bookingData;
  });

  res.json({
    success: true,
    data: {
      bookings: formattedBookings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});

// Helper function to get action buttons for clients based on status
const getClientActionButtons = (status) => {
  const buttons = [];
  
  switch (status) {
    case 'pending':
      buttons.push({
        action: 'cancel',
        label: 'Cancel Request',
        color: 'red',
        type: 'danger'
      });
      break;
      
    case 'accepted':
      buttons.push(
        {
          action: 'pay',
          label: 'Make Payment',
          color: 'purple',
          type: 'primary'
        },
        {
          action: 'cancel',
          label: 'Cancel',
          color: 'red',
          type: 'danger'
        }
      );
      break;
      
    case 'paid':
      buttons.push({
        action: 'view_details',
        label: 'View Details',
        color: 'blue',
        type: 'info'
      });
      break;
      
    case 'on the way':
      buttons.push({
        action: 'track',
        label: 'Track Delivery',
        color: 'orange',
        type: 'info'
      });
      break;
      
    case 'received':
      buttons.push(
        {
          action: 'mark_complete',
          label: 'Mark Complete',
          color: 'green',
          type: 'success'
        },
        {
          action: 'claim',
          label: 'Report Issue',
          color: 'orange',
          type: 'warning'
        }
      );
      break;
      
    case 'picked up':
      buttons.push(
        {
          action: 'mark_complete',
          label: 'Mark Complete',
          color: 'green',
          type: 'success'
        },
        {
          action: 'claim',
          label: 'Report Issue',
          color: 'orange',
          type: 'warning'
        }
      );
      break;
      
    case 'completed':
      buttons.push(
        {
          action: 'view_invoice',
          label: 'View Invoice',
          color: 'blue',
          type: 'info'
        },
        {
          action: 'leave_review',
          label: 'Leave Review',
          color: 'purple',
          type: 'secondary'
        }
      );
      break;
      
    case 'claim':
      buttons.push({
        action: 'view_claim',
        label: 'View Claim Status',
        color: 'orange',
        type: 'warning'
      });
      break;
      
    case 'rejected':
      buttons.push({
        action: 'view_reason',
        label: 'View Rejection Reason',
        color: 'red',
        type: 'danger'
      });
      break;
      
    default:
      break;
  }
  
  return buttons;
};

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

  // Format bookings with action buttons based on status for vendor
  const formattedBookings = bookings.map(booking => {
    const bookingData = {
      _id: booking._id,
      trackingId: booking.trackingId,
      bookingDateTime: {
        start: booking.details.startDate,
        end: booking.details.endDate,
        startTime: booking.details.startTime,
        endTime: booking.details.endTime
      },
      totalPrice: booking.pricing.totalPrice,
      status: booking.status,
      client: booking.userId,
      listing: booking.listingId,
      createdAt: booking.createdAt,
      statusHistory: booking.statusHistory,
      // Action buttons based on status for vendor
      actionButtons: getVendorActionButtons(booking.status),
      // Additional details
      eventLocation: booking.details.eventLocation,
      guestCount: booking.details.guestCount,
      specialRequests: booking.details.specialRequests,
      paymentStatus: booking.paymentStatus,
      rejectionReason: booking.rejectionReason,
      claimDetails: booking.claimDetails
    };

    return bookingData;
  });

  res.json({
    success: true,
    data: {
      bookings: formattedBookings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    }
  });
});

// @desc    Mark booking as received (Client action)
// @route   POST /api/bookzing/:id/mark-received
// @access  Private (Client)
const markBookingReceived = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    userId: req.user.id,
    status: 'on_the_way'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for this action'
    });
  }

  booking.status = 'received';
  booking.deliveryDetails.deliveryTime = new Date();
  await booking.save();

  // Notify vendor that booking is received
  try {
    const vendor = await Vendor.findById(booking.vendorId);
    if (vendor && vendor.userId) {
      await notificationController.createNotification({
        user: vendor.userId,
        bookingId: booking._id,
        message: `A client has marked the booking as received.`
      });
    }
  } catch (e) {
    console.error('Failed to create vendor notification for received booking:', e);
  }
  res.json({
    success: true,
    message: 'Booking marked as received',
    data: { booking }
  });
});

// @desc    Mark booking as complete (Client action)
// @route   POST /api/booking/:id/mark-complete
// @access  Private (Client)
const markBookingComplete = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    userId: req.user.id,
    status: { $in: ['received', 'picked_up'] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for this action'
    });
  }

  booking.status = 'completed';
  await booking.save();

  // Notify vendor that booking is completed
  try {
    const vendor = await Vendor.findById(booking.vendorId);
    if (vendor && vendor.userId) {
      await notificationController.createNotification({
        user: vendor.userId,
        bookingId: booking._id,
        message: `A booking has been marked as completed.`
      });
    }
  } catch (e) {
    console.error('Failed to create vendor notification for completed booking:', e);
  }
  res.json({
    success: true,
    message: 'Booking marked as complete',
    data: { booking }
  });
});

// @desc    Create a claim (Client action)
// @route   POST /api/booking/:id/claim
// @access  Private (Client)
const createClaim = asyncHandler(async (req, res) => {
  const { reason, claimType } = req.body;

  if (!reason || !reason.en) {
    return res.status(400).json({
      success: false,
      message: 'Claim reason is required'
    });
  }

  if (!claimType) {
    return res.status(400).json({
      success: false,
      message: 'Claim type is required'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    userId: req.user.id,
    status: { $in: ['received', 'picked_up', 'completed'] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for claim'
    });
  }

  booking.status = 'claim';
  booking.claimDetails = {
    reason: reason,
    claimType: claimType,
    claimedBy: 'client',
    claimedAt: new Date(),
    status: 'pending'
  };

  await booking.save();

  // TODO: Send email notification to admin about the claim

  res.json({
    success: true,
    message: 'Claim created successfully. Admin will review and contact you.',
    data: { booking }
  });
});

// @desc    Cancel a booking (Client action, only within 30 min)
// @route   POST /api/booking/:id/cancel
// @access  Private (Client)
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    userId: req.user.id,
    status: { $in: ['pending', 'accepted', 'paid'] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for cancellation.'
    });
  }

  // Check if within 30 minutes of creation
  const now = new Date();
  const createdAt = new Date(booking.createdAt);
  const diffMinutes = (now - createdAt) / (1000 * 60);
  if (diffMinutes > 30) {
    return res.status(400).json({
      success: false,
      message: 'Cancellation period expired. You can only cancel within 30 minutes of booking.'
    });
  }

  booking.status = 'cancelled';
  booking.statusHistory.push({
    status: 'cancelled',
    updatedBy: {
      userId: req.user.id,
      userType: 'client',
      name: req.user.firstName + ' ' + req.user.lastName
    },
    notes: {
      en: 'Booking cancelled by client',
      nl: 'Boeking geannuleerd door klant'
    }
  });
  await booking.save();

  // TODO: Send notification to vendor/admin if needed

  res.json({
    success: true,
    message: 'Booking cancelled successfully.',
    data: { booking }
  });
});
// @desc    Get booking details
// @route   GET /api/booking/:id
// @access  Private (User/Vendor)
const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findById(req.params.id)
    .populate('userId', 'firstName lastName email contactNumber')
    .populate('vendorId', 'businessName businessEmail businessPhone')
    .populate('listingId', 'title featuredImage pricing description');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user has access to this booking
  const vendor = await Vendor.findOne({ userId: req.user.id });
  const hasAccess = booking.userId._id.toString() === req.user.id || 
                   (vendor && booking.vendorId._id.toString() === vendor._id.toString());

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Determine user type and get appropriate action buttons
  const isVendor = vendor && booking.vendorId._id.toString() === vendor._id.toString();
  const actionButtons = isVendor ? getVendorActionButtons(booking.status) : getClientActionButtons(booking.status);

  const bookingData = {
    _id: booking._id,
    trackingId: booking.trackingId,
    bookingDateTime: {
      start: booking.details.startDate,
      end: booking.details.endDate,
      startTime: booking.details.startTime,
      endTime: booking.details.endTime
    },
    totalPrice: booking.pricing.totalPrice,
    status: booking.status,
    client: booking.userId,
    vendor: booking.vendorId,
    listing: booking.listingId,
    createdAt: booking.createdAt,
    statusHistory: booking.statusHistory,
    actionButtons: actionButtons,
    eventLocation: booking.details.eventLocation,
    guestCount: booking.details.guestCount,
    specialRequests: booking.details.specialRequests,
    paymentStatus: booking.paymentStatus,
    rejectionReason: booking.rejectionReason,
    claimDetails: booking.claimDetails,
    deliveryDetails: booking.deliveryDetails,
    feedback: booking.feedback
  };

  res.json({
    success: true,
    data: { booking: bookingData }
  });
});

module.exports = {
  createBookingRequest,
  getPendingBookings,
  getAcceptedBookings,
  markBookingAsPaid,
  getBookingHistory,
  getVendorBookingHistory,
  markBookingReceived,
  markBookingComplete,
  createClaim,
  getBookingDetails,
  cancelBooking,
  reviewBooking
};
