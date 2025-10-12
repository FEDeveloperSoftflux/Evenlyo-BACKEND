const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');
const { generateAndSendOTP, verifyOTP } = require('../utils/otpUtils');
const { auth } = require('../config/firebase');
const { signAccessToken } = require('../utils/jwtUtils');

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

// --- Client Login ---
const clientLogin = async (req, res) => {
  return performLogin(req, res, 'client');
};

// --- Client Registration ---
const registerClient = async (req, res) => {
  return verifyOtpAndRegister(req, res, 'client');
};

// --- Admin Login ---
const performAdminLogin = async (req, res) => 
  {
  // ...existing code for performLogin with userType 'admin'...
  return performLogin(req, res, 'admin');
};

// Helper to build JWT access token only (refresh tokens disabled)
const buildAccessToken = (userDoc, extra = {}) => {
  return signAccessToken({
    id: userDoc._id,
    email: userDoc.email,
    userType: userDoc.userType,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    ...extra
  });
};

const performLogin = async (req, res, userType) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
      // Removed super admin environment variable login logic

    // Get appropriate model
    const UserModel = getModelByUserType(userType);

    let user;
    let userData;

    if (userType === 'client') {
      // For clients, search directly in User model
      user = await User.findOne({ email, userType: 'client', isActive: true });
      userData = user;
    } else if (userType === 'vendor') {
      // For vendors: first try Vendor user account, else try Employee (role user) login
      user = await User.findOne({ email, userType: 'vendor', isActive: true });
      let employeeLogin = false;
      let employee = null;
      if (user) {
        userData = await Vendor.findOne({ userId: user._id }).populate('userId');
      } else {
        // Try employee (role user) login
        employee = await require('../models/Employee').findOne({ email, status: 'active' }).populate('designation');
        if (employee) {
          employeeLogin = true;
          // Build a user-like object for token creation
          user = {
            _id: employee._id,
            email: employee.email,
            userType: 'vendor',
            firstName: employee.firstName,
            lastName: employee.lastName
          };
          // Load vendor profile for extra data
          userData = await Vendor.findById(employee.vendor).populate('userId');
        }
      }
      // attach flags for later checks
      user && (user._isEmployeeLogin = !!employeeLogin);
      user && (user._employeeDoc = employee);
    } else if (userType === 'admin') {
      // For admins, try the normal admin user account first
      user = await User.findOne({ email, userType: 'admin', isActive: true });
      let adminEmployeeLogin = false;
      let adminEmployee = null;
      if (user) {
        userData = await Admin.findOne({ userId: user._id }).populate('userId');
      } else {
        // Try admin employee login
        adminEmployee = await require('../models/AdminEmployee').findOne({ email, status: 'active' }).populate('designation');
        if (adminEmployee) {
          adminEmployeeLogin = true;
          user = {
            _id: adminEmployee._id,
            email: adminEmployee.email,
            userType: 'admin',
            firstName: adminEmployee.firstName,
            lastName: adminEmployee.lastName
          };
          // Build userData as admin root info if needed
          userData = { role: 'admin', permissions: adminEmployee.designation ? adminEmployee.designation.permissions.map(p => p.module) : [], department: 'operations' };
        }
      }
      user && (user._isAdminEmployeeLogin = !!adminEmployeeLogin);
      user && (user._adminEmployeeDoc = adminEmployee);
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

    // Verify password
    let isPasswordValid = false;
    // Determine which stored hash to use (vendor employee, admin employee, or main user)
    let storedHash;
    if (user._isEmployeeLogin && user._employeeDoc) {
      storedHash = user._employeeDoc.password;
    } else if (user._isAdminEmployeeLogin && user._adminEmployeeDoc) {
      storedHash = user._adminEmployeeDoc.password;
    } else {
      storedHash = user.password;
    }

    // If stored hash is missing, fail fast with invalid credentials
    if (!storedHash) {
      console.warn('Login attempt with missing password hash for user:', user && user.email);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    isPasswordValid = await bcrypt.compare(password, storedHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Additional checks for admin
    if (userType === 'admin') {
      // If admin employee login, check the AdminEmployee.status instead of userData
      if (user._isAdminEmployeeLogin && user._adminEmployeeDoc) {
        if (user._adminEmployeeDoc.status !== 'active') {
          return res.status(403).json({ success: false, message: 'Account is deactivated. Please contact support.' });
        }
      } else {
        if (userData && userData.isActive === false) {
          return res.status(403).json({
            success: false,
            message: 'Account is deactivated. Please contact support.'
          });
        }
      }
    }


    // Update last login for User model if present
    try {
      if (!user._isEmployeeLogin && user.save) {
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
      }
      // Vendor profile lastLogin not tracked consistently; skip if not present
    } catch (e) {
      // non-fatal
      console.warn('Could not update lastLogin:', e.message || e);
    }

    // Determine extra props for token
    const extraPayload = {};
    if (userType === 'admin') {
      extraPayload.role = userData.role;
      extraPayload.permissions = userData.permissions;
      extraPayload.department = userData.department;
    } else if (userType === 'vendor') {
      // If this was an employee login, include employee-specific payload
      if (user._isEmployeeLogin && user._employeeDoc) {
        const emp = user._employeeDoc;
        extraPayload.vendorId = emp.vendor;
        extraPayload.employeeId = emp._id;
        extraPayload.designation = emp.designation ? emp.designation.name : undefined;
      } else {
        extraPayload.businessName = userData.businessName;
        extraPayload.approvalStatus = userData.approvalStatus;
        extraPayload.vendorId = userData._id;
      }
    }

  const accessToken = buildAccessToken(user, extraPayload);

    // Return success response
    // Build response user object, include pages for employee role-users
    const responseUser = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType
    };

    if (userType === 'admin') {
      if (user._isAdminEmployeeLogin && user._adminEmployeeDoc) {
        const admEmp = user._adminEmployeeDoc;
        responseUser.designation = admEmp.designation ? admEmp.designation.name : null;
        responseUser.pages = Array.isArray(admEmp.designation?.permissions)
          ? admEmp.designation.permissions.map(p => p.module)
          : [];
        responseUser.status = admEmp.status;
      } else {
        responseUser.role = userData.role;
        responseUser.permissions = userData.permissions;
        responseUser.department = userData.department;
      }
    }

    if (userType === 'vendor') {
      if (user._isEmployeeLogin && user._employeeDoc) {
        const emp = user._employeeDoc;
        responseUser.designation = emp.designation ? emp.designation.name : null;
        // pages: array of permission module names
        responseUser.pages = Array.isArray(emp.designation?.permissions)
          ? emp.designation.permissions.map(p => p.module)
          : [];
        responseUser.vendorId = emp.vendor;
        responseUser.employeeId = emp._id;
      } else {
        responseUser.businessName = userData.businessName;
        responseUser.approvalStatus = userData.approvalStatus;
        responseUser.vendorId = userData._id;
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      tokens: { access: accessToken },
      user: responseUser
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

// Admin Login
const adminLogin = performAdminLogin;
  


// --- Logout (stateless) ---
const logout = async (_req, res) => {
  // Client should discard JWT. No server state to clear.
  res.json({ success: true, message: 'Logged out (stateless). Discard your token client-side.' });
};

// --- Get Current User ---
const getCurrentUser = async (req, res) => {
  try {
    // Prefer req.user (set by requireAuth with JWT) else fallback to legacy session
    const base = req.user || req.session?.user;
    if (!base) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { id, userType } = base;
    let responseUser = {
      id,
      email: base.email,
      firstName: base.firstName,
      lastName: base.lastName,
      userType
    };

    if (userType === 'client') {
      const userData = await User.findById(id).select('-password');
      if (!userData) return res.status(404).json({ success: false, message: 'User not found' });
    } else if (userType === 'vendor') {
      const vendor = await Vendor.findOne({ userId: id }).populate('userId', '-password');
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
      responseUser.businessName = vendor.businessName;
      responseUser.approvalStatus = vendor.approvalStatus;
      responseUser.vendorId = vendor._id;
    } else if (userType === 'admin') {
      if (id === 'superadmin') {
        responseUser.role = 'super_admin';
        responseUser.permissions = ['*'];
        responseUser.department = 'Administration';
      } else {
        const admin = await Admin.findOne({ userId: id }).populate('userId', '-password');
        if (!admin) return res.status(404).json({ success: false, message: 'Admin profile not found' });
        responseUser.role = admin.role;
        responseUser.permissions = admin.permissions;
        responseUser.department = admin.department;
      }
    }

    res.json({ success: true, user: responseUser });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- Registration OTP endpoints ---
const sendOtpForRegister = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email to avoid case-sensitivity / whitespace issues
    email = String(email).trim().toLowerCase();

    // Check if user already exists to avoid sending OTP to registered accounts
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If the account uses social login, guide the user accordingly
      if (existingUser.provider && existingUser.provider !== 'email') {
        return res.status(409).json({
          success: false,
          message: `An account with this email already exists and uses ${existingUser.provider} sign-in. Please use the social provider to sign in.`
        });
      }

      return res.status(409).json({
        success: false,
        message: 'Email is already registered. Please login or use password reset if you forgot your password.'
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
      address: address || '',
      password: hashedPassword,
      userType,
      isActive: true
    });

    await user.save();

    // Notify admin(s) of new client registration
    try {
      const notificationController = require('./notificationController');
      await notificationController.createAdminNotification({
        message: `A new client has registered: ${firstName} ${lastName}`
      });
    } catch (e) {
      console.error('Failed to create admin notification for new client registration:', e);
    }

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
    let { email ,type } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email to avoid case-sensitivity issues
    email = String(email).trim().toLowerCase();

    // Check if user exists and is active
    const user = await User.findOne({ email });
    if (!user) {
      // Do NOT send OTP when user does not exist for forgot-password flow
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Prevent sending OTP to social login users
    if (user.provider && user.provider !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'This account uses social login. Password reset via email is not available. Please use the social provider to sign in.'
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

const { signPasswordResetToken, verifyPasswordResetToken } = require('../utils/jwtUtils');

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

    // Issue short-lived password reset token
    const resetToken = signPasswordResetToken({ email });

    res.json({
      success: true,
      message: 'OTP verified. You may now reset your password.',
      resetToken
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
    const { password, resetToken } = req.body;

    if (!resetToken) {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    let decoded;
    try {
      decoded = verifyPasswordResetToken(resetToken);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const email = decoded.email;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.provider === 'google') {
      return res.status(400).json({ success: false, message: 'Google sign-in accounts cannot reset password this way.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// --- General Registration ---
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
    const { idToken } = req.body;

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
      await user.save();
  const accessToken = buildAccessToken(user);
      return res.json({
        success: true,
        message: 'Login successful',
  tokens: { access: accessToken },
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
        lastLogin: new Date()
      });

      await user.save();

  const accessToken = buildAccessToken(user);
      return res.status(201).json({
        success: true,
        message: 'Registration and login successful',
  tokens: { access: accessToken },
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


// --- Vendor Registration ---
const registerVendor = async (req, res) => {
  try {
    const {
      accountType, // 'personal' or 'business'
      firstName,
      lastName,
      email,
      contactNumber,
      city,
      postalCode,
      fullAddress,
      passportDetails,
      kvkNumber,
      mainCategories,
      subCategories,
      password,
      confirmPassword,
      otp,
      // Business fields
      businessName,
      businessNumber,
      businessLocation,
      businessWebsite,
      businessDescription,
      businessLogo,
      bannerImage,
      whyChooseUs,
      teamType,
      teamSize
    } = req.body;

    // Validate accountType
    if (!['personal', 'business'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }

    // Common validations
    if (!email || !contactNumber || !password || !confirmPassword || !otp) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and confirm password do not match' });
    }

    // Personal account validations
    if (accountType === 'personal') {
      if (!firstName || !lastName || !city || !postalCode || !fullAddress || !passportDetails || !mainCategories || !subCategories) {
        return res.status(400).json({ success: false, message: 'Missing required personal account fields' });
      }
    }
    // Business account validations
    if (accountType === 'business') {
      if (!businessName || !businessNumber || !teamSize || !teamType || !kvkNumber) {
        return res.status(400).json({ success: false, message: 'Missing required business account fields' });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // OTP verification (same as client registration)
    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      firstName: accountType === 'personal' ? firstName : businessName,
      email,
      contactNumber,
      address: fullAddress || '',
      password: hashedPassword,
      userType: 'vendor',
      accountType, // Add accountType field
      isActive: true,
      ...(accountType === 'personal' && { lastName, passportDetails }),
      ...(accountType === 'business' && { kvkNumber, passportDetails })
    };
    const user = new User(userData);
    await user.save();

    // Create vendor profile
    const vendorData = {
      userId: user._id,
      mainCategories: mainCategories || [],
      subCategories: subCategories || [],
      isApproved: false,
      // Business fields
      ...(accountType === 'business' && {
        businessName,
        businessPhone: businessNumber,
        businessWebsite,
        businessDescription,
        businessLogo,
        bannerImage,
        whyChooseUs,
        teamType,
        teamSize
      })
    };
    const vendor = new Vendor(vendorData);
    await vendor.save();

    // Notify admin(s) of new vendor registration
    try {
      const notificationController = require('./notificationController');
      await notificationController.createAdminNotification({
        message: `A new vendor has registered: ${accountType === 'personal' ? firstName + ' ' + lastName : businessName}`
      });
    } catch (e) {
      console.error('Failed to create admin notification for new vendor registration:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Vendor registration successful.'
    });
  } catch (err) {
    console.error('Vendor registration error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// --- Vendor Login ---
const vendorLogin = async (req, res) => {
  return performLogin(req, res, 'vendor');
};

// --- Check already registered user ---
const checkRegisteredUser = async (req, res) => {
  try {
    const { email, contactNumber, userType } = req.body;

    if (!email && !contactNumber) {
      return res.status(400).json({ success: false, message: 'Email or contactNumber is required' });
    }

    // Validate userType if provided
    if (userType && !['client', 'vendor', 'admin'].includes(userType)) {
      return res.status(400).json({ success: false, message: 'Invalid userType' });
    }

    const query = {};
    if (email) query.email = email;
    if (contactNumber) query.contactNumber = contactNumber;

    // If userType provided, include in query to narrow search
    if (userType) query.userType = userType;

    const existingUser = await User.findOne(query).lean();

    if (!existingUser) {
      return res.json({
        success: true,
        exists: false,
        message: 'No account found. You may proceed to register.'
      });
    }

    // If found, return minimal info (avoid leaking sensitive data)
    // Provide a helpful message depending on provider
    const provider = existingUser.provider || 'email';
    const accountHint = provider === 'google' ? 'This account uses Google Sign-In. Please use Google to sign in.' : 'An account already exists.';
    return res.json({
      success: true,
      exists: true,
      userType: existingUser.userType || null,
      provider,
      message: accountHint
    });
  } catch (err) {
    console.error('Check registered user error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const registerVendor2 = async (req, res) => {
  try {
    // Lazy import of multilingual helper to avoid circular deps
    const { toMultilingualText } = require('../utils/textUtils');
    const {
      accountType, // 'personal' or 'business'
      email, // personal account email
      contactNumber,
      password,
      confirmPassword,
      otp,
      // Personal account fields (stored in User model)
      firstName,
      lastName,
      city,
      postalCode,
      fullAddress,
      passportDetails,
      mainCategories,
      subCategories,
      // Business account fields (stored in Vendor model)
      businessName,
      businessNumber,
      businessEmail, // NEW: required for business accounts (used as User.email too)
      businessWebsite,
      businessDescription,
      businessLogo,
      bannerImage,
      whyChooseUs,
      teamType,
      teamSize,
      kvkNumber
    } = req.body;

    // Validate accountType
    if (!['personal', 'business'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'Invalid account type' });
    }

    // Common validations (for both types)
    if (!contactNumber || !password || !confirmPassword || !otp) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and confirm password do not match' });
    }

    // Personal account validations
    if (accountType === 'personal') {
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required for personal accounts' });
      }
      if (!firstName || !lastName || !city || !postalCode || !fullAddress || !passportDetails || !mainCategories || !subCategories) {
        return res.status(400).json({ success: false, message: 'Missing required personal account fields' });
      }
    }

    // Business account validations
    if (accountType === 'business') {
      if (!businessEmail) {
        return res.status(400).json({ success: false, message: 'businessEmail is required for business accounts' });
      }
      if (!businessName  || !teamSize || !teamType || !kvkNumber || !mainCategories || !subCategories) {
        return res.status(400).json({ success: false, message: 'Missing required business account fields' });
      }
    }

    // Determine which email to use for registration (stored in User.email)
    const registrationEmail = accountType === 'business' ? businessEmail : email;

    // Check if user already exists
    const existingUser = await User.findOne({ email: registrationEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // OTP verification
    const valid = await verifyOTP(registrationEmail, otp);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (common data for both types)
    const userData = {
      email: registrationEmail,
      contactNumber,
      password: hashedPassword,
      userType: 'vendor',
      accountType,
      isActive: true
    };

    // Add account-specific fields to User model
    if (accountType === 'personal') {
      userData.firstName = firstName;
      userData.lastName = lastName;
      userData.address = fullAddress;
      userData.passportDetails = passportDetails;
    } 
    else {
      // For business, store minimal info in User
      userData.firstName = businessName;
    }

    const user = new User(userData);
    await user.save();

    // Create vendor profile
    const vendorData = {
      userId: user._id,
      mainCategories: mainCategories || [],
      subCategories: subCategories || [],
      isApproved: false
    };

    // Handle businessName based on account type
    if (accountType === 'personal') {
      // Personal vendors: businessName derived from name; wrap into multilingual object
      vendorData.businessName = toMultilingualText(`${firstName} ${lastName}`.trim());
      vendorData.businessPhone = contactNumber;
      vendorData.businessLocation = `${fullAddress}`;
      vendorData.accountType = accountType;
      vendorData.businessEmail = registrationEmail;
      vendorData.businessLogo = businessLogo;
      vendorData.bannerImage = bannerImage;
    } else if (accountType === 'business') {
      // Business vendors: convert multilingual-capable fields
      vendorData.businessName = toMultilingualText(businessName);
      vendorData.businessPhone = businessNumber;
      vendorData.businessLocation = fullAddress;
      vendorData.businessWebsite = businessWebsite;
      vendorData.businessDescription = toMultilingualText(businessDescription);
      vendorData.businessLogo = businessLogo;
      vendorData.bannerImage = bannerImage;
      vendorData.whyChooseUs = toMultilingualText(whyChooseUs);
      vendorData.teamType = toMultilingualText(teamType);
      vendorData.teamSize = teamSize;
      vendorData.kvkNumber = kvkNumber;
      vendorData.accountType = accountType;
      vendorData.businessEmail = registrationEmail; // ensure stored for business too
    }

    const vendor = new Vendor(vendorData);
    await vendor.save();

    console.log("Vendor data:", vendorData);
    console.log("Vendor saved:", userData);

    // Notify admin(s) of new vendor registration
    try {
      const notificationController = require('./notificationController');
      await notificationController.createAdminNotification({
        message: `A new vendor has registered: ${accountType === 'personal' ? firstName + ' ' + lastName : businessName}`
      });
    } catch (e) {
      console.error('Failed to create admin notification for new vendor registration:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Vendor registration successful.'
    });
  } catch (err) {
    console.error('Vendor registration error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
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
  registerVendor2,

  // OTP Management
  sendOtpForRegister,
  sendOtpForForgotPassword,
  verifyOtpForForgotPassword,

  // Password Management
  resetPassword,
  checkRegisteredUser
};
