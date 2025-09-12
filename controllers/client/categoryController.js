const Category = require('../../models/Category');

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
const getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 5, isActive, search } = req.query;
    
    // Build query object
    const query = {};
    
    // Filter by active status if provided
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Search by name if provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get categories with pagination
    const categories = await Category.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Category.countDocuments(query);
    
    res.json({
      success: true,
      data: categories,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// @desc    Get single category by ID
// @route   GET /api/categories/:id
// @access  Public
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

// @desc    Get all categories (no pagination, filters, or search)
// @route   GET /api/categories/all
// @access  Public
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ sortOrder: 1, name: 1 });
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error fetching all categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  getAllCategories,
};
