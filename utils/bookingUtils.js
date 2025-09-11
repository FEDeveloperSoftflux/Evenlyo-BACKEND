const BookingRequest = require('../models/Booking');

/**
 * Check if a listing is available for the given date range
 * @param {string} listingId - The listing ID to check
 * @param {Date} startDate - Start date of the booking
 * @param {Date} endDate - End date of the booking
 * @returns {Promise<boolean>} - True if available, false if conflicting bookings exist
 */
const checkListingAvailability = async (listingId, startDate, endDate) => {
  try {
    // Check for overlapping bookings that are not rejected or cancelled
    const overlappingBookings = await BookingRequest.find({
      listingId,
      status: { $nin: ['rejected', 'cancelled'] },
      $or: [
        {
          'details.startDate': { $lte: endDate },
          'details.endDate': { $gte: startDate }
        }
      ]
    });

    return overlappingBookings.length === 0;
  } catch (error) {
    console.error('Error checking listing availability:', error);
    throw new Error('Failed to check availability');
  }
};

/**
 * Get conflicting bookings for a listing in the given date range
 * @param {string} listingId - The listing ID to check
 * @param {Date} startDate - Start date of the booking
 * @param {Date} endDate - End date of the booking
 * @returns {Promise<Array>} - Array of conflicting bookings
 */
const getConflictingBookings = async (listingId, startDate, endDate) => {
  try {
    const conflictingBookings = await BookingRequest.find({
      listingId,
      status: { $nin: ['rejected', 'cancelled'] },
      $or: [
        {
          'details.startDate': { $lte: endDate },
          'details.endDate': { $gte: startDate }
        }
      ]
    }).select('details.startDate details.endDate status trackingId userId')
    .populate('userId', 'firstName lastName');

    return conflictingBookings;
  } catch (error) {
    console.error('Error getting conflicting bookings:', error);
    throw new Error('Failed to get conflicting bookings');
  }
};

/**
 * Calculate duration between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} - Object containing hours and days
 */
const calculateDuration = (startDate, endDate) => {
  const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const diffHours = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60)));

  return {
    hours: diffHours,
    days: diffDays
  };
};

/**
 * Calculate booking price based on listing pricing and duration
 * @param {Object} listing - The listing object
 * @param {Object} duration - Duration object with hours and days
 * @returns {number} - Calculated price
 */
const calculateBookingPrice = (listing, duration) => {
  let bookingPrice = 0;

  if (listing.pricing.type === 'daily' && listing.pricing.perDay) {
    bookingPrice = listing.pricing.perDay * duration.days;
  } else if (listing.pricing.type === 'hourly' && listing.pricing.perHour) {
    bookingPrice = listing.pricing.perHour * duration.hours;
  } else if (listing.pricing.type === 'per_event' && listing.pricing.perEvent) {
    bookingPrice = listing.pricing.perEvent;
  } else if (listing.pricing.type === 'package' && listing.pricing.packages && listing.pricing.packages.length > 0) {
    // Default to first package price if no specific package is selected
    bookingPrice = listing.pricing.packages[0].price;
  }

  return bookingPrice;
};

/**
 * Validate booking details
 * @param {Object} details - Booking details object
 * @returns {Object} - Validation result with isValid and errors
 */
const validateBookingDetails = (details) => {
  const errors = [];
  
  if (!details.startDate) {
    errors.push('Start date is required');
  }
  
  if (!details.endDate) {
    errors.push('End date is required');
  }
  
  if (!details.startTime) {
    errors.push('Start time is required');
  }
  
  if (!details.endTime) {
    errors.push('End time is required');
  }
  
  if (!details.eventLocation) {
    errors.push('Event location is required');
  }

  // Validate date range
  if (details.startDate && details.endDate) {
    const start = new Date(details.startDate);
    const end = new Date(details.endDate);
    
    if (start >= end) {
      errors.push('Start date must be before end date');
    }
    
    // Check if booking is for the future
    if (start < new Date()) {
      errors.push('Booking date cannot be in the past');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate a unique tracking ID
 * @returns {string} - Unique tracking ID
 */
const generateTrackingId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `TRK${timestamp}${random}`;
};

/**
 * Format price for display
 * @param {number} price - Price amount
 * @param {string} currency - Currency code (default: EUR)
 * @returns {string} - Formatted price string
 */
const formatPrice = (price, currency = 'EUR') => {
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: currency
  }).format(price);
};

