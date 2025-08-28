// Vendor Profile Controller
const Vendor = require('../../models/Vendor');
const User = require('../../models/User');

// Get vendor profile (fields depend on account type)
const getProfile = async (req, res) => {
  try {
    // Find the vendor document for the logged-in user
    const vendor = await Vendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Assume account type is determined by businessName: if present, business; else, personal
    const isBusiness = !!vendor.businessName;
    let profile = {};
    if (isBusiness) {
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
        teamSize: vendor.teamSize
      };
    } else {
      profile = {
        accountType: 'personal',
        firstName: vendor.userId.firstName,
        lastName: vendor.userId.lastName,
        email: vendor.userId.email,
        contactNumber: vendor.userId.contactNumber,
        address: vendor.userId.address,
        profileImage: vendor.userId.profileImage
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
    const vendor = await Vendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Assume account type is determined by businessName: if present, business; else, personal
    const isBusiness = !!vendor.businessName;
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
      // Handle gallery update if provided
      if (req.body.gallery !== undefined) {
        if (Array.isArray(req.body.gallery)) {
          // If gallery is sent as an array, treat as workImages
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
          // Invalid gallery type, log and return error
          console.error('Invalid gallery type:', req.body.gallery);
          return res.status(400).json({ message: 'Invalid gallery format. Must be an object or array.' });
        }
      }
      await vendor.save();
      return res.json({ message: 'Business profile updated successfully' });
    } else {
      // Update personal fields in User model
      const user = vendor.userId;
      const fields = ['firstName', 'lastName', 'email', 'contactNumber', 'address', 'profileImage'];
      fields.forEach(field => {
        if (req.body[field] !== undefined) user[field] = req.body[field];
      });
      await user.save();
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
