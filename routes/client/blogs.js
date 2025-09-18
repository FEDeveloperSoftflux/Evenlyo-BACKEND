const express = require('express');
const router = express.Router();
const {
  getAllBlogs,
  getBlogById,
  addCommentWithPromotion,
  getBlogCategories
} = require('../../controllers/client/blogController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

// Public routes
router.get('/categories', getBlogCategories);
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);

// Comment routes (Public)
router.post('/:id/comments', addCommentWithPromotion); // Add comment + promotional email

module.exports = router;
