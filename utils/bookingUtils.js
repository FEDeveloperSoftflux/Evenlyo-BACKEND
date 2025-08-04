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

module.exports = {
  checkListingAvailability,
  getConflictingBookings,
  calculateDuration,
  calculateBookingPrice,
  validateBookingDetails,
  generateTrackingId,
  formatPrice
};
