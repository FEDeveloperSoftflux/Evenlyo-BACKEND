const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');
const Listing = require('../../models/Listing');
const Booking = require('../../models/Booking');
const Item = require('../../models/Item');
const Purchase = require('../../models/Purchase');

const getAllListingManagementData = async (req, res) => {
  try {
    // Stats Card
    const totalCategories = await Category.countDocuments();
    const totalSubCategories = await SubCategory.countDocuments();
    const totalListings = await Listing.countDocuments();
    const totalServiceItems = await Item.countDocuments();

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

    // Aggregate purchases by category via service items
    const purchases = await Purchase.aggregate([
      {
        $lookup: {
          from: 'serviceitems', // Collection name for Item model
          localField: 'item',
          foreignField: '_id',
          as: 'itemInfo',
        },
      },
      { $unwind: '$itemInfo' },
      {
        $group: {
          _id: '$itemInfo.mainCategory',
          count: { $sum: 1 },
        },
      },
    ]);

    // Map purchase category _id to count
    const purchaseCountMap = {};
    purchases.forEach(p => {
      purchaseCountMap[p._id?.toString()] = p.count;
    });

    // Prepare result for all categories (include id)
    const categoryBookings = categories.map(cat => ({
      id: cat._id,
      category: cat.name,
      count: bookingCountMap[cat._id.toString()] || 0
    }));

    // Prepare purchase results for all categories
    const categoryPurchases = categories.map(cat => ({
      id: cat._id,
      category: cat.name,
      count: purchaseCountMap[cat._id.toString()] || 0
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
        totalServiceItems,
      },
      categoryBookings,
      categoryPurchases,
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
    const { name, icon, mainCategoryId, description, escrowEnabled, upfrontFeePercent, upfrontHour, evenlyoProtectFeePercent } = req.body;
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

    // Optional payment fields with validation and defaults
  if (escrowEnabled !== undefined) subCategoryData.escrowEnabled = Boolean(escrowEnabled);
    if (upfrontFeePercent !== undefined) {
      const v = Number(upfrontFeePercent);
      if (Number.isNaN(v) || v < 0 || v > 100) return res.status(400).json({ error: 'upfrontFeePercent must be between 0 and 100' });
      subCategoryData.upfrontFeePercent = v;
    }
    if (upfrontHour !== undefined) {
      const v = Number(upfrontHour);
      if (Number.isNaN(v) || v < 0) return res.status(400).json({ error: 'upfrontHour must be a non-negative number' });
      subCategoryData.upfrontHour = v;
    }
    if (evenlyoProtectFeePercent !== undefined) {
      const v = Number(evenlyoProtectFeePercent);
      if (Number.isNaN(v) || v < 0 || v > 100) return res.status(400).json({ error: 'evenlyoProtectFeePercent must be between 0 and 100' });
      subCategoryData.evenlyoProtectFeePercent = v;
    }
    // If escrow is enabled, ensure upfront fields are valid/present
    if (subCategoryData.escrowEnabled) {
      const effUpfrontPercent =
        subCategoryData.upfrontFeePercent !== undefined ? subCategoryData.upfrontFeePercent : 0;
      const effUpfrontHour =
        subCategoryData.upfrontHour !== undefined ? subCategoryData.upfrontHour : 0;
      if (effUpfrontPercent <= 0 || effUpfrontPercent > 100) {
        return res.status(400).json({ error: 'When escrowEnabled is true, upfrontFeePercent must be between 1 and 100' });
      }
      if (effUpfrontHour <= 0) {
        return res.status(400).json({ error: 'When escrowEnabled is true, upfrontHour must be greater than 0' });
      }
    }

    const subcategory = new SubCategory(subCategoryData);
    await subcategory.save();
    res.status(201).json({
      id: subcategory._id,
      name: subcategory.name,
      icon: subcategory.icon,
      mainCategory: subcategory.mainCategory,
      description: subcategory.description,
      escrowEnabled: subcategory.escrowEnabled,
      upfrontFeePercent: subcategory.upfrontFeePercent,
      upfrontHour: subcategory.upfrontHour,
      evenlyoProtectFeePercent: subcategory.evenlyoProtectFeePercent,
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

// Edit subcategory details by subcategory id
const editSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;
    if (!subCategoryId) {
      return res.status(400).json({ error: 'subCategoryId is required' });
    }
    const subcategory = await SubCategory.findById(subCategoryId);
    if (!subcategory) {
      return res.status(404).json({ error: 'SubCategory not found' });
    }

    const { name, icon, mainCategoryId, description, isActive, escrowEnabled, upfrontFeePercent, upfrontHour, evenlyoProtectFeePercent } = req.body;

    // Update fields only if provided
    if (name !== undefined) {
      subcategory.name = typeof name === 'object' ? name : { en: name, nl: name };
    }
    if (icon !== undefined) subcategory.icon = icon;
    if (mainCategoryId !== undefined) subcategory.mainCategory = mainCategoryId;
    if (description !== undefined) {
      subcategory.description = typeof description === 'object' ? description : { en: description || '', nl: description || '' };
    }
    if (isActive !== undefined) subcategory.isActive = Boolean(isActive);

    // Update payment fields if provided
    if (escrowEnabled !== undefined) subcategory.escrowEnabled = Boolean(escrowEnabled);
    if (upfrontFeePercent !== undefined) {
      const v = Number(upfrontFeePercent);
      if (Number.isNaN(v) || v < 0 || v > 100) return res.status(400).json({ error: 'upfrontFeePercent must be between 0 and 100' });
      subcategory.upfrontFeePercent = v;
    }
    if (upfrontHour !== undefined) {
      const v = Number(upfrontHour);
      if (Number.isNaN(v) || v < 0) return res.status(400).json({ error: 'upfrontHour must be a non-negative number' });
      subcategory.upfrontHour = v;
    }
    if (evenlyoProtectFeePercent !== undefined) {
      const v = Number(evenlyoProtectFeePercent);
      if (Number.isNaN(v) || v < 0 || v > 100) return res.status(400).json({ error: 'evenlyoProtectFeePercent must be between 0 and 100' });
      subcategory.evenlyoProtectFeePercent = v;
    }

    await subcategory.save();

    res.json({
      id: subcategory._id,
      name: subcategory.name,
      icon: subcategory.icon,
      mainCategory: subcategory.mainCategory,
      description: subcategory.description,
      escrowEnabled: subcategory.escrowEnabled,
      upfrontFeePercent: subcategory.upfrontFeePercent,
      upfrontHour: subcategory.upfrontHour,
      evenlyoProtectFeePercent: subcategory.evenlyoProtectFeePercent,
      status: subcategory.isActive ? 'active' : 'deactive',
      message: 'SubCategory updated successfully'
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
  createSubCategory,
  editSubCategory
};

