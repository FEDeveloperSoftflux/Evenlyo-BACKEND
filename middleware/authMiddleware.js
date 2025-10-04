const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Admin = require('../models/Admin');
const { verifyAccessToken } = require('../utils/jwtUtils');

// Session removed: configuration middleware no longer needed

// --- Authentication Middleware (supports JWT and legacy session) ---
const requireAuth = async (req, res, next) => {
  try {
    let tokenUser = null;

    // 1. Try Authorization Bearer token first
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyAccessToken(token);
        tokenUser = decoded; // should contain id, userType, etc.
      } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
    }

    // If no token user -> unauthorized (sessions removed)
    if (!tokenUser) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const baseUser = tokenUser;

    // Super admin shortcut (legacy env-based)
    if (baseUser.id === 'superadmin') {
      req.user = {
        id: 'superadmin',
        email: baseUser.email,
        firstName: baseUser.firstName,
        lastName: baseUser.lastName,
        userType: 'admin',
        role: 'super_admin',
        permissions: ['*'],
        department: 'Administration',
        authSource: tokenUser ? 'jwt' : 'session'
      };
      return next();
    }

    // Verify user still exists in database
    const user = await User.findById(baseUser.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    // Build request user object
    req.user = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userType: user.userType,
      ...baseUser,
      authSource: 'jwt'
    };

    // Ensure vendorId present if vendor user
    if (req.user.userType === 'vendor') {
      if (!req.user.vendorId) {
        // attempt lookup
        const vendor = await Vendor.findOne({ userId: user._id }, '_id');
        if (vendor) req.user.vendorId = vendor._id;
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error' });
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

      // Fetch permissions fresh from database (no session caching)
      let permissions = [];
      const admin = await Admin.findOne({ userId: req.user.id });
      if (admin) permissions = admin.permissions || [];

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


// --- Admin Status Check Middleware ---
const requireActiveAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Skip database check for super admin (env-based login)
    if (req.user.id === 'superadmin') {
      // Super admin is always considered active with full permissions
      req.admin = {
        _id: 'superadmin',
        userId: 'superadmin',
        role: 'super_admin',
        permissions: ['*'],
        isActive: true,
        department: 'Administration'
      };
      return next();
    }

    // Check admin status for database-based admins
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
const vendorRoutes = [requireAuth, requireVendor];
const adminRoutes = [requireAuth, requireAdmin, requireActiveAdmin];

// Optional auth now only attempts JWT if provided
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = verifyAccessToken(authHeader.substring(7));
      const user = await User.findById(decoded.id);
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          ...decoded,
          authSource: 'jwt'
        };
      }
    } catch (_) { /* ignore */ }
  }
  next();
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
  requireAuth,
  optionalAuth,

  // Role-based access
  requireRole,
  requireClient,
  requireVendor,
  requireAdmin,

  // Permission-based access
  requirePermission,

  // Status checks
  requireActiveAdmin,

  // Security helpers
  rateLimit,
  csrfProtection,

  // Route combinations
  clientRoutes,
  vendorRoutes,
  adminRoutes
};
