const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
const Listing = require('../../models/Listing');
const Booking = require('../../models/Booking');

const getAllListingManagementData = async (req, res) => {
  try {
    // Stats Card
    const totalCategories = await Category.countDocuments();
    const totalSubCategories = await SubCategory.countDocuments();
    const totalListings = await Listing.countDocuments();
    const totalSaleItems = await Listing.countDocuments({ type: 'sale' });

    // Get all categories
    const categories = await Category.find();

    // Aggregate bookings by category via listing
    const bookings = await Booking.aggregate([
      {
        $lookup: {
          from: 'listings',
          localField: 'listingId',
          foreignField: '_id',
          as: 'listingInfo',
        },
      },
      { $unwind: '$listingInfo' },
      {
        $group: {
          _id: '$listingInfo.category',
          count: { $sum: 1 },
        },
      },
    ]);

    // Map category _id to count
    const bookingCountMap = {};
    bookings.forEach(b => {
      bookingCountMap[b._id?.toString()] = b.count;
    });

    // Prepare result for all categories (include id)
    const categoryBookings = categories.map(cat => ({
      id: cat._id,
      category: cat.name,
      count: bookingCountMap[cat._id.toString()] || 0
    }));

    // Table Data (using mainCategory, include id)
    const tableData = await Promise.all(
      categories.map(async cat => {
        const subCatCount = await SubCategory.countDocuments({ mainCategory: cat._id });
        return {
          id: cat._id,
          icon: cat.icon || '',
          name: cat.name,
          description: cat.description,
          totalSubCategories: subCatCount,
        };
      })
    );

    res.json({
      statsCard: {
        totalCategories,
        totalSubCategories,
        totalListings,
        totalSaleItems,
      },
      categoryBookings,
      tableData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get subcategories by main category id
const getSubCategoriesByMainCategory = async (req, res) => {
  try {
    const { mainCategoryId } = req.params;
    if (!mainCategoryId) {
      return res.status(400).json({ error: 'mainCategoryId is required' });
    }
    const subcategories = await SubCategory.find({ mainCategory: mainCategoryId });
    const result = subcategories.map(sub => ({
      id: sub._id,
      icon: sub.icon || '',
      name: sub.name,
      description: sub.description,
      status: sub.isActive ? 'active' : 'deactive',
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle subcategory active status by subcategory id
const toggleSubCategoryStatus = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    if (!subCategoryId) {
      return res.status(400).json({ error: 'subCategoryId is required' });
    }
    const subcategory = await SubCategory.findById(subCategoryId);
    if (!subcategory) {
      return res.status(404).json({ error: 'SubCategory not found' });
    }
    subcategory.isActive = !subcategory.isActive;
    await subcategory.save();
    res.json({
      id: subcategory._id,
      status: subcategory.isActive ? 'active' : 'deactive',
      message: `SubCategory status toggled to ${subcategory.isActive ? 'active' : 'deactive'}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create new subcategory
const createSubCategory = async (req, res) => {
  try {
    const { name, icon, mainCategoryId, description } = req.body;
    if (!name || !mainCategoryId) {
      return res.status(400).json({ error: 'Name and mainCategoryId are required' });
    }
    // Build subcategory object
    const subCategoryData = {
      name: typeof name === 'object' ? name : { en: name, nl: name },
      icon: icon || '',
      mainCategory: mainCategoryId,
      description: typeof description === 'object' ? description : { en: description || '', nl: description || '' }
    };
    const subcategory = new SubCategory(subCategoryData);
    await subcategory.save();
    res.status(201).json({
      id: subcategory._id,
      name: subcategory.name,
      icon: subcategory.icon,
      mainCategory: subcategory.mainCategory,
      description: subcategory.description,
      status: subcategory.isActive ? 'active' : 'deactive',
      message: 'SubCategory created successfully'
    });
  } catch (err) {
    // Handle duplicate key error for unique name/mainCategory
    if (err.code === 11000) {
      return res.status(409).json({ error: 'SubCategory name already exists for this main category' });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllListingManagementData,
  getSubCategoriesByMainCategory,
  toggleSubCategoryStatus,
  createSubCategory
};

