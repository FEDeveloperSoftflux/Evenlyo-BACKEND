const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../utils/mailer');

// --- Model loading utility ---
const getModelByUserType = (userType) => {
  switch (userType) {
    case 'client':
      return User;
    case 'vendor':
      return Vendor;
    case 'admin':
      return Admin;
    default:
      throw new Error('Invalid user type');
  }
};

// --- Login ---
exports.login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    // Validate required fields
    if (!email || !password || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and userType are required'
      });
    }

    // Validate userType
    if (!['client', 'vendor', 'admin'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Must be client, vendor, or admin'
      });
    }

    // Get appropriate model
    const UserModel = getModelByUserType(userType);
    
    let user;
    let userData;

    if (userType === 'client') {
      // For clients, search directly in User model
      user = await User.findOne({ email, userType: 'client', isActive: true });
      userData = user;
    } else if (userType === 'vendor') {
      // For vendors, search in User model and get vendor details
      user = await User.findOne({ email, userType: 'vendor', isActive: true });
      if (user) {
        userData = await Vendor.findOne({ userId: user._id }).populate('userId');
      }
    } else if (userType === 'admin') {
      // For admins, search in User model and get admin details
      user = await User.findOne({ email, userType: 'admin', isActive: true });
      if (user) {
        userData = await Admin.findOne({ userId: user._id }).populate('userId');
      }
    }

    // Check if user exists
    if (!user || !userData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Additional checks for admin
    if (userType === 'admin') {
      if (!userData.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }
    }

    // Additional checks for vendor
    if (userType === 'vendor') {
      if (userData.approvalStatus !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Vendor account is not approved yet. Please wait for approval.'
        });
      }
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    if (userData && userData.lastLogin !== undefined) {
      userData.lastLogin = new Date();
      await userData.save();
    }

    // Store session data
    req.session.user = {
      id: user._id,
      email: user.email,
      userType: user.userType,
      firstName: user.firstName,
      lastName: user.lastName
    };

    // Add role-specific data to session
    if (userType === 'admin') {
      req.session.user.role = userData.role;
      req.session.user.permissions = userData.permissions;
      req.session.user.department = userData.department;
    } else if (userType === 'vendor') {
      req.session.user.businessName = userData.businessName;
      req.session.user.approvalStatus = userData.approvalStatus;
    }

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        ...(userType === 'admin' && {
          role: userData.role,
          permissions: userData.permissions,
          department: userData.department
        }),
        ...(userType === 'vendor' && {
          businessName: userData.businessName,
          approvalStatus: userData.approvalStatus
        })
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// --- Logout---
exports.logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error during logout'
        });
      }
      
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Logout successful'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// --- Get Current User ---
exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { id, userType } = req.session.user;
    const UserModel = getModelByUserType(userType);
    
    let userData;
    
    if (userType === 'client') {
      userData = await User.findById(id).select('-password');
    } else if (userType === 'vendor') {
      userData = await Vendor.findOne({ userId: id }).populate('userId', '-password');
    } else if (userType === 'admin') {
      userData = await Admin.findOne({ userId: id }).populate('userId', '-password');
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: req.session.user.id,
        email: req.session.user.email,
        firstName: req.session.user.firstName,
        lastName: req.session.user.lastName,
        userType: req.session.user.userType,
        ...(userType === 'admin' && {
          role: userData.role,
          permissions: userData.permissions,
          department: userData.department
        }),
        ...(userType === 'vendor' && {
          businessName: userData.businessName,
          approvalStatus: userData.approvalStatus
        })
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// --- Reusable OTP helpers ---
async function generateAndSendOTP(email) {
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await OTP.create({ email, code: otpCode, expiresAt });
  await sendOTPEmail(email, otpCode);
}

async function verifyOTP(email, code) {
  const otpDoc = await OTP.findOne({ 
    email, 
    code, 
    expiresAt: { $gt: new Date() }, 
    verified: false 
  }).sort({ createdAt: -1 });
  
  if (!otpDoc) return false;
  
  otpDoc.verified = true;
  await otpDoc.save();
  return true;
}

// --- Registration OTP endpoints ---
exports.sendOtpForRegister = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    await generateAndSendOTP(email);
    res.json({ 
      success: true,
      message: 'OTP sent to email' 
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send OTP' 
    });
  }
};

