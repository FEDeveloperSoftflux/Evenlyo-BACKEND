
const express = require('express');
const router = express.Router();

// Check if email is already registered
router.post('/check-email', async (req, res) => {
  const User = require('../models/User');
  const { email } = req.body;
  if (!email) return res.status(400).json({ exists: false, message: 'Email required' });
  const user = await User.findOne({ email });
  res.json({ exists: !!user });
});

// Logout: clear the cookie
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ message: 'Logged out successfully' });
});

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Register
router.post('/register', authController.register);


// OTP for registration
router.post('/send-otp', authController.sendOtpForRegister);
router.post('/verify-otp-register', authController.verifyOtpAndRegister);

// Forgot Password OTP endpoints
router.post('/send-otp-forgot', authController.sendOtpForForgotPassword);
router.post('/verify-otp-forgot', authController.verifyOtpForForgotPassword);
router.post('/reset-password', authController.resetPassword);

// Login
router.post('/login', authController.login);


// Get current user from cookie
router.get('/me', authMiddleware, async (req, res) => {
  // Fetch user from DB for fresh info
  const User = require('../models/User');
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.userType
    }});
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

//
router.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'You have accessed a protected route!', user: req.user });
});
