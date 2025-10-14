const express = require('express');
const router = express.Router();
const serviceItemStockController = require('../../controllers/vendor/serviceItemStockController');
const authMiddleware = require('../../middleware/authMiddleware');

// Create stock event (Check In, Check Out, Missing, Stock In)
router.post('/event', authMiddleware.requireAuth, serviceItemStockController.createStockEvent);

// Get tabular data for each type
router.get('/table/:type', authMiddleware.requireAuth, serviceItemStockController.getStockTable);

// Get all stock logs split into checkins and checkouts
router.get('/logs', authMiddleware.requireAuth, serviceItemStockController.getStockLogs);

// Update item quantity directly
router.put('/quantity', authMiddleware.requireAuth, serviceItemStockController.updateItemQuantity);

module.exports = router;
