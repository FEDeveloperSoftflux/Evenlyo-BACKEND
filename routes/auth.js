

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  requireAuth, 
  rateLimit,
  csrfProtection 
} = require('../middleware/authMiddleware');

// --- Public Routes ---

// Login route for all user types
router.post('/login', 
  rateLimit(20, 15 * 60 * 1000), // Increased to 20 attempts per 15 minutes for testing
  csrfProtection,
  authController.login
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

module.exports = router;
