const express = require('express');
const router = express.Router();
const {
  getAllBookingsTracking,
  getBookingByTrackingId,
  getTrackingStats,
  updateBookingStatus,
  getBookingStatusHistory,
  getBookingStatusHistoryById,
  getAllSaleItemOrders
} = require('../../controllers/admin/trackingController');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// --- Admin Tracking Routes ---

// Get all bookings with tracking information (paginated, searchable, filterable)
router.get('/', 
  requireAdmin,
  getAllBookingsTracking
);
router.get('/sale', 
  requireAdmin,
  getAllSaleItemOrders
);

// Get tracking statistics for dashboard
router.get('/stats',
  requireAdmin,
  // requireAdmin,
  // requireActiveAdmin,
  getTrackingStats
);

// Get status history for a specific booking by tracking ID
router.get('/:trackingId/status-history',
  requireAdmin,
  getBookingStatusHistory
);

// Update booking status (admin action) by tracking ID
router.patch('/:trackingId/status',
  requireAdmin,
  updateBookingStatus
);

// Get specific booking details by tracking ID (this should be last to avoid conflicts)
router.get('/:trackingId',
  requireAdmin,
  getBookingByTrackingId
);

// --- Routes using Booking ID ---

// Get status history for a specific booking by booking ID
router.get('/booking/:bookingId/status-history',
  requireAdmin,
  getBookingStatusHistoryById
);

module.exports = router;
