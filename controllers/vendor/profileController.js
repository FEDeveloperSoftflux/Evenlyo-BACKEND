// Vendor Profile Controller
const Vendor = require('../../models/Vendor');
const User = require('../../models/User');
const Category = require('../../models/Category');
const SubCategory = require('../../models/SubCategory');

// Get vendor profile (fields depend on account type)
const getProfile = async (req, res) => {
  try {
    // Find the vendor document for the logged-in user and populate userId
    const vendor = await Vendor.findOne({ userId: req.user.id })
      .populate('userId')
      .populate({ path: 'mainCategories', select: 'name' })
      .populate({ path: 'subCategories', select: 'name mainCategory' });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Assume account type is determined by businessName: if present, business; else, personal
    const isBusiness = !!vendor.businessName;
    let profile = {};
    if (isBusiness) {
      // Map categories into a cleaner shape
      const mappedMainCategories = (vendor.mainCategories || []).map(c => ({
        _id: c._id,
        name: c.name
      }));
      const mappedSubCategories = (vendor.subCategories || []).map(sc => ({
        _id: sc._id,
        name: sc.name,
        mainCategory: sc.mainCategory
      }));
      profile = {
        accountType: 'business',
        businessName: vendor.businessName,
        businessEmail: vendor.businessEmail,
        businessPhone: vendor.businessPhone,
        businessAddress: vendor.businessAddress,
        businessWebsite: vendor.businessWebsite,
        businessLocation: vendor.businessLocation,
        businessLogo: vendor.businessLogo,
        bannerImage: vendor.bannerImage,
        businessDescription: vendor.businessDescription,
        teamType: vendor.teamType,
        teamSize: vendor.teamSize,
        kvkNumber: vendor.userId.kvkNumber || '',
        mainCategories: mappedMainCategories,
        subCategories: mappedSubCategories,
      };
    } else {
      profile = {
        accountType: 'personal',
        firstName: vendor.userId.firstName,
        lastName: vendor.userId.lastName,
        email: vendor.userId.email,
        contactNumber: vendor.userId.contactNumber,
        address: vendor.userId.address,
        profileImage: vendor.userId.profileImage,
        passportNumber: vendor.userId.passportNumber || ''
      };
    }
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update vendor profile (fields depend on account type)
const updateProfile = async (req, res) => {
  try {
    // Populate userId so user.save works for personal accounts
    const vendor = await Vendor.findOne({ userId: req.user.id }).populate('userId');
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const isBusiness = !!vendor.businessName;

    // Shared helper to update categories / subcategories if supplied
    const updateCategoriesIfProvided = async () => {
      const { mainCategories, subCategories } = req.body;

      // Only process if at least one of them is provided
      if (mainCategories === undefined && subCategories === undefined) return;

      // Validate types
      if (mainCategories !== undefined && !Array.isArray(mainCategories)) {
        return res.status(400).json({ message: 'mainCategories must be an array of category IDs' });
      }
      if (subCategories !== undefined && !Array.isArray(subCategories)) {
        return res.status(400).json({ message: 'subCategories must be an array of subCategory IDs' });
      }

      // Fetch & validate main categories
      let validMainCategoryIds = vendor.mainCategories.map(id => id.toString());
      if (Array.isArray(mainCategories)) {
        // Remove duplicates
        const uniqueMain = [...new Set(mainCategories.map(String))];
        const foundMain = await Category.find({ _id: { $in: uniqueMain }, isActive: true }).select('_id');
        if (foundMain.length !== uniqueMain.length) {
          const foundIds = new Set(foundMain.map(c => c._id.toString()));
            const missing = uniqueMain.filter(id => !foundIds.has(id));
          return res.status(400).json({ message: 'Some main categories not found or inactive', missing });
        }
        validMainCategoryIds = uniqueMain; // Replace vendor main categories fully (idempotent replace strategy)
      }

      // Fetch & validate sub categories
      if (Array.isArray(subCategories)) {
        const uniqueSubs = [...new Set(subCategories.map(String))];
        const foundSubs = await SubCategory.find({ _id: { $in: uniqueSubs }, isActive: true })
          .select('_id mainCategory');
        if (foundSubs.length !== uniqueSubs.length) {
          const foundIds = new Set(foundSubs.map(s => s._id.toString()));
          const missing = uniqueSubs.filter(id => !foundIds.has(id));
          return res.status(400).json({ message: 'Some subCategories not found or inactive', missing });
        }
        // Ensure every subcategory belongs to one of the provided (or existing) main categories
        const allowedMainSet = new Set(validMainCategoryIds);
        const invalidRelations = foundSubs.filter(s => !allowedMainSet.has(s.mainCategory.toString()));
        if (invalidRelations.length) {
          return res.status(400).json({
            message: 'SubCategory does not belong to one of the specified mainCategories',
            invalid: invalidRelations.map(s => ({ subCategoryId: s._id, mainCategory: s.mainCategory }))
          });
        }
        // Passed validation -> assign
        vendor.subCategories = uniqueSubs;
      } else if (mainCategories !== undefined && subCategories === undefined) {
        // If only mainCategories updated, remove subCategories that no longer align
        vendor.subCategories = vendor.subCategories.filter(subId => vendor.subCategories.includes(subId));
      }

      vendor.mainCategories = validMainCategoryIds;
    };

    if (isBusiness) {
      // Update business fields
      const fields = [
        'businessName', 'businessEmail', 'businessPhone', 'businessAddress',
        'businessWebsite', 'businessLocation', 'businessLogo', 'bannerImage',
        'businessDescription', 'teamType', 'teamSize'
      ];
      fields.forEach(field => {
        if (req.body[field] !== undefined) vendor[field] = req.body[field];
      });
      // Update KVK number in User model if provided
      if (req.body.kvkNumber !== undefined) {
        vendor.userId.kvkNumber = req.body.kvkNumber;
        await vendor.userId.save();
      }
      // Handle gallery update if provided
      if (req.body.gallery !== undefined) {
        if (Array.isArray(req.body.gallery)) {
          vendor.gallery = {
            ...vendor.gallery,
            workImages: req.body.gallery
          };
        } else if (typeof req.body.gallery === 'object' && req.body.gallery !== null && !Array.isArray(req.body.gallery)) {
          vendor.gallery = {
            ...vendor.gallery,
            ...req.body.gallery
          };
        } else {
          console.error('Invalid gallery type:', req.body.gallery);
          return res.status(400).json({ message: 'Invalid gallery format. Must be an object or array.' });
        }
      }
      // Category handling
      await updateCategoriesIfProvided();
      await vendor.save();
      return res.json({ message: 'Business profile updated successfully' });
    } else {
      // Update personal fields in User model
      const user = vendor.userId;
      const fields = ['firstName', 'lastName', 'email', 'contactNumber', 'address', 'profileImage'];
      fields.forEach(field => {
        if (req.body[field] !== undefined) user[field] = req.body[field];
      });
      if (req.body.passportNumber !== undefined) {
        user.passportNumber = req.body.passportNumber;
      }
      // Allow personal vendors also to manage categories if needed
      await updateCategoriesIfProvided();
      await Promise.all([user.save(), vendor.save()]);
      return res.json({ message: 'Personal profile updated successfully' });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
