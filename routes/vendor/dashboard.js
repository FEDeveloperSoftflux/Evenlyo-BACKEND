const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../../controllers/vendor/dashboardController');
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');

// GET /api/vendor/dashboard/analytics
router.get('/analytics', requireAuth, getDashboardAnalytics);

module.exports = router;
