const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

// Get all notifications for the logged-in user
const Vendor = require('../models/Vendor');
const Notification = require('../models/Notification');

router.get('/', async (req, res) => {
  let userIdToQuery = req.user.id;
  if (req.user.userType === 'vendor') {
    // Find vendor profile for this user
    const vendorProfile = await Vendor.findOne({ userId: req.user.id });
    if (vendorProfile) {
      userIdToQuery = vendorProfile._id;
    }
  }
  const notifications = await getNotifications(userIdToQuery);
  res.json({ success: true, data: notifications });
});

router.get('/admin-notifications', async (req, res) => {
  try {
    const notifications = await Notification.find({ notificationFor: "Admin" }).sort({ createdAt: -1 })
    res.json({ success: true, data: notifications });

  } catch (error) {
    res.send(error)
  }
});

router.get('/vendor-notifications', requireAuth, async (req, res) => {
  console.log(req.user, "HAHAHAAHAH");
  try {
    const notifications = await Notification.find({ notificationFor: "Vendor", vendorId: req.user.id }).sort({ createdAt: -1 })
    res.json({ success: true, data: notifications });

  } catch (error) {
    res.send(error)
  }
});

// Mark a notification as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const notification = await markAsRead(req.params.id);
  res.json({ success: true, data: notification });
});

// Mark all notifications as read
router.patch('/read-all', requireAuth, async (req, res) => {
  await markAllAsRead(req.user.id);
  res.json({ success: true, message: 'All notifications marked as read' });
});

module.exports = router;
