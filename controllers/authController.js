const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../utils/mailer');

// --- Reusable OTP helpers ---
async function generateAndSendOTP(email) {
  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await OTP.create({ email, code: otpCode, expiresAt });
  await sendOTPEmail(email, otpCode);
}

async function verifyOTP(email, code) {
  const otpDoc = await OTP.findOne({ email, code, expiresAt: { $gt: new Date() }, verified: false }).sort({ createdAt: -1 });
  if (!otpDoc) return false;
  otpDoc.verified = true;
  await otpDoc.save();
  return true;
}

// --- Registration OTP endpoints ---
exports.sendOtpForRegister = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    await generateAndSendOTP(email);
    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOtpAndRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, contactNumber, address, password, otp } = req.body;
    if (!firstName || !lastName || !email || !contactNumber || !address || !password || !otp) {
      return res.status(400).json({ message: 'All fields and OTP are required' });
    }
    // Verify OTP
    const valid = await verifyOTP(email, otp);
    if (!valid) return res.status(400).json({ message: 'Invalid or expired OTP' });
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ message: 'Email already registered' });
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Save user
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
    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Verify OTP/Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// --- Forgot Password OTP endpoints ---
exports.sendOtpForForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });
    await generateAndSendOTP(email);
    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Send OTP (forgot) error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOtpForForgotPassword = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    const valid = await verifyOTP(email, otp);
    if (!valid) return res.status(400).json({ message: 'Invalid or expired OTP' });
    // Optionally, issue a short-lived token for password reset (not implemented here)
    res.json({ message: 'OTP verified. You may now reset your password.' });
  } catch (err) {
    console.error('Verify OTP (forgot) error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ message: 'Email and new password are required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with this email' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register a new user
exports.register = async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    const { firstName, lastName, email, contactNumber, address, password } = req.body;
    if (!firstName || !lastName || !email || !contactNumber || !address || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
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
    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.userType },
      process.env.JWT_SECRET || 'devsecret',
      { expiresIn: '7d' }
    );
    // Set JWT as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    res.json({
      user: {
        id: user._id,
        fullName: user.fullName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.userType
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
