const express = require('express');
const router = express.Router();
const { getVendorItemsOverview, toggleItemStatus } = require('../../controllers/vendor/itemManagement');
const { requireAuth, requireVendor, requireApprovedVendor } = require('../../middleware/authMiddleware');

// GET /api/vendor/items/overview
router.get('/overview', requireAuth, requireVendor, requireApprovedVendor, getVendorItemsOverview);
// PATCH /api/vendor/items/:id/toggle-status
router.patch('/:id/toggle-status', requireAuth, requireVendor, requireApprovedVendor, toggleItemStatus);

module.exports = router;
