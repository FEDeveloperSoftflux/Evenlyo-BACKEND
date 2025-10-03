const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { createItem } = require('../../controllers/vendor/itemManagement');

// POST /api/vendor/items/create
router.post('/create', requireAuth, requireVendor, createItem);

module.exports = router;