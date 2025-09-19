const Notification = require('../models/Notification');

// Create a notification
exports.createNotification = async ({ user, bookingId, message }) => {
  try {
    const notification = new Notification({ user, bookingId, message });
    await notification.save();
    return notification;
  } 
  catch (err) 
  {
    console.error('Error creating notification:', err);
    return null;
  }
};

// Get notifications for a user
exports.getNotifications = async (userId) => {
  return Notification.find({ user: userId }).sort({ createdAt: -1 });
};

// Mark a notification as read
exports.markAsRead = async (notificationId) => {
  return Notification.findByIdAndUpdate(notificationId, { isRead: true }, { new: true });
};

// Mark all notifications as read for a user
exports.markAllAsRead = async (userId) => {
  return Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
};
