const mongoose = require('mongoose');

// Service Item/Listing Schema
const serviceItemSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  subTitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  mainCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: true
  },
  pricing: {
    type: {
      type: String,
      enum: ['per_hour', 'per_day', 'per_event'],
      required: true
    },
    cost: {
      type: Number,
      required: true,
      min: 0
    },
    extraTimeCost: {
      type: Number,
      min: 0,
      default: 0
    },
    securityFee: {
      amount: {
        type: Number,
        min: 0,
        default: 0
      },
      required: {
        type: Boolean,
        default: false
      }
    }
  },
  gallery: {
    images: [{
      type: String,
      validate: {
        validator: function(v) {
          return v.length <= 3;
        },
        message: 'Maximum 3 images allowed'
      }
    }],
    video: String
  },
  availability: {
    days: {
      sunday: {
        type: Boolean,
        default: false
      },
      monday: {
        type: Boolean,
        default: true
      },
      tuesday: {
        type: Boolean,
        default: true
      },
      wednesday: {
        type: Boolean,
        default: true
      },
      thursday: {
        type: Boolean,
        default: true
      },
      friday: {
        type: Boolean,
        default: true
      },
      saturday: {
        type: Boolean,
        default: false
      }
    },
    timeSlots: {
      startTime: {
        type: String,
        default: '07:00'
      },
      endTime: {
        type: String,
        default: '22:00'
      }
    }
  },
  termsConditions: String,
  status: {
    type: String,
    enum: ['live', 'blocked', 'pending_approval'],
    default: 'pending_approval'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: String,
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
  isFeatureservice: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

// Pre-save middleware
serviceItemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better performance
serviceItemSchema.index({ vendorId: 1, status: 1 });
serviceItemSchema.index({ mainCategory: 1, subCategory: 1 });
serviceItemSchema.index({ status: 1, approvalStatus: 1 });
serviceItemSchema.index({ 'rating.average': -1, totalBookings: -1 });
serviceItemSchema.index({ isFeatureservice: 1, status: 1 });

module.exports = mongoose.model('ServiceItem', serviceItemSchema);