exports.verifyOtpAndRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber, address, password, otp, userType } = req.body;
    
    if (!firstName || !lastName || !email || !contactNumber || !address || !password || !otp || !userType) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields and OTP are required' 
      });
    }

    // Validate userType for registration
    if (!['client', 'vendor'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Registration only available for client or vendor'
      });
    }

    // Verify OTP
    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      contactNumber,
      address,
      password: hashedPassword,
      userType,
      isActive: true
    });
    
    await user.save();

    // Create role-specific profile if vendor
    if (userType === 'vendor') {
      const vendor = new Vendor({
        userId: user._id,
        businessName: `${firstName} ${lastName}`,
        businessEmail: email,
        approvalStatus: 'pending'
      });
      await vendor.save();
    }

    res.status(201).json({ 
      success: true,
      message: 'Registration successful' 
    });
  } catch (err) {
    console.error('Verify OTP/Register error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

// --- Forgot Password OTP endpoints ---
exports.sendOtpForForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'No account found with this email' 
      });
    }

    await generateAndSendOTP(email);
    res.json({ 
      success: true,
      message: 'OTP sent to email' 
    });
  } catch (err) {
    console.error('Send OTP (forgot) error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send OTP' 
    });
  }
};

exports.verifyOtpForForgotPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and OTP are required' 
      });
    }

    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    res.json({ 
      success: true,
      message: 'OTP verified. You may now reset your password.' 
    });
  } catch (err) {
    console.error('Verify OTP (forgot) error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and new password are required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ 
      success: true,
      message: 'Password reset successful' 
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

// --- Client Registration ---
exports.registerClient = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber, address, password, otp } = req.body;
    
    if (!firstName || !lastName || !email || !contactNumber || !address || !password || !otp) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields and OTP are required' 
      });
    }

    // Verify OTP
    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create client user
    const user = new User({
      firstName,
      lastName,
      email,
      contactNumber,
      address,
      password: hashedPassword,
      userType: 'client',
      isActive: true
    });
    
    await user.save();

    res.status(201).json({ 
      success: true,
      message: 'Client registration successful' 
    });
  } catch (err) {
    console.error('Client registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};

// --- Vendor Registration ---
exports.registerVendor = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      contactNumber, 
      address, 
      password, 
      otp,
      businessName,
      businessEmail,
      businessPhone,
      businessAddress,
      businessWebsite,
      teamType,
      teamSize,
      businessLocation,
      businessDescription
    } = req.body;
    
    if (!firstName || !lastName || !email || !contactNumber || !address || !password || !otp || !businessName) {
      return res.status(400).json({ 
        success: false,
        message: 'All required fields and OTP are required' 
      });
    }

    // Verify OTP
    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create vendor user
    const user = new User({
      firstName,
      lastName,
      email,
      contactNumber,
      address,
      password: hashedPassword,
      userType: 'vendor',
      isActive: true
    });
    
    await user.save();

    // Create vendor profile
    const vendor = new Vendor({
      userId: user._id,
      businessName,
      businessEmail: businessEmail || email,
      businessPhone,
      businessAddress,
      businessWebsite,
      teamType: teamType || 'single',
      teamSize,
      businessLocation,
      businessDescription,
      approvalStatus: 'pending'
    });
    
    await vendor.save();

    res.status(201).json({ 
      success: true,
      message: 'Vendor registration successful. Your account is pending approval.' 
    });
  } catch (err) {
    console.error('Vendor registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: err.message 
    });
  }
};
