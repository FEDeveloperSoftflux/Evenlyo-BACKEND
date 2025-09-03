const express = require('express');
const router = express.Router();

const { getVendorEarningsAnalytics } = require('../../controllers/vendor/earningController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/vendor/earnings/analytics
router.get('/analytics', requireAuth, getVendorEarningsAnalytics);

module.exports = router;
