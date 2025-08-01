// Role-based middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Convert single role to array for consistency
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    
    next();
  };
};

// Specific role middlewares
const requireVendor = requireRole(['vendor']);
const requireClient = requireRole(['client']);
const requireAdmin = requireRole(['admin']);

module.exports = {
  requireRole,
  requireVendor,
  requireClient,
  requireAdmin
};
