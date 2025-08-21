const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');
const { generateAndSendOTP, verifyOTP } = require('../utils/otpUtils');
const { auth } = require('../config/firebase');

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

// ================= CLIENT AUTH APIs =================
// --- Client Login ---
const performClientLogin = async (req, res) => {
  // ...existing code for performLogin with userType 'client'...
  return performLogin(req, res, 'client');
};

// --- Client Registration ---
const registerClient = async (req, res) => {
  return verifyOtpAndRegister(req, res, 'client');
};

// --- Get Current Client User ---
// (Reuses getCurrentUser, but you can add client-specific logic here if needed)

// ================= VENDOR AUTH APIs =================
// --- Vendor Login ---
const performVendorLogin = async (req, res) => {
  // ...existing code for performLogin with userType 'vendor'...
  return performLogin(req, res, 'vendor');
};

// --- Vendor Registration (Not yet implemented) ---
// (You can add vendor registration logic here in the future)

// --- Get Current Vendor User ---
// (Reuses getCurrentUser, but you can add vendor-specific logic here if needed)

// ================= ADMIN AUTH APIs =================
// --- Admin Login ---
const performAdminLogin = async (req, res) => {
  // ...existing code for performLogin with userType 'admin'...
  return performLogin(req, res, 'admin');
};

// --- Get Current Admin User ---
// (Reuses getCurrentUser, but you can add admin-specific logic here if needed)

