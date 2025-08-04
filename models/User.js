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
    required: true,
    minlength: 8
  },
  contactNumber: {
    type: String,
    required: true
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
  next();
});

// Indexes for better performance
// Note: email already has unique index from schema definition
userSchema.index({ userType: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);