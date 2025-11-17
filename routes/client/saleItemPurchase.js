const express = require('express');
const router = express.Router();
const {
    createSaleItemOrder
} = require('../../controllers/client/saleItemPurchaseController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/sale-item-purchase', createSaleItemOrder);

module.exports = router;