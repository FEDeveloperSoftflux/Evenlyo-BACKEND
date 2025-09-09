const mongoose = require('mongoose');

// Listing Schema
const listingSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    default: 1,
    min: 0,
    description: 'Current stock quantity for this listing.'
  },
  title: {
    type: String,
    trim: true,
    maxlength: 200
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  category: {
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
      required: true
    },
    amount: {
      type: Number,
      min: 0,
      required: true
    },
    extratimeCost: {
      type: Number,
      min: 0,
      default: 0
    },
    securityFee: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  contact: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    website: String,
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String
    }
  },
  experience: {
    years: {
      type: Number,
      min: 0
    },
      description: {
        type: String,
        trim: true
      },
      specialties: [String],
    previousClients: [String],
    certifications: [String]
  },
  location: {
    city: {
      type: String,
      required: true
    },
    region: String,
    country: {
      type: String,
      default: 'Netherlands'
    },
    postalCode: String,
    fullAddress: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  availability: {
    isAvailable: {
      type: Boolean,
      default: true
    },
    availableDays: [{
      type: String,
      enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    }],
    availableTimeSlots: [{
      startTime: String, // "09:00"
      endTime: String    // "17:00"
    }],
    advanceBookingDays: {
      type: Number,
      default: 1 // minimum days in advance for booking
    }
  },
  personalInfo: {
    displayName: String, // Professional name like "DJ Ray Beatz"
    realName: String,
      bio: {
        type: String,
        trim: true
      },
    profileImage: String,
    coverImage: String
  },
  serviceDetails: {
    serviceType: {
      type: String,
      enum: ['human', 'non_human'],
      required: true,
      default: 'human'
    },
    serviceTypes: [String], // e.g., ['weddings', 'corporate events', 'private parties']
    equipmentProvided: [String],
    travelDistance: Number, // in kilometers
    setupTime: Number, // in minutes
    minimumBookingDuration: Number, // in hours
    categoryIncluded: {
      type: Boolean,
      default: true
    },
    subCategoryIncluded: {
      type: Boolean,
      default: true
    }
  },
  media: {
    featuredImage: {
      type: String,
    },
    gallery: [String], // Array of image URLs
    videos: [String]   // Array of video URLs
  },
  features: [{
    name: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
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
    isIncluded: {
      type: Boolean,
      default: true
    }
  }],
  requirements: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  duration: {
    min: Number, // minimum duration in minutes
    max: Number, // maximum duration in minutes
    default: Number // default duration in minutes
  },
  capacity: {
    min: {
      type: Number,
      default: 1
    },
    max: Number
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'inactive', 'suspended'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  bookings: {
    total: {
      type: Number,
      default: 0
    },
    completed: {
      type: Number,
      default: 0
    }
  },
  views: {
    type: Number,
    default: 0
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  cancellationPolicy: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    default: 'moderate'
  },
  instantBooking: {
    type: Boolean,
    default: false
  }
  ,
  popular: {
    type: Boolean,
    default: false,
    description: 'Indicates if the listing is popular based on certain criteria (e.g., high bookings, high ratings, etc.)'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting formatted price
listingSchema.virtual('formattedPrice').get(function() {
  if (!this.pricing || !this.pricing.type) return 'Price on request';
  switch (this.pricing.type) {
    case 'PerHour':
      return `${this.pricing.currency} ${this.pricing.amount}/hour`;
    case 'PerDay':
      return `${this.pricing.currency} ${this.pricing.amount}/day`;
    case 'PerEvent':
      return `${this.pricing.currency} ${this.pricing.amount}/event`;
    case 'Fixed':
      return `${this.pricing.currency} ${this.pricing.amount} (fixed)`;
    default:
      return 'Price on request';
  }
});

// Virtual for getting security fee info
listingSchema.virtual('securityInfo').get(function() {
  if (this.serviceDetails?.serviceType === 'non_human') {
    return {
      required: false,
      message: 'No security fee required for equipment/non-human services'
    };
  } else {
    return {
      required: this.pricing?.securityFee > 0,
      amount: this.pricing?.securityFee || 0,
      message: this.pricing?.securityFee > 0 
        ? `Security deposit: ${this.pricing.currency} ${this.pricing.securityFee}` 
        : 'No security deposit required'
    };
  }
});

// Virtual for getting extra time cost info
listingSchema.virtual('extraTimeInfo').get(function() {
  if (this.pricing?.extraTimeCost?.perHour) {
    return {
      available: true,
      rate: `${this.pricing.currency} ${this.pricing.extraTimeCost.perHour}/hour`,
      description: this.pricing.extraTimeCost.description || 'Additional time beyond standard booking'
    };
  }
  return {
    available: false,
    message: 'Extra time not available'
  };
});

// Virtual for getting contact display
listingSchema.virtual('contactDisplay').get(function() {
  return {
    displayName: this.personalInfo?.displayName || this.title,
    phone: this.contact?.phone,
    email: this.contact?.email,
    website: this.contact?.website,
    socialMedia: this.contact?.socialMedia
  };
});

// Virtual for getting experience summary
listingSchema.virtual('experienceSummary').get(function() {
  if (this.experience?.years) {
    return `${this.experience.years}+ years experience`;
  }
  return 'Experienced professional';
});

// Virtual for getting full location
listingSchema.virtual('fullLocation').get(function() {
  return `${this.location.city}, ${this.location.country}`;
});

// Pre-save middleware
listingSchema.pre('save', function(next) {
  // Update the sort order based on ratings and bookings if not manually set
  if (this.isModified('ratings') || this.isModified('bookings')) {
    this.sortOrder = (this.ratings.average * 20) + (this.bookings.completed * 0.1);
  }
  
  // Automatically set security fee based on service type
  if (this.isModified('serviceType') || this.isModified('pricing.securityFee') || this.isNew) {
    if (this.serviceType === 'human') {
      this.pricing.securityFee = 0;
    } else if (this.serviceType === 'non_human' && (!this.pricing.securityFee || this.pricing.securityFee === 0)) {
      // Set a default security fee for non-human services if not already set
      this.pricing.securityFee = 50; // Default €50 security fee for equipment/non-human services
    }
  }
  
  next();
});

// Indexes for better performance
listingSchema.index({ vendor: 1, status: 1 });
listingSchema.index({ category: 1, subCategory: 1, isActive: 1 });
listingSchema.index({ 'location.city': 1, isActive: 1 });
listingSchema.index({ status: 1, isActive: 1, isFeatured: -1, sortOrder: -1 });
listingSchema.index({ tags: 1 });
listingSchema.index({ 'ratings.average': -1, 'bookings.completed': -1 });
listingSchema.index({ 'title.en': 'text', 'title.nl': 'text', 'description.en': 'text', 'description.nl': 'text', tags: 'text' });

// Compound index for category-based filtering
listingSchema.index({ 
  category: 1, 
  subCategory: 1, 
  'location.city': 1, 
  isActive: 1, 
  status: 1 
});

module.exports = mongoose.model('Listing', listingSchema);
