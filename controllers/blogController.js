const asyncHandler = require('express-async-handler');
const Blog = require('../models/Blog');
const User = require('../models/User');
const { sendPromotionalEmail } = require('../utils/mailer');

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
const getAllBlogs = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      isMain,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isPublished: true };
    
    if (category) {
      filter.category = { $regex: new RegExp(category, 'i') };
    }
    
    if (isMain !== undefined) {
      filter.isMain = isMain === 'true';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get blogs with pagination
    const blogs = await Blog.find(filter)
      .select('title description createdAt author category readTime image isMain views')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Blog.countDocuments(filter);

    // Format the response
    const formattedBlogs = blogs.map(blog => ({
      _id: blog._id,
      title: blog.title,
      description: blog.description,
      date: blog.createdAt,
      author: blog.author,
      category: blog.category,
      readTime: blog.readTime,
      image: blog.image,
      isMain: blog.isMain,
      views: blog.views
    }));

    res.status(200).json({
      success: true,
      data: formattedBlogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBlogs: total,
        hasNextPage: skip + blogs.length < total,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
});

// @desc    Get single blog by ID
// @route   GET /api/blogs/:id
// @access  Public
const getBlogById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id)
      .populate({
        path: 'comments',
        match: { isApproved: true },
        options: { sort: { createdAt: -1 } }
      });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (!blog.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Blog not available'
      });
    }

    // Increment view count
    await Blog.findByIdAndUpdate(id, { $inc: { views: 1 } });

    // Format the response
    const formattedBlog = {
      _id: blog._id,
      title: blog.title,
      description: blog.description,
      date: blog.createdAt,
      author: blog.author,
      category: blog.category,
      readTime: blog.readTime,
      image: blog.image,
      content: blog.content,
      comments: blog.comments,
      views: blog.views + 1,
      tags: blog.tags
    };

    res.status(200).json({
      success: true,
      data: formattedBlog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message
    });
  }
});

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

// @desc    Add comment to blog
// @route   POST /api/blogs/:id/comments
// @access  Public
const addComment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { author, email, content } = req.body;

    if (!author || !email || !content) {
      return res.status(400).json({
        success: false,
        message: 'Author, email, and content are required'
      });
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    const newComment = {
      author,
      email,
      content,
      createdAt: new Date()
    };

    blog.comments.push(newComment);
    await blog.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully. It will be visible after approval.',
      data: newComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
});

// @desc    Add comment to blog with promotional email
// @route   POST /api/blogs/:id/comments/enhanced
// @access  Public
const addCommentWithPromotion = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    // Check if req.body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Please send data with Content-Type: application/json'
      });
    }
    
    const { author, email, content } = req.body;

    // Validation
    if (!author || !email || !content) {
      return res.status(400).json({
        success: false,
        message: 'Author, email, and content are required',
        received: { 
          author: author || 'missing', 
          email: email || 'missing', 
          content: content || 'missing' 
        }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Find the blog
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (!blog.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'Blog not available for comments'
      });
    }

    // Check if user is already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    if (!existingUser) {
      isNewUser = true;
      console.log(`New user detected: ${email} - Will send promotional email`);
    }

    // Create the comment
    const newComment = {
      author: author.trim(),
      email: email.toLowerCase().trim(),
      content: content.trim(),
      createdAt: new Date(),
      isApproved: true // Instantly approve comments
    };

    // Add comment to blog
    blog.comments.push(newComment);
    await blog.save();

    // Send promotional email if user is not registered
    let emailSent = false;
    let emailError = null;

    if (isNewUser) {
      try {
        await sendPromotionalEmail(email, author);
        emailSent = true;
        console.log(`Promotional email sent successfully to: ${email}`);
      } catch (error) {
        emailError = error.message;
        console.error(`Failed to send promotional email to ${email}:`, error.message);
        // Don't fail the comment creation if email fails
      }
    }

    // Get the created comment (with its ID)
    const createdComment = blog.comments[blog.comments.length - 1];

    // Prepare response
    const response = {
      success: true,
      message: 'Comment added successfully. It will be visible after approval.',
      data: {
        comment: {
          _id: createdComment._id,
          author: createdComment.author,
          email: createdComment.email,
          content: createdComment.content,
          createdAt: createdComment.createdAt,
          isApproved: createdComment.isApproved
        },
        emailStatus: {
          isNewUser,
          emailSent,
          emailError
        }
      }
    };

    // Add promotional message if email was sent
    if (isNewUser && emailSent) {
      response.message += ' We\'ve also sent you information about our amazing event planning services!';
    } else if (isNewUser && !emailSent) {
      response.message += ' Note: We tried to send you promotional information but there was an email delivery issue.';
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Error in addCommentWithPromotion:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
});

// @desc    Get blog categories
// @route   GET /api/blogs/categories
// @access  Public
const getBlogCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Blog.distinct('category', { isPublished: true });
    
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  addComment,
  addCommentWithPromotion,
  getBlogCategories
};
