

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  requireAuth, 
  rateLimit,
  csrfProtection 
} = require('../middleware/authMiddleware');

// --- Public Routes ---

// General login route (backward compatibility)
router.post('/login', 
  rateLimit(20, 15 * 60 * 1000), // Increased to 20 attempts per 15 minutes for testing
  csrfProtection,
  authController.login
);

// Separate login routes for each user type
router.post('/client/login', 
  rateLimit(20, 15 * 60 * 1000),
  csrfProtection,
  authController.clientLogin
);

router.post('/vendor/login', 
  rateLimit(20, 15 * 60 * 1000),
  csrfProtection,
  authController.vendorLogin
);

router.post('/admin/login', 
  rateLimit(20, 15 * 60 * 1000),
  csrfProtection,
  authController.adminLogin
);

// Logout route
router.post('/logout', authController.logout);

// OTP routes
router.post('/send-otp', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  authController.sendOtpForRegister
);

// Client Registration
router.post('/client/register', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  csrfProtection,
  authController.registerClient
);

// Vendor Registration
router.post('/vendor/register', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  csrfProtection,
  authController.registerVendor
);

// Password reset routes
router.post('/send-forgot-otp', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  authController.sendOtpForForgotPassword
);

router.post('/verify-forgot-otp', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  authController.verifyOtpForForgotPassword
);

router.post('/reset-password', 
  rateLimit(10, 5 * 60 * 1000), // Increased to 10 attempts per 5 minutes for testing
  csrfProtection,
  authController.resetPassword
);

// Google Authentication
router.post('/google', 
  rateLimit(10, 5 * 60 * 1000), // Rate limit for Google auth
  authController.googleAuth
);

// --- Protected Routes ---

// Get current user (requires authentication)
router.get('/me', requireAuth, authController.getCurrentUser);

// --- Health Check Route ---
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is running',
    timestamp: new Date().toISOString()
  });
});

// Firebase health check route
router.get('/firebase-health', (req, res) => {
  try {
    const { admin, projectId } = require('../config/firebase');
    const app = admin.app();

    res.json({
      success: true,
      message: 'Firebase Admin SDK is properly configured',
      projectId: projectId || app.options.projectId || 'evenlyo-marketplace',
      appName: app.name || 'default',
      authReady: !!admin.auth()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Firebase configuration error',
      error: error.message
    });
  }
});

module.exports = router;
