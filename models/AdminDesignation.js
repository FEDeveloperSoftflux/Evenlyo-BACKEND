const mongoose = require('mongoose');

const adminDesignationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  permissions: [{
    module: {
      type: String,
      required: true,
      enum: [
        'dashboard',
        'user_management',
        'listing_management',
        "booking-analytics",
        'tracking',
        'role_management',
        'settings',
        'reports',
        'blog_management',
        'notifications',
        'faqs',
        'customer_support',
        'fees_and_payments',
        'system_settings'
      ]
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
}, { timestamps: true });

module.exports = mongoose.model('AdminDesignation', adminDesignationSchema);