const mongoose = require('mongoose');


const serviceItemSchema = new mongoose.Schema({
  title: {
    en: { type: String, trim: true, required: true },
    nl: { type: String, trim: true, required: true }
  },
  mainCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  linkedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    description: 'Optional reference to a listing this item is associated with'
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String,
    required: true
  }
}, { timestamps: true }); 

// Hook to set 'Others' if category/subcategory is not selected
serviceItemSchema.pre('save', function(next) {
  if (!this.mainCategory) {
    this.mainCategoryName = 'Others';
  }
  if (!this.subCategory) {
    this.subCategoryName = 'Others';
  }
  next();
});

// Index for faster category-based queries
serviceItemSchema.index({ mainCategory: 1, subCategory: 1 });

module.exports = mongoose.model('ServiceItem', serviceItemSchema);
