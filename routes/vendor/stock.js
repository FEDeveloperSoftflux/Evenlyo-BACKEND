const express = require('express');
const router = express.Router();
const stockController = require('../../controllers/vendor/stockController');
const authMiddleware = require('../../middleware/authMiddleware');

// Create stock event (Check In, Check Out, Missing, Stock In)
router.post('/event', authMiddleware.requireAuth, stockController.createStockEvent);

// Get tabular data for each type
router.get('/table/:type', authMiddleware.requireAuth, stockController.getStockTable);

// Get all stock logs split into checkins and checkouts
router.get('/logs', authMiddleware.requireAuth, stockController.getStockLogs);

module.exports = router;
