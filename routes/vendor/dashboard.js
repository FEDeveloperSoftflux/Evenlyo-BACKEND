const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../../controllers/vendor/dashboardController');
const { requireAuth, requireVendor, requireApprovedVendor } = require('../../middleware/authMiddleware');

// GET /api/vendor/dashboard/analytics
router.get('/analytics', requireAuth, requireVendor, requireApprovedVendor, getDashboardAnalytics);

module.exports = router;
