
const asyncHandler = require('express-async-handler');
const BookingRequest = require('../models/Booking');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

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

// Helper function to check listing availability for multi-day bookings
const checkAvailability = async (listingId, startDate, endDate, excludeBookingId = null) => {
  // Normalize dates to start of day for accurate comparison
  const checkStart = new Date(startDate);
  checkStart.setHours(0, 0, 0, 0);
  
  const checkEnd = new Date(endDate);
  checkEnd.setHours(23, 59, 59, 999);
  
  // Build query to check for overlapping bookings
  const query = {
    listingId,
    status: { $nin: ['rejected', 'cancelled'] },
    $or: [
      {
        // Booking starts before our period ends and ends after our period starts
        'details.startDate': { $lte: checkEnd },
        'details.endDate': { $gte: checkStart }
      }
    ]
  };

  // Exclude current booking if specified (when checking during acceptance)
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  // Check for overlapping bookings that are not rejected or cancelled
  const overlappingBookings = await BookingRequest.find(query)
    .select('details.startDate details.endDate status trackingId');

  // If any overlapping bookings found, list them for debugging
  if (overlappingBookings.length > 0) {
    console.log('Conflicting bookings found for listing', listingId + ':');
    overlappingBookings.forEach(booking => {
      console.log(`- Booking ${booking.trackingId}: ${booking.details.startDate} to ${booking.details.endDate} (${booking.status})`);
    });
    console.log(`Checking availability for: ${checkStart} to ${checkEnd}${excludeBookingId ? ` (excluding ${excludeBookingId})` : ''}`);
  }

  return overlappingBookings.length === 0;
};

// Helper function to get detailed availability information
const getAvailabilityDetails = async (listingId, startDate, endDate, excludeBookingId = null) => {
  const isAvailable = await checkAvailability(listingId, startDate, endDate, excludeBookingId);
  
  if (!isAvailable) {
    // Get conflicting bookings for detailed response
    const query = {
      listingId,
      status: { $nin: ['rejected', 'cancelled'] },
      $or: [
        {
          'details.startDate': { $lte: new Date(endDate) },
          'details.endDate': { $gte: new Date(startDate) }
        }
      ]
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflictingBookings = await BookingRequest.find(query)
      .select('details.startDate details.endDate status trackingId')
      .lean();

    return {
      isAvailable: false,
      conflictingBookings: conflictingBookings.map(booking => ({
        trackingId: booking.trackingId,
        startDate: booking.details.startDate,
        endDate: booking.details.endDate,
        status: booking.status
      }))
    };
  }

  return { isAvailable: true, conflictingBookings: [] };
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

  // Double-check availability before accepting (exclude current booking from check)
  const availabilityResult = await getAvailabilityDetails(
    booking.listingId,
    booking.details.startDate,
    booking.details.endDate,
    booking._id // Exclude the current booking from conflict check
  );

  if (!availabilityResult.isAvailable) {
    console.log(`Booking acceptance failed for booking ${id}: conflicting bookings found for listing ${booking.listingId}`);
    return res.status(409).json({
      success: false,
      message: 'Booking is no longer available due to conflicting bookings',
      details: 'Another booking has been accepted for overlapping dates. Please check the booking calendar and try a different time slot.',
      conflictingBookings: availabilityResult.conflictingBookings
    });
  }

  console.log(`Accepting booking ${id} for vendor ${vendor._id}`);
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

// Helper function to get action buttons for vendors based on status
const getVendorActionButtons = (status) => {
  const buttons = [];
  
  switch (status) {
    case 'pending':
      buttons.push(
        {
          action: 'accept',
          label: 'Accept',
          color: 'green',
          type: 'success'
        },
        {
          action: 'reject',
          label: 'Reject',
          color: 'red',
          type: 'danger'
        }
      );
      break;
      
    case 'accepted':
      buttons.push({
        action: 'view_details',
        label: 'View Details',
        color: 'blue',
        type: 'info'
      });
      break;
      
    case 'paid':
      buttons.push(
        {
          action: 'mark_on_the_way',
          label: 'Mark On The Way',
          color: 'brown',
          type: 'warning'
        },
        {
          action: 'view_details',
          label: 'View Details',
          color: 'blue',
          type: 'info'
        }
      );
      break;
      
    case 'on_the_way':
      buttons.push({
        action: 'view_delivery_status',
        label: 'View Delivery Status',
        color: 'brown',
        type: 'info'
      });
      break;
      
    case 'received':
      buttons.push({
        action: 'mark_picked_up',
        label: 'Mark Picked Up',
        color: 'darkblue',
        type: 'primary'
      });
      break;
      
    case 'picked_up':
      buttons.push({
        action: 'view_status',
        label: 'View Status',
        color: 'blue',
        type: 'info'
      });
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
          action: 'view_review',
          label: 'View Review',
          color: 'purple',
          type: 'secondary'
        }
      );
      break;
      
    case 'claim':
      buttons.push({
        action: 'view_claim',
        label: 'View Claim Details',
        color: 'orange',
        type: 'warning'
      });
      break;
      
    case 'rejected':
      buttons.push({
        action: 'view_details',
        label: 'View Details',
        color: 'gray',
        type: 'secondary'
      });
      break;
      
    default:
      break;
  }
  
  return buttons;
};

