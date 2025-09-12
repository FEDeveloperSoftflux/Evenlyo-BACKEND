const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../../controllers/admin/dashboardController');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// --- Admin Dashboard Routes ---

// Get dashboard stats and data
router.get('/stats', 
  requireAuth,
  requireAdmin,
  requireActiveAdmin,
  getDashboardStats
);

module.exports = router;
