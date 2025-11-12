const express = require('express');
const router = express.Router();
const userManagementController = require('../../controllers/admin/userManagement');
const { requireAuth, requireAdmin, requireActiveAdmin } = require('../../middleware/authMiddleware');

// --- Admin User Management Routes ---

// Get all clients with stats and table data
router.get('/admin/users/clients', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.getAllClients
);

// Get specific client details
router.get('/admin/users/clients/:clientId', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.getClientDetails
);

// Block/Unblock client
router.patch('/admin/users/clients/:clientId/status', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.toggleClientStatus
);

// Reset client password
router.patch('/admin/users/clients/:clientId/reset-password', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.resetClientPassword
);

// --- Vendor Management Routes ---

// Get all vendors with stats and table data
router.get('/admin/users/vendors', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.getAllVendors
);

// Get specific vendor details
router.get('/admin/users/vendors/:vendorId', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.getVendorDetails
);

// Block/Unblock vendor
router.patch('/admin/users/vendors/:vendorId/status', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.toggleVendorStatus
);

// Approve/Reject vendor
router.patch('/admin/users/vendors/:vendorId/approval', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.toggleVendorApproval
);

// Reset vendor password
router.patch('/admin/users/vendors/:vendorId/reset-password', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.resetVendorPassword
);

// --- Email Management Routes ---

// Send email to selected clients
router.post('/admin/users/clients/send-email', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.sendEmailToClients
);

// Send email to selected vendors
router.post('/admin/users/vendors/send-email', 
  // requireAuth,
  requireAdmin,
  // requireActiveAdmin,
  userManagementController.sendEmailToVendors
);

module.exports = router;
