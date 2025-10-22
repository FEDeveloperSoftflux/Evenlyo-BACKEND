const mongoose = require('mongoose');

// Sub Category Schema
const subCategorySchema = new mongoose.Schema({
  name: {
    en: {
      type: String,
      required: true,
      trim: true
    },
    nl: {
      type: String,
      required: true,
      trim: true
    }
  },
  mainCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  icon: String,
  description: {
    en: {
      type: String,
      trim: true
    },
    nl: {
      type: String,
      trim: true
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  // Payment and protection settings (admin configurable)
  escrowEnabled: {
    type: Boolean,
    default: false
  },
  // Percent of total price client must pay upfront when escrow is enabled
  upfrontFeePercent: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // Hours after which remaining escrow is released
  upfrontHour: {
    type: Number,
    min: 0,
    default: 0
  },
  // Evenlyo Protect fee percent (platform fee) set by admin at subcategory level
  evenlyoProtectFeePercent: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { timestamps: true });

// Pre-save middleware
subCategorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
}); 

// Compound index to ensure unique subcategory names within each main category for each language
subCategorySchema.index({ 'name.en': 1, mainCategory: 1 }, { unique: true });
subCategorySchema.index({ 'name.nl': 1, mainCategory: 1 }, { unique: true });
subCategorySchema.index({ mainCategory: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('SubCategory', subCategorySchema);