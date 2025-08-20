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
  getVendorBookingHistory,
  markBookingOnTheWay,
  markBookingReceived,
  markBookingPickedUp,
  markBookingComplete,
  createClaim,
  getBookingDetails
} = require('../controllers/bookingController');

// Import authentication middleware
const { requireAuth, requireClient, requireVendor } = require('../middleware/authMiddleware');

// @route   POST /api/booking/request
// @desc    Create a new booking request
// @access  Private (User/Client)
// @purpose Client creates a booking request for vendor's services/items with dates, pricing, and event details
router.post('/request', requireAuth, requireClient, createBookingRequest);

// @route   GET /api/booking/pending
// @desc    Get all pending booking requests for vendor
// @access  Private (Vendor)
// @purpose Vendor views all booking requests awaiting their approval/rejection
router.get('/pending', requireAuth, requireVendor, getPendingBookings);

// @route   POST /api/booking/:id/accept
// @desc    Accept a pending booking request
// @access  Private (Vendor)
// @purpose Vendor approves a booking request, making it ready for client payment
router.post('/:id/accept', requireAuth, requireVendor, acceptBooking);

// @route   POST /api/booking/:id/reject
// @desc    Reject a pending booking request with reason
// @access  Private (Vendor)
// @purpose Vendor declines a booking request and provides rejection reason to client
router.post('/:id/reject', requireAuth, requireVendor, rejectBooking);

// @route   GET /api/booking/accepted
// @desc    Get accepted bookings awaiting payment
// @access  Private (User/Client)
// @purpose Client views bookings that have been accepted by vendors and need payment
// On Cart page for Accepted TAB
router.get('/accepted', requireAuth, requireClient, getAcceptedBookings);

// @route   POST /api/booking/:id/pay
// @desc    Mark booking as paid and confirm payment
// @access  Private (User/Client)
// @purpose Client confirms payment for an accepted booking, moving it to paid status
router.post('/:id/pay', requireAuth, requireClient, markBookingAsPaid);

// @route   GET /api/booking/history
// @desc    Get client's complete booking history with pagination
// @access  Private (User/Client)
// @purpose Client views their complete booking history with status filters and pagination
router.get('/history', requireAuth, requireClient, getBookingHistory);

// @route   GET /api/booking/vendor-history
// @desc    Get vendor's booking history with pagination and status filtering
// @access  Private (Vendor)
// @purpose Allows vendors to view their complete booking history with filters
router.get('/vendor-history', requireAuth, requireVendor, getVendorBookingHistory);

// @route   POST /api/booking/:id/mark-on-the-way
// @desc    Mark booking as on the way (Vendor action)
// @access  Private (Vendor)
// @purpose Vendor marks that items/services are being delivered/transported to client
router.post('/:id/mark-on-the-way', requireAuth, requireVendor, markBookingOnTheWay);

// @route   POST /api/booking/:id/mark-received
// @desc    Mark booking as received (Client action)
// @access  Private (Client)
// @purpose Client confirms they have received the items/services from vendor
router.post('/:id/mark-received', requireAuth, requireClient, markBookingReceived);

// @route   POST /api/booking/:id/mark-picked-up
// @desc    Mark booking as picked up (Vendor action)
// @access  Private (Vendor)
// @purpose Vendor confirms they have picked up items back from client (for rental services)
router.post('/:id/mark-picked-up', requireAuth, requireVendor, markBookingPickedUp);

// @route   POST /api/booking/:id/mark-complete
// @desc    Mark booking as complete (Client action)
// @access  Private (Client)
// @purpose Client marks the entire booking process as completed, can include review/rating
router.post('/:id/mark-complete', requireAuth, requireClient, markBookingComplete);

// @route   POST /api/booking/:id/claim
// @desc    Create a claim/report issue (Client action)
// @access  Private (Client)
// @purpose Client can report problems or issues with the booking for admin review
router.post('/:id/claim', requireAuth, requireClient, createClaim);

// @route   GET /api/booking/:id
// @desc    Get detailed booking information
// @access  Private (User/Vendor)
// @purpose Retrieve complete booking details for both clients and vendors
router.get('/:id', requireAuth, getBookingDetails);

module.exports = router;
