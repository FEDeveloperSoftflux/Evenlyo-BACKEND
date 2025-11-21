const express = require('express');
const router = express.Router();
const {
    getSaleItemHistory
} = require('../../controllers/vendor/SaleItemPurchaseController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.get('/vendor-order-history', getSaleItemHistory);

module.exports = router;