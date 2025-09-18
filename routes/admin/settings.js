const express = require('express');
const router = express.Router();
const settingsController = require('../../controllers/admin/settingsController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Admin password reset route
router.post('/reset-password', requireAuth, settingsController.resetPassword);


// Admin get platform fees
router.get('/platform-fees', requireAuth, settingsController.getPlatformFees);
// Admin set platform fees
router.post('/platform-fees', requireAuth, settingsController.setPlatformFees);

module.exports = router;

