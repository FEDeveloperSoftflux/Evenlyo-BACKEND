const asyncHandler = require('express-async-handler');
const notificationController = require('../notificationController');
const BookingRequest = require('../../models/Booking');
const Listing = require('../../models/Listing');
const User = require('../../models/User');
const Vendor = require('../../models/Vendor');
const Settings = require('../../models/Settings');
const {checkAvailability,calculateFullBookingPrice, checkListingStock} = require('../../utils/bookingUtils');
const {toMultilingualText} = require('../../utils/textUtils');
const stripe = require('../../config/stripe');

// @desc    Create Stripe PaymentIntent for a booking
// @route   POST /api/booking/:id/create-payment-intent
// @access  Private (User)
const createBookingPaymentIntent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Find the booking by ID and user
  const booking = await BookingRequest.findOne({
    _id: id,
    userId: req.user.id
  });
  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }
  // Get amount from booking (assume pricing.totalPrice exists)
  const amount = Math.round((booking.pricing?.totalPrice || 0) * 100); // cents
  if (!amount || amount < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid booking amount'
    });
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
  bookingId: booking._id ? booking._id.toString() : '',
  userId: booking.userId ? (booking.userId._id ? booking.userId._id.toString() : booking.userId.toString()) : ''
      }
    });
    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

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
    status: 'finished'
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

  // Update vendor's average rating, total reviews, and add review to reviews array
  const vendor = await Vendor.findById(booking.vendorId);
  if (vendor) {
    const prevTotal = (vendor.rating.average || 0) * (vendor.rating.totalReviews || 0);
    const newCount = (vendor.rating.totalReviews || 0) + 1;
    const newAverage = (prevTotal + rating) / newCount;
    vendor.rating.average = newAverage;
    vendor.rating.totalReviews = newCount;
    
    // Add review to vendor's reviews array
    vendor.reviews.push({
      bookingId: booking._id,
      clientId: booking.userId,
      rating: rating,
      review: review ? toMultilingualText(review) : undefined
    });
    
    await vendor.save();
  }

    // Update listing's average rating, total reviews, and add review to reviews array
    const listing = await Listing.findById(booking.listingId);
    if (listing) {
      const prevTotal = (listing.rating?.average || 0) * (listing.rating?.totalReviews || 0);
      const newCount = (listing.rating?.totalReviews || 0) + 1;
      const newAverage = (prevTotal + rating) / newCount;
      listing.rating = listing.rating || {};
      listing.rating.average = newAverage;
      listing.rating.totalReviews = newCount;
      // Add review to listing's reviews array
      listing.reviews = listing.reviews || [];
      listing.reviews.push({
        bookingId: booking._id,
        clientId: booking.userId,
        rating: rating,
        review: review ? toMultilingualText(review) : undefined
      });
      await listing.save();
    }

  res.json({
    success: true,
    message: 'Review submitted successfully.',
    data: { booking }
  });
});

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
      distanceKm,
      specialRequests
    }
  } = req.body;

  // Calculate duration and multi-day details early to determine validation
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const diffTime = Math.abs(endDateObj - startDateObj);
  let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
  let isMultiDay = diffDays > 1;

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
  }).populate('vendor')
    .populate('category', 'name')
    .populate('subCategory', 'name');

  if (!listing) {
    return res.status(404).json({
      success: false,
      message: 'Listing not found or not available'
    });
  }

  // Check stock before proceeding (default required quantity = 1, allow override from body.quantity)
  const requestedQty = 1;
  const stock = await checkListingStock(listingId, requestedQty);
  if (!stock.ok) {
    return res.status(400).json({ success: false, message: stock.message, availableQty: stock.availableQty });
  }

  // If listing charges per km, require distanceKm in request details
  if (typeof distanceKm === 'undefined' || isNaN(Number(distanceKm)) || Number(distanceKm) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'distanceKm is required and must be a positive number for this listing.'
    });
  }

  // Verify vendor matches (guard for missing vendor)
  if (!listing.vendor || !listing.vendor._id || listing.vendor._id.toString() !== vendorId) {
    return res.status(400).json({
      success: false,
      message: 'Vendor mismatch'
    });
  }

  // Check availability for all days in the range, including time slots for single-day bookings
  const isAvailable = await checkAvailability(
    listingId, 
    new Date(startDate), 
    new Date(endDate), 
    null, // excludeBookingId
    startTime, // pass startTime for time slot validation
    endTime    // pass endTime for time slot validation
  );
  if (!isAvailable) {
    return res.status(409).json({
      success: false,
      message: 'Selected dates/times are not available. The time slot may be outside available hours or already booked.'
    });
  }

  // Calculate hours per day and total hours depending on presence of times and multi-day
  let dailyHours = 0;
  let totalHours = 0;
  const calculateHours = (startTime, endTime) => {
    const startTimeObj = new Date(`2000-01-01 ${startTime}`);
    const endTimeObj = new Date(`2000-01-01 ${endTime}`);
    let diffHours = (endTimeObj - startTimeObj) / (1000 * 60 * 60);
    if (diffHours < 0) diffHours += 24; // Handle overnight
    return Math.max(diffHours, 0);
  };

  if (startTime && endTime) {
    // We have times; compute daily hours and total hours across days
    dailyHours = calculateHours(startTime, endTime);
    totalHours = isMultiDay ? dailyHours * diffDays : dailyHours;
  } else {
    // No times provided. For per-hour pricing assume full days = 24 hours per day
    dailyHours = isMultiDay ? 24 : 0; // if single-day and no times, leave dailyHours 0 but totalHours as 24
    totalHours = diffDays * 24;
  }

  // Fetch platform fee from Settings
    const settings = await Settings.findOne();
    let platformFeePercent = 0.015; // default 1.5%
    if (settings && typeof settings.bookingItemPlatformFee === 'number') {
      platformFeePercent = settings.bookingItemPlatformFee;
    }

  // Calculate pricing using utility
  const pricingResult = calculateFullBookingPrice(listing, { startDate, endDate, startTime, endTime, distanceKm });

  if (pricingResult && pricingResult.error) {
    return res.status(pricingResult.status || 400).json({ success: false, message: pricingResult.error });
  }

  const bookingPrice = pricingResult.bookingPrice;
  const platformFee = Math.round(bookingPrice * platformFeePercent) / 100;
  const extratimeCost = pricingResult.extratimeCost;
  const securityFee = pricingResult.securityFee;
  const kmCharge = pricingResult.kmCharge;
  const subtotal = bookingPrice + extratimeCost + securityFee + kmCharge ;
  const totalPrice = subtotal + platformFee;
  dailyHours = pricingResult.dailyHours;
  totalHours = pricingResult.totalHours;
  diffDays = pricingResult.diffDays;
  isMultiDay = pricingResult.isMultiDay;

  // Calculate platform fee as percentage of booking price
  

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
    listingDetails: {
      title: listing.title,
      subtitle: listing.subtitle,
      description: listing.description,
      featuredImage: listing.images && listing.images.length > 0 ? listing.images[0] : '',
      images: listing.images || [],
      pricing: {
        type: listing.pricing.type,
        amount: listing.pricing.amount,
        extratimeCost: listing.pricing.extratimeCost || 0,
        securityFee: listing.pricing.securityFee || 0,
        pricePerKm: listing.pricing.pricePerKm || 0
      },
      category: listing.category ? {
        _id: listing.category._id,
        name: listing.category.name
      } : '',
      subCategory: listing.subCategory ? {
        _id: listing.subCategory._id,
        name: listing.subCategory.name
      } : '',
      serviceDetails: {
        serviceType: listing.serviceDetails?.serviceType
      },
      location: {
        fullAddress: listing.location?.fullAddress,
        coordinates: {
          latitude: listing.location?.coordinates?.latitude,
          longitude: listing.location?.coordinates?.longitude
        }
      },
      contact: {
        phone: listing.contact?.phone,
        email: listing.contact?.email,
        website: listing.contact?.website
      },
      features: listing.features || [],
      rating: {
        average: listing.rating?.average || 0,
        totalReviews: listing.rating?.totalReviews || 0
      }
    },
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

    },
    pricing: {
      type: listing.pricing.type,
      amount: listing.pricing.amount,
      extratimeCost: extratimeCost,
      securityPrice: securityFee,
      extraCharges: 0,
      subtotal: subtotal,
      pricePerKm: listing.pricing.pricePerKm || 0,
      distanceKm: Number(distanceKm) || 0,
      kmCharge: kmCharge,
      bookingPrice: bookingPrice,
      extratimeCostApplied: extratimeCost,
      totalPrice: totalPrice,
      platformFee: platformFee,
      // Optionally add dailyRate for multi-day
      ...(isMultiDay && {
        dailyRate: Math.round(bookingPrice / diffDays)
      })
    },
    platformFee
  });

  await bookingRequest.save();

  // Notify vendor of new booking request
  try {
    const vendor = await Vendor.findById(bookingRequest.vendorId);
    const client = await User.findById(bookingRequest.userId).select('firstName lastName');
    
    if (vendor && vendor.userId) {
      const clientName = client ? `${client.firstName} ${client.lastName}` : 'A client';
      const listingTitle = listing.title || 'your listing';
      const bookingDates = `${startDate}${endDate !== startDate ? ` to ${endDate}` : ''}`;
      
      await notificationController.createNotification({
        user: vendor.userId, // vendor's user account receives notification
        bookingId: bookingRequest._id,
        message: `New booking request from ${clientName} for "${listingTitle}" on ${bookingDates}. Tracking ID: ${bookingRequest.trackingId}`
      });
    }
  } catch (e) {
    console.error('Failed to create vendor notification for new booking:', e);
  }
  // Populate the response (listing details are now stored directly in listingDetails field)
  await bookingRequest.populate([
    { path: 'userId', select: 'firstName lastName email contactNumber' },
    { path: 'vendorId', select: 'businessName businessEmail businessPhone' }
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
        bookingId : booking._id,
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
    .populate('vendorId', 'businessName businessEmail businessPhone businessLogo')
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
      claimDetails: booking.claimDetails,
      images: booking.images || [],
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
          action: 'mark_finished',
          label: 'Mark Finished',
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
const markBookingFinished = asyncHandler(async (req, res) => {
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

  booking.status = 'finished';
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

  // Notify admins that booking is completed
  try {
    await notificationController.createAdminNotification({
      message: `A booking has been marked as completed by the client.`,
      bookingId: booking._id
    });
  } catch (e) {
    console.error('Failed to create admin notification for completed booking:', e);
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
    status: { $in: ['received', 'finished', 'paid'] }
  });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not eligible for Complaint'
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

  // Accept cancellation reason from request body (optional)
  let reason = req.body && req.body.reason;
  let notes = {
    en: 'Booking cancelled by client',
    nl: 'Boeking geannuleerd door klant'
  };
  if (reason) {
    if (typeof reason === 'object' && (reason.en || reason.nl)) {
      notes = {
        en: reason.en || notes.en,
        nl: reason.nl || notes.nl
      };
    } else if (typeof reason === 'string') {
      notes = {
        en: reason,
        nl: reason // Use same for Dutch, can be translated later
      };
    }
  }

  booking.status = 'cancelled';
  booking.statusHistory.push({
    status: 'cancelled',
    updatedBy: {
      userId: req.user.id,
      userType: 'client',
      name: req.user.firstName + ' ' + req.user.lastName
    },
    notes: notes
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
    .populate('vendorId', 'businessName businessEmail businessPhone');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Check if user has access to this booking
  const vendor = await Vendor.findOne({ userId: req.user.id });
  const bookingUserIdStr = booking.userId && booking.userId._id ? booking.userId._id.toString() : (booking.userId ? booking.userId.toString() : '');
  const bookingVendorIdStr = booking.vendorId && booking.vendorId._id ? booking.vendorId._id.toString() : (booking.vendorId ? booking.vendorId.toString() : '');
  const vendorIdStr = vendor && vendor._id ? vendor._id.toString() : '';

  const hasAccess = (bookingUserIdStr && bookingUserIdStr === req.user.id) || (vendorIdStr && bookingVendorIdStr && bookingVendorIdStr === vendorIdStr);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Determine user type and get appropriate action buttons
  const isVendor = vendor && booking.vendorId && booking.vendorId._id && vendor._id && booking.vendorId._id.toString() === vendor._id.toString();
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

// @desc    Get booking summary (tracking id, client name, client phone, total price, status history)
// @route   GET /api/booking/:id/summary
// @access  Private (User/Vendor)
const getBookingSummary = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findById(req.params.id)
    .populate('userId', 'firstName lastName contactNumber')
    .populate('vendorId', 'businessName businessPhone')
    .populate('listingId');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Access control: allow client who created booking or vendor who owns it
  const vendor = await Vendor.findOne({ userId: req.user.id });
  const bookingUserIdStr = booking.userId && booking.userId._id ? booking.userId._id.toString() : (booking.userId ? booking.userId.toString() : '');
  const bookingVendorIdStr = booking.vendorId && booking.vendorId._id ? booking.vendorId._id.toString() : (booking.vendorId ? booking.vendorId.toString() : '');
  const vendorIdStr = vendor && vendor._id ? vendor._id.toString() : '';

  const hasAccess = (bookingUserIdStr && bookingUserIdStr === req.user.id) || (vendorIdStr && bookingVendorIdStr && bookingVendorIdStr === vendorIdStr);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const clientName = booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : '';
  const clientPhone = booking.userId ? (booking.userId.contactNumber || '') : '';

  // Build listing object with requested fields
  let listingObj = null;
  if (booking.listingId) {
    const listing = booking.listingId;
    // Title fallback: if title is a string, wrap into {en,nl}
    let titleObj = listing.title;
    if (!titleObj) {
      titleObj = { en: '', nl: '' };
    } else if (typeof titleObj === 'string') {
      titleObj = { en: titleObj, nl: titleObj };
    } else {
      // Ensure both en and nl exist
      titleObj = {
        en: titleObj.en || '',
        nl: titleObj.nl || (titleObj.en || '')
      };
    }

    listingObj = {
      title: titleObj,
      location: {
        fullAddress: listing.location && listing.location.fullAddress ? listing.location.fullAddress : '',
        coordinates: listing.location && listing.location.coordinates ? listing.location.coordinates : { latitude: null, longitude: null }
      },
  images: (Array.isArray(listing.images) && listing.images.length > 0) ? listing.images[0] : (listing.images ? (typeof listing.images === 'string' ? listing.images : '') : '')
    };
  }

  // Booking location: eventLocation (string) + coordinates if present in listing.location
  const bookingLocation = {
    eventLocation: booking.details && booking.details.eventLocation ? booking.details.eventLocation : '',
  };

  const summary = {
    trackingId: booking.trackingId,
    clientName: clientName,
    clientPhone: clientPhone,
    totalPrice: booking.pricing && typeof booking.pricing.totalPrice !== 'undefined' ? booking.pricing.totalPrice : booking.pricing && booking.pricing.bookingPrice ? booking.pricing.bookingPrice : (booking.pricing && booking.pricing.totalPrice ? booking.pricing.totalPrice : null),
    statusHistory: booking.statusHistory || []
  };

  const direction = {
    listing: listingObj,
    bookingLocation: bookingLocation
  };

  res.json({ success: true, data: { summary, direction } });
});

const TrackBooking = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findById(req.params.id)
    .populate('userId', 'firstName lastName contactNumber')
    .populate('vendorId', 'businessName businessPhone')
    .populate('listingId');

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
  }

  // Access control: allow client who created booking or vendor who owns it
  const vendor = await Vendor.findOne({ userId: req.user.id });
  const bookingUserIdStr = booking.userId && booking.userId._id ? booking.userId._id.toString() : (booking.userId ? booking.userId.toString() : '');
  const bookingVendorIdStr = booking.vendorId && booking.vendorId._id ? booking.vendorId._id.toString() : (booking.vendorId ? booking.vendorId.toString() : '');
  const vendorIdStr = vendor && vendor._id ? vendor._id.toString() : '';

  const hasAccess = (bookingUserIdStr && bookingUserIdStr === req.user.id) || (vendorIdStr && bookingVendorIdStr && bookingVendorIdStr === vendorIdStr);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const clientName = booking.userId ? `${booking.userId.firstName || ''} ${booking.userId.lastName || ''}`.trim() : '';
  const clientPhone = booking.userId ? (booking.userId.contactNumber || '') : '';

  // Build listing object with requested fields
  let listingObj = null;
  if (booking.listingId) {
    const listing = booking.listingId;
    // Title fallback: if title is a string, wrap into {en,nl}
    let titleObj = listing.title;
    if (!titleObj) {
      titleObj = { en: '', nl: '' };
    } else if (typeof titleObj === 'string') {
      titleObj = { en: titleObj, nl: titleObj };
    } else {
      // Ensure both en and nl exist
      titleObj = {
        en: titleObj.en || '',
        nl: titleObj.nl || (titleObj.en || '')
      };
    }

    listingObj = {
      title: titleObj,
      location: {
        fullAddress: listing.location && listing.location.fullAddress ? listing.location.fullAddress : '',
        coordinates: listing.location && listing.location.coordinates ? listing.location.coordinates : { latitude: null, longitude: null }
      },
  images: (Array.isArray(listing.images) && listing.images.length > 0) ? listing.images[0] : (listing.images ? (typeof listing.images === 'string' ? listing.images : '') : '')
    };
  }

  // Booking location: eventLocation (string) + coordinates if present in listing.location
  const bookingLocation = {
    eventLocation: booking.details && booking.details.eventLocation ? booking.details.eventLocation : '',
  };

  // Only return direction object with listing.title, listing.location, listing.images, and bookingLocation.eventLocation
  const directionOnly = {
    listing: listingObj ? {
      title: listingObj.title,
      location: listingObj.location,
      images: listingObj.images
    } : null,
    bookingLocation: {
      eventLocation: bookingLocation.eventLocation || ''
    }
  };

  res.json({ success: true, data: { direction: directionOnly } });
});


