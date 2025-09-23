const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { buyItem, getItemsByCategory } = require('../../controllers/client/ItemController');

// POST /api/client/items/buy
router.post('/buy', requireAuth, buyItem);

// GET /api/client/items
router.get('/list', requireAuth, getItemsByCategory);

module.exports = router;
