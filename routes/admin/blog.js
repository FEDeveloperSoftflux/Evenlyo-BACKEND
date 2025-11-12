const express = require('express');
const router = express.Router();

const {createBlog,updateBlog,deleteBlog} = require('../../controllers/admin/blogManagement');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

router.post('/create', requireAdmin, createBlog);
router.put('/update/:id', requireAdmin, updateBlog);
router.delete('/delete/:id', requireAdmin, deleteBlog);

module.exports = router;