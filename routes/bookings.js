const express = require('express');
const router = express.Router();
const {
  createBookingRequest,
  getPendingBookings,
  acceptBooking,
  rejectBooking,
  getAcceptedBookings,
  markBookingAsPaid,
  getBookingHistory,
  getVendorBookingHistory
} = require('../controllers/bookingController');


const { requireAuth, requireClient, requireVendor } = require('../middleware/authMiddleware');

// @route   POST /api/booking/request
// @desc    Create a booking request
// @access  Private (User)
router.post('/request', requireAuth, requireClient, createBookingRequest);

// @route   GET /api/booking/pending
// @desc    Get pending bookings for vendor
// @access  Private (Vendor)
router.get('/pending', requireAuth, requireVendor, getPendingBookings);

// @route   POST /api/booking/:id/accept
// @desc    Accept booking request
// @access  Private (Vendor)
router.post('/:id/accept', requireAuth, requireVendor, acceptBooking);

// @route   POST /api/booking/:id/reject
// @desc    Reject booking request
// @access  Private (Vendor)
router.post('/:id/reject', requireAuth, requireVendor, rejectBooking);

// @route   GET /api/booking/accepted
// @desc    Get accepted bookings for user (before payment)
// @access  Private (User)
router.get('/accepted', requireAuth, requireClient, getAcceptedBookings);

// @route   POST /api/booking/:id/pay
// @desc    Mark booking as paid
// @access  Private (User)
router.post('/:id/pay', requireAuth, requireClient, markBookingAsPaid);

// @route   GET /api/booking/history
// @desc    Get user's booking history
// @access  Private (User)
router.get('/history', requireAuth, requireClient, getBookingHistory);

// @route   GET /api/booking/vendor-history
// @desc    Get vendor's booking history
// @access  Private (Vendor)
router.get('/vendor-history', requireAuth, requireVendor, getVendorBookingHistory);

module.exports = router;
