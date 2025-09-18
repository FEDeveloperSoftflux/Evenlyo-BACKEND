const mongoose = require('mongoose');

const adminDesignationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: String,
  permissions: [{
    module: {
      type: String,
      required: true,
      enum: [
        'dashboard',
        'user_management',
        'employee_management',
        'settings',
        'reports',
        'notifications',
        'content_moderation',
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
  isSystemRole: {
    type: Boolean,
    default: false // System roles cannot be deleted
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminDesignation', adminDesignationSchema);