// @desc    Mark booking as on the way (Vendor action)
// @route   POST /api/booking/:id/mark-on-the-way
// @access  Private (Vendor)
const markBookingOnTheWay = asyncHandler(async (req, res) => {
  const { driverInfo } = req.body;
  
  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    vendorId: vendor._id,
    status: 'paid'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for this action'
    });
  }

  booking.status = 'on_the_way';
  if (driverInfo) {
    booking.deliveryDetails.driverInfo = driverInfo;
  }
  booking.deliveryDetails.pickupTime = new Date();

  await booking.save();

  res.json({
    success: true,
    message: 'Booking marked as on the way',
    data: { booking }
  });
});

// @desc    Mark booking as received (Client action)
// @route   POST /api/booking/:id/mark-received
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

  res.json({
    success: true,
    message: 'Booking marked as received',
    data: { booking }
  });
});

// @desc    Mark booking as picked up (Vendor action)
// @route   POST /api/booking/:id/mark-picked-up
// @access  Private (Vendor)
const markBookingPickedUp = asyncHandler(async (req, res) => {
  const { verificationNotes } = req.body;
  
  // Get vendor profile
  const vendor = await Vendor.findOne({ userId: req.user.id });
  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: 'Vendor profile not found'
    });
  }

  const booking = await BookingRequest.findOne({
    _id: req.params.id,
    vendorId: vendor._id,
    status: 'received'
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found or not eligible for this action'
    });
  }

  booking.status = 'picked_up';
  booking.deliveryDetails.returnTime = new Date();
  if (verificationNotes) {
    booking.feedback.vendorFeedback = toMultilingualText(verificationNotes);
  }

  await booking.save();

  res.json({
    success: true,
    message: 'Booking marked as picked up',
    data: { booking }
  });
});

// @desc    Mark booking as complete (Client action)
// @route   POST /api/booking/:id/mark-complete
// @access  Private (Client)
const markBookingComplete = asyncHandler(async (req, res) => {
  const { review, rating } = req.body;
  
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
  if (review) {
    booking.feedback.clientFeedback = toMultilingualText(review);
  }

  await booking.save();

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
  acceptBooking,
  rejectBooking,
  getAcceptedBookings,
  markBookingAsPaid,
  getBookingHistory,
  getVendorBookingHistory,
  markBookingOnTheWay,
  markBookingReceived,
  markBookingPickedUp,
  markBookingComplete,
  createClaim,
  getBookingDetails,
  cancelBooking
};
