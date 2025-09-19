const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    default: 'admin'
  },
  permissions: [{
    type: String,
    enum: [
      'user_management',
      'vendor_management', 
      'category_management',
      'booking_management',
      'report_management',
      'system_settings',
      'content_moderation'
    ]
  }],
  department: {
    type: String,
    enum: ['operations', 'support', 'marketing', 'technical'],
    default: 'operations'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, { timestamps: true });

// Indexes for better performance
adminSchema.index({ userId: 1 });
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ department: 1 });

module.exports = mongoose.model('Admin', adminSchema); 