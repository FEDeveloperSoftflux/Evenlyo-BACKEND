// TOGGLE subcategory status by subcategory id
const express = require('express');
const router = express.Router();
const {getAllListingManagementData, getSubCategoriesByMainCategory,toggleSubCategoryStatus,createSubCategory}= require('../../controllers/admin/listingManagement');

// GET all listing management data in one response
router.get('/stats', getAllListingManagementData);

// GET subcategories by main category id
router.get('/subcategories/:mainCategoryId', getSubCategoriesByMainCategory);


router.patch('/subcategories/:subCategoryId/toggle', toggleSubCategoryStatus);

router.post('/create/subcategories', createSubCategory);

module.exports = router;
