const express = require('express');
const router = express.Router();
const {
    createSaleItemOrder,
    getSaleItemHistory,
    getSaleItemHistoryForVendor,
    updateSaleItemOrderStatus
} = require('../../controllers/client/saleItemPurchaseController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/sale-item-purchase', requireAuth, createSaleItemOrder);
router.get('/sale-item-history', requireAuth, getSaleItemHistory);
router.get('/vendor-order-history', requireAuth, getSaleItemHistoryForVendor);
router.post('/update-order-status/:orderId', requireAuth, updateSaleItemOrderStatus);

module.exports = router;