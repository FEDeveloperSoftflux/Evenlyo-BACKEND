const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

// Get all notifications for the logged-in user
const Vendor = require('../models/Vendor');

router.get('/', requireAuth, async (req, res) => {
  let userIdToQuery = req.user.id;
  if (req.user.userType === 'vendor') {
    // Find vendor profile for this user
    const vendorProfile = await Vendor.findOne({ userId: req.user.id });
    if (vendorProfile) {
      userIdToQuery = vendorProfile._id;
    }
  }
  const notifications = await notificationController.getNotifications(userIdToQuery);
  res.json({ success: true, data: notifications });
});

// Mark a notification as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const notification = await notificationController.markAsRead(req.params.id);
  res.json({ success: true, data: notification });
});

// Mark all notifications as read
router.patch('/read-all', requireAuth, async (req, res) => {
  await notificationController.markAllAsRead(req.user.id);
  res.json({ success: true, message: 'All notifications marked as read' });
});

module.exports = router;
