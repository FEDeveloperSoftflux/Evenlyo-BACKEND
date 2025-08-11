const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const multer = require('multer');
const path = require('path');

// --- Utility function to get user model ---
const getUserData = async (userId, userType) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (userType === 'vendor') {
    const vendor = await Vendor.findOne({ userId: userId }).populate('userId');
    return vendor || user;
  }
  
  return user;
};

// --- Personal Information APIs ---

// Get user profile information
const getPersonalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    const userData = await getUserData(userId, userType);
    const user = userType === 'vendor' ? userData.userId : userData;

    res.json({
      success: true,
      data: {
        profileImage: user.profileImage || null,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        contactNumber: user.contactNumber,
        address: {
          city: user.address?.city || '',
          postalCode: user.address?.postalCode || '',
          fullAddress: user.address?.fullAddress || ''
        },
        userType: user.userType,
        language: user.language
      }
    });
  } catch (error) {
    console.error('Get personal info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve personal information',
      error: error.message
    });
  }
};

// Update user profile information
const updatePersonalInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { contactNumber, address, language } = req.body;

    // Validate input
    const allowedUpdates = ['contactNumber', 'address', 'language'];
    const updates = {};

    if (contactNumber !== undefined) {
      if (!contactNumber || contactNumber.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Contact number cannot be empty'
        });
      }
      updates.contactNumber = contactNumber.trim();
    }

    if (address !== undefined) {
      updates.address = {
        city: address.city || '',
        postalCode: address.postalCode || '',
        fullAddress: address.fullAddress || ''
      };
    }

    if (language !== undefined) {
      if (!['english', 'dutch'].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid language. Must be either english or dutch'
        });
      }
      updates.language = language;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Personal information updated successfully',
      data: {
        contactNumber: updatedUser.contactNumber,
        address: updatedUser.address,
        language: updatedUser.language
      }
    });
  } catch (error) {
    console.error('Update personal info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update personal information',
      error: error.message
    });
  }
};

// Update profile picture
const updateProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture uploaded'
      });
    }

    // Testing purpose
    const profileImagePath = `/uploads/profiles/${req.file.filename}`;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { profileImage: profileImagePath } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      data: {
        profileImage: updatedUser.profileImage
      }
    });
  } catch (error) {
    console.error('Update profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile picture',
      error: error.message
    });
  }
};

// --- Security Details APIs ---

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    // Validate required fields
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Old password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get user from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has a password (for social login users)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for social login accounts'
      });
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await User.findByIdAndUpdate(userId, {
      $set: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// --- Notification Settings APIs ---

// Get notification settings
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize notifications if they don't exist
    if (!user.notifications) {
      user.notifications = { email: true, push: true };
      await user.save();
    }

    res.json({
      success: true,
      data: {
        emailNotifications: user.notifications?.email ?? true,
        pushNotifications: user.notifications?.push ?? true
      }
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification settings',
      error: error.message
    });
  }
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailNotifications, pushNotifications } = req.body;

    // Validate input
    const updates = {};
    
    if (emailNotifications !== undefined) {
      if (typeof emailNotifications !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'emailNotifications must be a boolean value'
        });
      }
      updates['notifications.email'] = emailNotifications;
    }

    if (pushNotifications !== undefined) {
      if (typeof pushNotifications !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'pushNotifications must be a boolean value'
        });
      }
      updates['notifications.push'] = pushNotifications;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No notification settings to update'
      });
    }

    // First, get current user to ensure they exist
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize notifications object if it doesn't exist
    if (!currentUser.notifications) {
      currentUser.notifications = { email: true, push: true };
      await currentUser.save();
    }

    // Update the notifications
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update user'
      });
    }

    // Return the updated notification settings
    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        emailNotifications: updatedUser.notifications?.email ?? true,
        pushNotifications: updatedUser.notifications?.push ?? true
      }
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message
    });
  }
};

module.exports = {
  // Personal Information
  getPersonalInfo,
  updatePersonalInfo,
  updateProfilePicture,
  
  // Security Details
  changePassword,
  
  // Notification Settings
  getNotificationSettings,
  updateNotificationSettings
};
