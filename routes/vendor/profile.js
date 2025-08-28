const express = require('express');
const router = express.Router();
const { getProfile,updateProfile}  = require('../../controllers/vendor/profileController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Get vendor profile
router.get('/', requireAuth, getProfile);

// Update vendor profile
router.put('/update', requireAuth, updateProfile);

module.exports = router;
