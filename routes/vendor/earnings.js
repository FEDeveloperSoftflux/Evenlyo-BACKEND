const express = require('express');
const router = express.Router();

const { getVendorEarningsAnalytics,getServiceItemEarningsAnalytics } = require('../../controllers/vendor/earningController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/vendor/earnings/analytics - Booking earnings analytics
router.get('/analytics', requireAuth, getVendorEarningsAnalytics);

// GET /api/vendor/earnings/service-items/analytics - Service item earnings analytics
router.get('/service/analytics', requireAuth, getServiceItemEarningsAnalytics);

module.exports = router;
