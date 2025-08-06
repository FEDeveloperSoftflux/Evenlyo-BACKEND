const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Public routes (no authentication required)
router.get('/', categoryController.getCategories);
router.get('/all', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

module.exports = router;
