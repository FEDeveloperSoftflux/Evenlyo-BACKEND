const express = require('express');
const router = express.Router();
const { 
  getAdminBookingAnalytics, 
  getFilteredBookingAnalytics,
  getBookingDetails
} = require('../../controllers/admin/bookingAnalyticsController');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// @route   GET /api/admin/bookings/analytics
// @desc    Get admin booking analytics with stats cards and all bookings
// @access  Private (Admin)
router.get('/analytics', 
  requireAdmin, 
  getAdminBookingAnalytics
);

// @route   GET /api/admin/bookings/analytics/filtered
// @desc    Get filtered booking analytics with pagination
// @access  Private (Admin)
router.get('/analytics/filtered', 
  requireAuth, 
  requireAdmin, 
  requireActiveAdmin, 
  getFilteredBookingAnalytics
);

// @route   GET /api/admin/bookings/:id/details
// @desc    Get detailed booking information with complete status history
// @access  Private (Admin)
router.get('/:id/details', 
  requireAuth, 
  requireAdmin, 
  requireActiveAdmin, 
  getBookingDetails
);

module.exports = router;
