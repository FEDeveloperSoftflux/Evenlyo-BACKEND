const express = require('express');
const router = express.Router();
const { getAllPlansAdmin, togglePlanStatusAdmin, activateDiscount, toggleDiscountStatusAdmin } = require('../../controllers/admin/planController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/admin/plans - Get all pricing plans (admin)
router.get('/', getAllPlansAdmin);

// PATCH /api/admin/plans/:id/toggle - Toggle plan active/deactive status
router.patch('/:id/toggle', togglePlanStatusAdmin);

// PATCH /api/plans/:id/discount - Activate discount for a plan
router.patch('/:id/discount', requireAuth, activateDiscount);

// PATCH /api/admin/plans/:id/discount-toggle - Toggle discount active/deactive status
router.patch('/:id/discount-toggle', toggleDiscountStatusAdmin);


module.exports = router;
