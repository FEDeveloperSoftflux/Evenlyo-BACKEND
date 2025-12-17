const express = require('express');
const router = express.Router();
const { getProfile, updateDeliveryCharges, updateProfile, subCategoryFromCategory, getMainCategoriesbyVendorId } = require('../../controllers/vendor/profileController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Get vendor profile
router.get('/', requireAuth, getProfile);
router.get('/get-main-category/:vendorId', getMainCategoriesbyVendorId);

// Update vendor profile
router.put('/update', requireAuth, updateProfile);
router.put('/update-delivery-charges', requireAuth, updateDeliveryCharges);

router.post('/get-sub-category-by-categoryIds', subCategoryFromCategory);


module.exports = router;
