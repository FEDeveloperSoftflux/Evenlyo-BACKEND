// routes/notify.js
// Notification test route for FCM push notifications

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { sendNotification } = require('../config/firebase');

/**
 * @route   POST /api/notify/test
 * @desc    Send a test push notification to a user by uid
 * @access  Public (for testing)
 * @body    { uid, title, body }
 */
router.post('/test', async (req, res) => {
  const { uid, title, body } = req.body;
  if (!uid || !title || !body) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {
    const user = await User.findById(uid);
    if (!user || !user.fcmToken) {
      return res.status(404).json({ success: false, message: 'User or FCM token not found' });
    }
    const result = await sendNotification(user.fcmToken, title, body);
    if (result.success) {
      return res.json({ success: true, message: 'Notification sent', response: result.response });
    } else {
      return res.status(500).json({ success: false, message: 'Notification failed', error: result.error });
    }
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;
