const express = require('express');
const router = express.Router();
const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  addCommentWithPromotion,
  getBlogCategories
} = require('../controllers/blogController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// Public routes
router.get('/categories', getBlogCategories);
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);

// Comment routes (Public)
router.post('/:id/comments', addCommentWithPromotion); // Add comment + promotional email

// Admin routes - Blog management
router.post('/', requireAuth, requireAdmin, createBlog);
router.put('/:id', requireAuth, requireAdmin, updateBlog);
router.delete('/:id', requireAuth, requireAdmin, deleteBlog);

module.exports = router;
