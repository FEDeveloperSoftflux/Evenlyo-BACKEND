const express = require('express');
const router = express.Router();
const {
  getAllPlans,
  activateDiscount,
  togglePlanStatus
} = require('../../controllers/client/planController');

// Import auth middleware for protected routes
const { requireAuth } = require('../../middleware/authMiddleware');

// Public route
// GET /api/plans - Get all plans
router.get('/', getAllPlans);

// PATCH /api/plans/:id/discount - Activate discount for a plan
router.patch('/:id/discount', requireAuth, activateDiscount);

// PATCH /api/plans/:id/toggle - Toggle plan status (active/inactive)
router.patch('/:id/toggle', requireAuth, togglePlanStatus);

module.exports = router;
