const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    required: true
  },
  businessEmail: {
    type: String
  },
  businessPhone: {
    type: String
  },
  businessAddress: {
    type: String
  },
  businessWebsite: {
    type: String
  },
  teamType: {
    type: String,
    enum: ['single', 'team'],
    default: 'single'
  },
  teamSize: {
    type: String,
    enum: ['1-5', '6-10', '11-20', '21+'] // Adjust as needed
  },
  businessLocation: String,
  businessLogo: String,
  bannerImage: String,
  businessDescription: String,
  mainCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  subCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory'
  }],
  gallery: {
    companyIcon: String,
    workImages: [String],
    workVideo: String
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalReviews: {
      type: Number,
      default: 0
    }
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  completedBookings: {
    type: Number,
    default: 0
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: String,

  contactMeEnabled: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

vendorSchema.index({ userId: 1 });
vendorSchema.index({ mainCategories: 1 });
vendorSchema.index({ approvalStatus: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
