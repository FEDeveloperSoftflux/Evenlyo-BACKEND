const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

// Get all notifications for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  const notifications = await notificationController.getNotifications(req.user.id);
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
