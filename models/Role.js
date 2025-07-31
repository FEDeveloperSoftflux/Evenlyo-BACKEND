const mongoose = require('mongoose');

// Role Schema
const roleSchema = new mongoose.Schema({
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
        'listing_management',
        'booking_analytics',
        'tracking',
        'stock_management',
        'analytics_reports',
        'billings',
        'chat',
        'notifications',
        'profile_management',
        'settings',
        'user_management',
        'payment_plans',
        'customer_support',
        'blog_management'
      ]
    },
    canView: {
      type: Boolean,
      default: false
    },
    canEdit: {
      type: Boolean,
      default: false
    },
    canDelete: {
      type: Boolean,
      default: false
    },
    canCreate: {
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
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
 timestamps: true
});

// Pre-save middleware
roleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better performance
roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });
roleSchema.index({ isSystemRole: 1 });

module.exports = mongoose.model('Role', roleSchema);