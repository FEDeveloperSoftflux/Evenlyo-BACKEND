const express = require('express');
const router = express.Router();
const { requireAuth, requireClient } = require('../../middleware/authMiddleware');
const { createItemPaymentIntent, buyItem, getItemsByCategory } = require('../../controllers/client/ItemController');

// POST /api/client/items/create-payment-intent - Create Stripe payment intent for item
router.post('/create-payment-intent', requireAuth, requireClient, createItemPaymentIntent);

// POST /api/client/items/buy - Complete purchase after payment confirmation
router.post('/buy', requireAuth, requireClient, buyItem);

// GET /api/client/items/list - Get items by category
router.get('/list',getItemsByCategory);

module.exports = router;
