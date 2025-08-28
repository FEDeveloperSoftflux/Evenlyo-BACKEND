const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { getVendorBookings,markBookingOnTheWay,markBookingPickedUp  } = require('../../controllers/vendor/trackingController')

// GET /api/vendor/tracking - Get all current bookings for vendor
router.get('/', requireAuth, requireVendor, getVendorBookings);

// @route   POST /api/booking/:id/mark-on-the-way
// @desc    Mark booking as on the way
// @access  Private (Vendor)
router.post('/:id/mark-on-the-way', requireAuth, requireVendor, markBookingOnTheWay);

// @route   POST /api/booking/:id/mark-picked-up
// @desc    Mark booking as picked up
// @access  Private (Vendor)
router.post('/:id/mark-picked-up', requireAuth, requireVendor, markBookingPickedUp);


// @route   POST /api/booking/:id/mark-completed
// @desc    Mark booking as completed
// @access  Private (Vendor)
const { markBookingCompleted } = require('../../controllers/vendor/trackingController');
router.post('/:id/mark-completed', requireAuth, requireVendor, markBookingCompleted);

module.exports = router;
