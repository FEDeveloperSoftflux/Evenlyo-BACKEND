const express = require('express');
const router = express.Router();
const {
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
  reviewBooking,
  cancelBooking
} = require('../../controllers/client/bookingController');

const { createBookingPaymentIntent } = require('../../controllers/client/bookingController');

// Import authentication middleware
const { requireAuth, requireClient, requireVendor } = require('../../middleware/authMiddleware');

// ========================= CLIENT ROUTES ========================= //

// @route   POST /api/booking/request
// @desc    Create a new booking request
// @access  Private (Client)
router.post('/request', requireAuth, requireClient, createBookingRequest);

// @route   GET /api/booking/accepted
// @desc    Get accepted bookings awaiting payment
// @access  Private (Client)
router.get('/accepted', requireAuth, requireClient, getAcceptedBookings);

// @route   POST /api/booking/:id/pay
// @desc    Mark booking as paid and confirm payment
// @access  Private (Client)
router.post('/:id/pay', requireAuth, requireClient, markBookingAsPaid);

// @route   GET /api/booking/history
// @desc    Get client's complete booking history with pagination
// @access  Private (Client)
router.get('/history', requireAuth, requireClient, getBookingHistory);

// @route   POST /api/booking/:id/mark-received
// @desc    Mark booking as received
// @access  Private (Client)
router.post('/:id/mark-received', requireAuth, requireClient, markBookingReceived);

// @route   POST /api/booking/:id/mark-complete
// @desc    Mark booking as complete
// @access  Private (Client)
router.post('/:id/mark-finished', requireAuth, requireClient, markBookingFinished);

// @route   POST /api/booking/:id/claim
// @desc    Create a claim/report issue
// @access  Private (Client)
router.post('/:id/claim', requireAuth, requireClient, createClaim);

// @route   POST /api/booking/:id/cancel
// @desc    Cancel a booking (only within 30 min)
// @access  Private (Client)
router.post('/:id/cancel', requireAuth, requireClient, cancelBooking);

router.post('/:id/review', requireAuth, requireClient, reviewBooking);


// ========================= VENDOR ROUTES ========================= //

// @route   GET /api/booking/pending
// @desc    Get all pending booking requests for vendor
// @access  Private (Vendor)
router.get('/pending', requireAuth, requireVendor, getPendingBookings);

// @route   GET /api/booking/vendor-history
// @desc    Get vendor's booking history
// @access  Private (Vendor)
router.get('/vendor-history', requireAuth, requireVendor, getVendorBookingHistory);


// ========================= SHARED ROUTES ========================= //

// @route   GET /api/booking/:id
// @desc    Get detailed booking information
// @access  Private (User/Vendor)
router.get('/:id', requireAuth, getBookingDetails);

router.post('/:id/create-payment-intent', requireAuth, requireClient, createBookingPaymentIntent);


module.exports = router;
