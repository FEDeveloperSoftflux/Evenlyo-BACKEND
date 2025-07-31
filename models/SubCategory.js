const mongoose = require('mongoose');

// Sub Category Schema
const subCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mainCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  icon: String,
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
 timestamps: true
});

// Pre-save middleware
subCategorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index to ensure unique subcategory names within each main category
subCategorySchema.index({ name: 1, mainCategory: 1 }, { unique: true });
subCategorySchema.index({ mainCategory: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('SubCategory', subCategorySchema);