module.exports = {
  createBookingRequest,
  getPendingBookings,
  getAcceptedBookings,
  markBookingAsPaid,
  getBookingHistory,
  getVendorBookingHistory,
  markBookingReceived,
  markBookingFinished,
  createClaim,
  getBookingDetails,
  cancelBooking,
  reviewBooking,
  createBookingPaymentIntent,
  getBookingSummary,
  TrackBooking,
};


// @desc    Get simplified booking details for client/vendor
// @route   GET /api/booking/:id/details
// @access  Private (User/Vendor)
const getBookingSimpleDetails = asyncHandler(async (req, res) => {
  const booking = await BookingRequest.findById(req.params.id)
    .populate('vendorId')
    .populate('listingId');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found' });
  }

  // Access control: allow client who created booking or vendor who owns it
  const vendor = await Vendor.findOne({ userId: req.user.id });
  const bookingUserIdStr = booking.userId && booking.userId._id ? booking.userId._id.toString() : (booking.userId ? booking.userId.toString() : '');
  const bookingVendorIdStr = booking.vendorId && booking.vendorId._id ? booking.vendorId._id.toString() : (booking.vendorId ? booking.vendorId.toString() : '');
  const vendorIdStr = vendor && vendor._id ? vendor._id.toString() : '';

  const hasAccess = (bookingUserIdStr && bookingUserIdStr === req.user.id) || (vendorIdStr && bookingVendorIdStr && bookingVendorIdStr === vendorIdStr);

  if (!hasAccess) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Vendor info
  const vendorName = booking.vendorId ? (booking.vendorId.businessName || `${booking.vendorId.firstName || ''} ${booking.vendorId.lastName || ''}`.trim()) : '';
  const vendorLogo = booking.vendorId ? (booking.vendorId.businessLogo || booking.vendorId.logo || '') : '';
  const vendorDescription = booking.vendorId ? (booking.vendorId.description || booking.vendorId.businessDescription || '') : '';

  // Listing title and location
  let listingTitle = '';
  if (booking.listingId) {
    if (typeof booking.listingId.title === 'string') listingTitle = booking.listingId.title;
    else if (booking.listingId.title && booking.listingId.title.en) listingTitle = booking.listingId.title.en;
  }

  const listingLocation = booking.listingId && booking.listingId.location ? booking.listingId.location : { fullAddress: '', coordinates: { latitude: null, longitude: null } };

  // Booking pricing: try totalPrice then bookingPrice
  const bookingTotalPrice = booking.pricing && (typeof booking.pricing.totalPrice !== 'undefined') ? booking.pricing.totalPrice : (booking.pricing && booking.pricing.bookingPrice ? booking.pricing.bookingPrice : null);

  const result = {
    startDate: booking.details && booking.details.startDate ? booking.details.startDate : '',
    endDate: booking.details && booking.details.endDate ? booking.details.endDate : '',
    startTime: booking.details && booking.details.startTime ? booking.details.startTime : '',
    endTime: booking.details && booking.details.endTime ? booking.details.endTime : '',
    vendorName,
    vendorLogo,
    vendorDescription,
    listingTitle,
    bookingTotalPrice,
    listingLocation,
    // Ensure listing images is always an array
    listingImages: booking.listingId && booking.listingId.images ? (Array.isArray(booking.listingId.images) ? booking.listingId.images : [booking.listingId.images]) : []
  };

  res.json({ success: true, data: result });
});

// add to exports
module.exports.getBookingSimpleDetails = getBookingSimpleDetails;
