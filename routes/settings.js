const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAuth, rateLimit } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Configuration for Profile Picture Upload ---
const createUploadDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    createUploadDirectory(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueName = `profile_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedFileTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// --- Personal Information Routes ---

// Get personal information
router.get('/personal-info', requireAuth, settingsController.getPersonalInfo);

// Update personal information (contact number, address, language)
router.put('/personal-info', requireAuth, settingsController.updatePersonalInfo);

// Update profile picture
router.put('/profile-picture', requireAuth, upload.single('profilePicture'), settingsController.updateProfilePicture);

// --- Security Details Routes ---

// Change password
router.put('/change-password', requireAuth, settingsController.changePassword);

// --- Notification Settings Routes ---

// Get notification settings
router.get('/notifications', requireAuth, settingsController.getNotificationSettings);

// Update notification settings
router.put('/notifications', requireAuth, settingsController.updateNotificationSettings);

// --- Health Check Route ---
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Settings service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
