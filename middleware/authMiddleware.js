const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');

// --- Session Configuration Middleware ---
const configureSession = (req, res, next) => {
  // Ensure session is configured
  if (!req.session) {
    return res.status(500).json({
      success: false,
      message: 'Session not configured'
    });
  }
  next();
};

// --- Authentication Middleware ---
const requireAuth = async (req, res, next) => {
  try {
    // Check if user is authenticated via session
    if (!req.session.user || !req.session.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify user still exists in database
    const user = await User.findById(req.session.user.id);
    if (!user || !user.isActive) {
      // Clear invalid session
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated'
      });
    }

    // Add user data to request
    req.user = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      ...req.session.user // Include any additional session data
    };
    // Ensure vendorId is set for vendor users
    if (req.user.userType === 'vendor' && req.session.user.vendorId) {
      req.user.vendorId = req.session.user.vendorId;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// --- Role-based Middleware ---
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// --- Specific Role Middleware ---
const requireClient = requireRole(['client']);
const requireVendor = requireRole(['vendor']);
const requireAdmin = requireRole(['admin']);

// --- Permission-based Middleware ---
const requirePermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Only admins have permissions
      if (req.user.userType !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      // Get admin permissions from session or database
      let permissions = req.user.permissions || [];
      
      // If permissions not in session, fetch from database
      if (!permissions.length) {
        const admin = await Admin.findOne({ userId: req.user.id });
        if (admin) {
          permissions = admin.permissions || [];
          // Update session with permissions
          req.session.user.permissions = permissions;
          req.user.permissions = permissions;
        }
      }

      // Check if user has required permissions
      const hasPermission = requiredPermissions.every(permission => 
        permissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission check error'
      });
    }
  };
};

// --- Vendor Status Check Middleware ---
const requireApprovedVendor = async (req, res, next) => {
  try {
    if (!req.user || req.user.userType !== 'vendor') {
      return res.status(403).json({
        success: false,
        message: 'Vendor access required'
      });
    }

    // Check vendor approval status
    const vendor = await Vendor.findOne({ userId: req.user.id });
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor profile not found'
      });
    }

    if (vendor.approvalStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Vendor account not approved'
      });
    }

    // Add vendor data to request
    req.vendor = vendor;
    next();
  } catch (error) {
    console.error('Vendor status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Vendor status check error'
    });
  }
};

// --- Admin Status Check Middleware ---
const requireActiveAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Check admin status
    const admin = await Admin.findOne({ userId: req.user.id });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin profile not found'
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated'
      });
    }

    // Add admin data to request
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin status check error'
    });
  }
};

// --- Route-specific Middleware Combinations ---
const clientRoutes = [requireAuth, requireClient];
const vendorRoutes = [requireAuth, requireVendor, requireApprovedVendor];
const adminRoutes = [requireAuth, requireAdmin, requireActiveAdmin];

// --- Optional Authentication Middleware ---
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session.user && req.session.user.id) {
      const user = await User.findById(req.session.user.id);
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          ...req.session.user
        };
      }
    }
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// --- Session Validation Middleware ---
const validateSession = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'No active session'
      });
    }

    // Check if session is still valid
    const user = await User.findById(req.session.user.id);
    if (!user || !user.isActive) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'Session expired'
      });
    }

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Session validation error'
    });
  }
};

// --- Rate Limiting Helper (Basic) ---
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    // More lenient rate limiting in development
    if (process.env.NODE_ENV === 'development') {
      maxRequests = maxRequests * 5; // 5x more lenient in development
    }

    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    if (requests.has(ip)) {
      const userRequests = requests.get(ip).filter(time => time > windowStart);
      requests.set(ip, userRequests);
    } else {
      requests.set(ip, []);
    }

    const userRequests = requests.get(ip);
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    userRequests.push(now);
    next();
  };
};

// --- CSRF Protection Helper ---
const csrfProtection = (req, res, next) => {
  // Skip CSRF check in development/testing environment
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  // Basic CSRF check - in production, use a proper CSRF library
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  
  // Allow requests from same origin or trusted origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];

  // Allow requests with no origin (like Postman, curl, etc.)
  if (!origin) {
    return next();
  }

  // Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return next();
  }

  // For POST/PUT/DELETE requests, require either origin or referer
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    if (!origin && !referer) {
      return res.status(403).json({
        success: false,
        message: 'CSRF protection: Invalid request origin'
      });
    }
  }

  next();
};

module.exports = {
  // Core authentication
  configureSession,
  requireAuth,
  validateSession,
  optionalAuth,

  // Role-based access
  requireRole,
  requireClient,
  requireVendor,
  requireAdmin,

  // Permission-based access
  requirePermission,

  // Status checks
  requireApprovedVendor,
  requireActiveAdmin,

  // Security helpers
  rateLimit,
  csrfProtection,

  // Route combinations
  clientRoutes,
  vendorRoutes,
  adminRoutes
};
