const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { getVendorBookings, getVendorPurchases, markBookingOnTheWay, markBookingPickedUp, markAsReceivedBack } = require('../../controllers/vendor/trackingController')
const { markBookingCompleted } = require('../../controllers/vendor/trackingController'); 

router.get('/', requireAuth, getVendorBookings);
router.get('/purchases', requireAuth, requireVendor, getVendorPurchases);
router.post('/:id/mark-on-the-way', requireAuth, requireVendor, markBookingOnTheWay);
router.post('/:id/mark-picked-up', requireAuth, markBookingPickedUp);
router.post('/:id/mark-completed', requireAuth, requireVendor, markBookingCompleted);
router.post('/:id/received-back', requireAuth, requireVendor, markAsReceivedBack);


module.exports = router;