// ================= SHARED/GENERAL AUTH APIs =================
// --- Shared Login Logic ---
const performLogin = async (req, res, userType) => {
  // ...existing code for performLogin...
  try {
    const { email, password, fcmToken } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
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

    // Check if user is a social login user trying to login with password
    if (user.provider === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Please use Google authentication.'
      });
    }

    // Update FCM token if provided
    if (fcmToken) {
      user.fcmToken = fcmToken;
      await user.save();
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


// --- Separate Login APIs ---
// Client Login (supports Google OAuth + FCM token)
const clientLogin = async (req, res) => {
  // If Google OAuth login (no password, has uid/fcmToken)
  const { uid, email, name, fcmToken } = req.body;
  if (uid && email && name && fcmToken) {
    try {
      let user = await User.findOne({ email, userType: 'client' });
      if (user) {
        user.fcmToken = fcmToken;
        await user.save();
        return res.json({ success: true, message: 'User login, FCM token updated', user });
      } else {
        user = new User({
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' ') || '',
          email,
          provider: 'google',
          fcmToken,
          userType: 'client',
          isActive: true
        });
        await user.save();
        return res.json({ success: true, message: 'User created', user });
      }
    } catch (error) {
      console.error('User login error:', error);
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
  // Otherwise, fallback to normal login (email/password)
  return performLogin(req, res, 'client');
};

// Vendor Login
const vendorLogin = performVendorLogin;

// Admin Login
const adminLogin = performAdminLogin;



// --- Logout---
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: 'Error during logout'
        });
      }

      res.clearCookie('evenlyo.sid');
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
const getCurrentUser = async (req, res) => {
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

    let responseUser = {
      id: req.session.user.id,
      email: req.session.user.email,
      firstName: req.session.user.firstName,
      lastName: req.session.user.lastName,
      userType: req.session.user.userType
    };

    if (userType === 'client') {
      userData = await User.findById(id).select('-password');
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    } else if (userType === 'vendor') {
      userData = await Vendor.findOne({ userId: id }).populate('userId', '-password');
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'Vendor profile not found'
        });
      }
      responseUser.businessName = userData.businessName;
      responseUser.approvalStatus = userData.approvalStatus;
    } else if (userType === 'admin') {
      userData = await Admin.findOne({ userId: id }).populate('userId', '-password');
      if (!userData) {
        return res.status(404).json({
          success: false,
          message: 'Admin profile not found'
        });
      }
      responseUser.role = userData.role;
      responseUser.permissions = userData.permissions;
      responseUser.department = userData.department;
    }

    res.json({
      success: true,
      user: responseUser
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// --- Registration OTP endpoints ---
const sendOtpForRegister = async (req, res) => {
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

const verifyOtpAndRegister = async (req, res, userType = 'client') => {
  try {
    const { firstName, lastName, email, contactNumber, address, password, confirmPassword, otp } = req.body;

    if (!firstName || !lastName || !email || !contactNumber || !address || !password || !confirmPassword || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields including password confirmation and OTP are required'
      });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match'
      });
    }

    // Validate userType for registration
    if (!['client', 'vendor'].includes(userType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Registration only available for client or vendor'
      });
    }

    // Currently only client registration is implemented
    if (userType === 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Vendor registration is not yet implemented. Please use client registration.'
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

    // Future: Create role-specific profile if vendor
    // if (userType === 'vendor') {
    //   // Vendor profile creation logic will be implemented here
    // }

    const successMessage = userType === 'vendor' 
      ? 'Vendor registration successful. Your account is pending approval.'
      : 'Client registration successful';

    res.status(201).json({
      success: true,
      message: successMessage
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
const sendOtpForForgotPassword = async (req, res) => {
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

    // Check if user is a social login user
    if (user.provider === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Password reset is not available for social login accounts. Please use Google to sign in.'
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

const verifyOtpForForgotPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Check if user exists and is not a social login user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    if (user.provider === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Password reset is not available for social login accounts.'
      });
    }

    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Store verified email in session for password reset
    req.session.verifiedEmailForReset = email;

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

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    
    // Get email from session (set after OTP verification)
    const email = req.session.verifiedEmailForReset;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please verify OTP again before resetting password.'
      });
    }
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is a social login user
    if (user.provider === 'google') {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Password reset is not available for social login accounts. Please use Google to sign in.'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    // Clear the session data after successful password reset
    delete req.session.verifiedEmailForReset;

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
const verifyOtpAndRegisterGeneral = async (req, res) => {
  try {
    const { userType } = req.body;
    
    // If userType is provided in body, use it; otherwise default to 'client'
    const targetUserType = userType || 'client';
    
    // Validate userType
    if (!['client', 'vendor'].includes(targetUserType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userType. Must be client or vendor'
      });
    }

    // Currently only client registration is implemented
    if (targetUserType === 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Vendor registration is not yet implemented. Please use client registration.'
      });
    }
    
    return verifyOtpAndRegister(req, res, targetUserType);
  } catch (error) {
    console.error('General registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// --- Google Authentication ---
const googleAuth = async (req, res) => {
  try {
    const { idToken, fcmToken } = req.body;

    // Validate required fields
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    // Verify the ID token with Firebase
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Firebase token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired ID token'
      });
    }

    // Extract user information from decoded token
    const { uid, email, name, picture } = decodedToken;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required from Google account'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email, userType: 'client', isActive: true });

    if (user) {
      // User exists - block Google login if registered with email/password
      if (user.provider === 'email') {
        return res.status(403).json({
          success: false,
          message: 'This email is registered with email/password. Please use email and password to login.'
        });
      }
      // User is a Google user, allow login
      user.lastLogin = new Date();
      if (fcmToken) 
        {
        user.fcmToken = fcmToken;
      }
      await user.save();
      req.session.user = {
        id: user._id,
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
        lastName: user.lastName
      };
      return res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          profileImage: user.profileImage
        }
      });
    } else {
      // User doesn't exist - create new user
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || '';

      user = new User({
        firstName,
        lastName,
        email,
        userType: 'client',
        googleId: uid,
        provider: 'google',
        password: null, // Explicitly set password to null for Google users
        profileImage: picture || undefined,
        isActive: true,
        lastLogin: new Date(),
        ...(fcmToken && { fcmToken })
      });

      await user.save();

      // Store session data
      req.session.user = {
        id: user._id,
        email: user.email,
        userType: user.userType,
        firstName: user.firstName,
        lastName: user.lastName
      };

      return res.status(201).json({
        success: true,
        message: 'Registration and login successful',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          profileImage: user.profileImage
        }
      });
    }

  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// --- Exports ---
module.exports = {
  // Authentication
  clientLogin,
  vendorLogin,
  adminLogin,
  
  logout,
  getCurrentUser,
  googleAuth,

  // Registration
  registerClient,
  verifyOtpAndRegister: verifyOtpAndRegisterGeneral,

  // OTP Management
  sendOtpForRegister,
  sendOtpForForgotPassword,
  verifyOtpForForgotPassword,

  // Password Management
  resetPassword
};
