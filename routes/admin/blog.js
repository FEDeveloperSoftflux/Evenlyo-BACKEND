const express = require('express');
const router = express.Router();

const {createBlog,updateBlog,deleteBlog} = require('../../controllers/admin/blogManagement');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/create', requireAuth, createBlog);
router.put('/update/:id', requireAuth, updateBlog);
router.delete('/delete/:id', requireAuth, deleteBlog);

module.exports = router;