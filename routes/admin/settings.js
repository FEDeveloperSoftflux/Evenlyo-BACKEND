const express = require('express');
const router = express.Router();
const {resetPassword, getPlatformFees, setPlatformFees, getNotificationSettings, toggleEmailNotifications, togglePushNotifications} = require('../../controllers/admin/settingsController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Admin password reset route
router.post('/reset-password', requireAuth, resetPassword);
// Admin get platform fees
router.get('/platform-fees', requireAuth, getPlatformFees);
// Admin set platform fees
router.post('/platform-fees', requireAuth, setPlatformFees);
// Admin get notification settings
router.get('/notification', requireAuth, getNotificationSettings);
// Admin toggle email notifications
router.patch('/notification/email', requireAuth, toggleEmailNotifications);
// Admin toggle push notifications
router.patch('/notification/push', requireAuth, togglePushNotifications);

module.exports = router;

