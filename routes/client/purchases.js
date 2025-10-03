const express = require('express');
const router = express.Router();
const {
    getPurchaseHistory,
} = require('../../controllers/client/purchaseController');
const { requireAuth, requireClient } = require('../../middleware/authMiddleware');

/**
 * @route   GET /api/client/purchases/history
 * @desc    Get user's purchase history
 * @access  Private
 */
router.get('/history', requireAuth, requireClient, getPurchaseHistory);


module.exports = router;