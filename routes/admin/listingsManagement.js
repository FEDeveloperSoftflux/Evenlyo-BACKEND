// TOGGLE subcategory status by subcategory id
const express = require('express');
const router = express.Router();
const {getAllListingManagementData, getSubCategoriesByMainCategory,toggleSubCategoryStatus,createSubCategory, editSubCategory}= require('../../controllers/admin/listingManagement');

// GET all listing management data in one response
router.get('/stats', getAllListingManagementData);

// GET subcategories by main category id
router.get('/subcategories/:mainCategoryId', getSubCategoriesByMainCategory);


router.patch('/subcategories/:subCategoryId/toggle', toggleSubCategoryStatus);

router.post('/create/subcategories', createSubCategory);

router.put('/edit/subcategories/:subCategoryId', editSubCategory);

module.exports = router;
