const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/client/categoryController');

// Public routes (no authentication required)
router.get('/', categoryController.getCategories);
router.get('/all', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id', categoryController.getCategoriesByVendorId);

module.exports = router;
