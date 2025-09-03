const mongoose = require('mongoose');

// Designation Schema
const designationSchema = new mongoose.Schema({
  name: {
	type: String,
	required: true,
	unique: true,
	trim: true
  },
	description: String,
	vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
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
	canEdit: {
	  type: Boolean,
	  default: false
	},
	canDelete: {
	  type: Boolean,
	  default: false
	},
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

}, { timestamps: true });

// Pre-save middleware
designationSchema.pre('save', function(next) {
	this.updatedAt = Date.now();
	next();
});

// Indexes for better performance
designationSchema.index({ name: 1 });
designationSchema.index({ isActive: 1 });
designationSchema.index({ isSystemRole: 1 });

module.exports = mongoose.model('Designation', designationSchema);