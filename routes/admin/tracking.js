const express = require('express');
const router = express.Router();
const {
  getAllBookingsTracking,
  getBookingByTrackingId,
  getTrackingStats,
  updateBookingStatus
} = require('../../controllers/admin/trackingController');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// --- Admin Tracking Routes ---

// Get all bookings with tracking information (paginated, searchable, filterable)
router.get('/', 
  requireAuth,
  requireAdmin,
  requireActiveAdmin,
  getAllBookingsTracking
);

// Get tracking statistics for dashboard
router.get('/stats',
  requireAuth,
  requireAdmin,
  requireActiveAdmin,
  getTrackingStats
);

// Get specific booking details by tracking ID
router.get('/:trackingId',
  requireAuth,
  requireAdmin,
  requireActiveAdmin,
  getBookingByTrackingId
);

// Update booking status (admin action)
router.patch('/:trackingId/status',
  requireAuth,
  requireAdmin,
  requireActiveAdmin,
  updateBookingStatus
);

module.exports = router;
