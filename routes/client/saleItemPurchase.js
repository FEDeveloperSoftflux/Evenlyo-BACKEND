const express = require('express');
const router = express.Router();
const {
    createSaleItemOrder,
    getSaleItemHistory
} = require('../../controllers/client/saleItemPurchaseController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/sale-item-purchase', requireAuth, createSaleItemOrder);
router.get('/sale-item-history', requireAuth, getSaleItemHistory);

module.exports = router;