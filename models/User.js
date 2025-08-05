const mongoose = require('mongoose');

// User Schema (Base schema for all user types)
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      // Password is required only for email/password authentication
      // Social login users (Google, etc.) should have password set to null
      return !this.provider || this.provider === 'email';
    },
    minlength: 8,
    default: null // Default to null for social logins
  },
  contactNumber: {
    type: String,
    required: function() {
      // Contact number is required only for non-Google logins
      return !this.provider || this.provider === 'email';
    }
  },
  // Social login fields
  googleId: {
    type: String,
    sparse: true // Allow null values but maintain uniqueness when present
  },
  provider: {
    type: String,
    enum: ['email', 'google'],
    default: 'email'
  },
  address: {
    city: String,
    postalCode: String,
    fullAddress: String
  },
  userType: {
    type: String,
    enum: ['client', 'vendor', 'admin'],
    required: true
  },
  profileImage: String,
  isActive: {
    type: Boolean,
    default: true
  },
  language: {
    type: String,
    enum: ['english', 'dutch'],
    default: 'english'
  },
  notifications: 
  {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  },

  lastLogin: Date
}, { timestamps: true });

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure social login users don't have passwords
  if (this.provider === 'google' && this.password) {
    this.password = null;
  }
  
  // Ensure email users have passwords (unless it's being set to null intentionally during Google migration)
  if (this.provider === 'email' && !this.password && this.isNew) {
    return next(new Error('Password is required for email authentication'));
  }
  
  next();
});

// Indexes for better performance
// Note: email already has unique index from schema definition
userSchema.index({ userType: 1, isActive: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ provider: 1 });

module.exports = mongoose.model('User', userSchema);