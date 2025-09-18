const asyncHandler = require('express-async-handler');
const Blog = require('../../models/Blog');
const User = require('../../models/User');
const { sendPromotionalEmail } = require('../../utils/mailer');


// @desc    Create new blog
// @route   POST /api/blogs
// @access  Private (Admin only)
const createBlog = asyncHandler(async (req, res) => {
  try {
    const {
      title,
      description,
      content,
      author,
      category,
      readTime,
      image,
      isMain = false,
      tags = []
    } = req.body;

    // Validation
    if (!title || !description || !content || !author || !category || !readTime || !image) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // If setting as main blog, unset other main blogs
    if (isMain) {
      await Blog.updateMany({ isMain: true }, { isMain: false });
    }

    const blog = await Blog.create({
      title,
      description,
      content,
      author,
      category,
      readTime,
      image,
      isMain,
      tags
    });

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: blog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating blog',
      error: error.message
    });
  }
});

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private (Admin only)
const updateBlog = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    // If setting as main blog, unset other main blogs
    if (updateData.isMain && !blog.isMain) {
      await Blog.updateMany({ isMain: true }, { isMain: false });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: updatedBlog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating blog',
      error: error.message
    });
  }
});

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private (Admin only)
const deleteBlog = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    await Blog.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting blog',
      error: error.message
    });
  }


});

module.exports = {
  createBlog,
  updateBlog,
  deleteBlog
};