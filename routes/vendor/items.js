const express = require('express');
const router = express.Router();
const { requireAuth, requireVendor } = require('../../middleware/authMiddleware');
const { createItem, getVendorItemsOverview, updateItem, updateItemListing, deleteItem } = require('../../controllers/vendor/itemManagement');

// POST /api/vendor/items/create
router.post('/create', requireAuth, createItem);
router.get('/overview', requireAuth, getVendorItemsOverview);
router.put('/update/:itemId',requireAuth, updateItem);
router.put('/update-listing/:itemId', requireAuth, requireVendor, updateItemListing);
router.delete('/delete/:itemId', requireAuth, requireVendor, deleteItem);

module.exports = router;