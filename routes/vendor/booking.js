const express = require('express');
const router = express.Router();
const { getVendorBookingAnalytics } = require('../../controllers/vendor/bookingAnalytics');
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const {acceptBooking, rejectBooking} = require('../../controllers/vendor/bookingAnalytics')

// GET /api/vendor/bookings/analytics
router.get('/analytics', requireAuth, getVendorBookingAnalytics);

router.post('/:id/accept', requireAuth, requireVendor, acceptBooking);

router.post('/:id/reject', requireAuth, requireVendor, rejectBooking);


module.exports = router;
