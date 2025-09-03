const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { getVendorBookings,markBookingOnTheWay,markBookingPickedUp  } = require('../../controllers/vendor/trackingController')
const { markBookingCompleted } = require('../../controllers/vendor/trackingController'); 

router.get('/', requireAuth, requireVendor, getVendorBookings);

router.post('/:id/mark-on-the-way', requireAuth, requireVendor, markBookingOnTheWay);

router.post('/:id/mark-picked-up', requireAuth, requireVendor, markBookingPickedUp);

router.post('/:id/mark-completed', requireAuth, requireVendor, markBookingCompleted);

module.exports = router;
