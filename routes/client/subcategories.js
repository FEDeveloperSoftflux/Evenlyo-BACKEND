const express = require('express');
const router = express.Router();
const subCategoryController = require('../../controllers/client/subCategoryController');

// Public routes (no authentication required)
router.get('/', subCategoryController.getSubCategories);
router.get('/category/:categoryId', subCategoryController.getSubCategoriesByCategory);
router.get('/:id', subCategoryController.getSubCategoryById);

module.exports = router; 