/**
 * Calculate full booking pricing details (booking price, fees, km charge, totals)
 * @param {Object} listing - Listing document
 * @param {Object} opts - { startDate, endDate, startTime, endTime, numberOfEvents, distanceKm }
 * @returns {Object} - pricing breakdown or { error, status }
 */
const calculateFullBookingPrice = (listing, opts = {}) => {
  try {
    const { startDate, endDate, startTime, endTime, numberOfEvents, distanceKm } = opts;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // include both days
    const isMultiDay = diffDays > 1;

    // calculate hours
    const calculateHours = (s, e) => {
      const sObj = new Date(`2000-01-01 ${s}`);
      const eObj = new Date(`2000-01-01 ${e}`);
      let diffHours = (eObj - sObj) / (1000 * 60 * 60);
      if (diffHours < 0) diffHours += 24;
      return Math.max(diffHours, 0);
    };

    let dailyHours = 0;
    let totalHours = 0;
    if (startTime && endTime) {
      dailyHours = calculateHours(startTime, endTime);
      totalHours = isMultiDay ? dailyHours * diffDays : dailyHours;
    } else {
      dailyHours = isMultiDay ? 24 : 0;
      totalHours = diffDays * 24;
    }

    const extratimeCost = listing.pricing.extratimeCost || 0;
    const securityFee = listing.pricing.securityFee || 0;

    // validate pricing amount
    if (!listing.pricing.type || typeof listing.pricing.amount !== 'number') {
      return { error: 'Listing pricing information is invalid.', status: 400 };
    }

    const pricingType = (listing.pricing.type || '').toString().toLowerCase();
    const eventsCount = Number(numberOfEvents) > 0 ? Number(numberOfEvents) : 1;

    let bookingPrice = 0;
    if (pricingType === 'per hour' || pricingType === 'hourly') {
      bookingPrice = listing.pricing.amount * totalHours;
    } else if (pricingType === 'day' || pricingType === 'daily' || pricingType === 'per day') {
      bookingPrice = listing.pricing.amount * diffDays;
    } else if (pricingType === 'per event' || pricingType === 'event') {
      bookingPrice = listing.pricing.amount * eventsCount;
    } else if (pricingType === 'fixed' || pricingType === 'fixed price' || pricingType === 'one-time' || pricingType === 'flat') {
      bookingPrice = listing.pricing.amount;
    } else {
      return { error: 'Unsupported pricing type.', status: 400 };
    }

    // km charge
    let kmCharge = 0;
    if (typeof listing.pricing.pricePerKm === 'number' && Number(distanceKm) > 0) {
      kmCharge = Math.round(listing.pricing.pricePerKm * Number(distanceKm) * 100) / 100;
    }

    // subtotal, system fee and total
    const subtotal = bookingPrice + extratimeCost + securityFee + kmCharge;
    const systemFeePercent = 0.02;
    const systemFee = Math.round(subtotal * systemFeePercent * 100) / 100;
    const totalPrice = Math.round((subtotal + systemFee) * 100) / 100;

    const result = {
      bookingPrice,
      extratimeCost,
      securityFee,
      kmCharge,
      subtotal,
      systemFee,
      systemFeePercent,
      totalPrice,
      dailyHours,
      totalHours,
      diffDays,
      isMultiDay,
      dailyRate: isMultiDay ? Math.round(bookingPrice / diffDays) : null
    };

    return result;
  } catch (e) {
    console.error('Error calculating booking price:', e);
    return { error: 'Failed to calculate booking price', status: 500 };
  }
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

module.exports = {
  checkListingAvailability,
  getConflictingBookings,
  calculateDuration,
  calculateBookingPrice,
  calculateFullBookingPrice,
  validateBookingDetails,
  generateTrackingId,
  formatPrice,
  getAvailabilityDetails,
  checkAvailability
};
