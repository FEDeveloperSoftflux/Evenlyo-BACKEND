const express = require('express');
const router = express.Router();
const {
    createSaleItemOrder
} = require('../../controllers/client/saleItemPurchaseController');
const { requireAuth, requireClient } = require('../../middleware/authMiddleware');

/**
 * @route   GET /api/client/purchases/history
 * @desc    Get user's purchase history
 * @access  Private
 */
// router.get('/history', requireAuth, getPurchaseHistory);
router.post('/place-order', requireAuth, createSaleItemOrder);


module.exports = router;