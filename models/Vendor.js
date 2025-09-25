const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    required: false
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
  },
  teamSize: {
    type: String,
  },
  businessLocation: String,
  businessLogo: String,
  bannerImage: String,
  whyChooseUs: {
    type: String,
    trim: true,
    default: ''
  },
  businessDescription: {
    en: {
      type: String,
      trim: true
    },
    nl: {
      type: String,
      trim: true
    }
  },
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
  reviews: [{
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    review: {
      en: String,
      nl: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
    default: true
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
