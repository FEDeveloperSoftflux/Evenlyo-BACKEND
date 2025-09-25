const mongoose = require('mongoose');

// BookingRequest Schema - Updated to match requirements
const bookingRequestSchema = new mongoose.Schema({
  trackingId: {
  condition: {
    type: String,
    enum: ['good', 'fair', 'claim'],
    default: 'good',
    required: true
  },
    type: String,
    unique: true,
    required: true,
    default: function() {
      return 'TRK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  },
  userId: { // Updated from clientId for consistency
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  listingId: { // Updated from serviceItemId to match requirements
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  details: { // Updated field name to match requirements
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    startTime: {
      type: String,
      required: function() {
        // Only required if startDate and endDate are the same (single-day booking)
        return this.details && this.details.startDate && this.details.endDate &&
          new Date(this.details.startDate).toDateString() === new Date(this.details.endDate).toDateString();
      }
    },
    endTime: {
      type: String,
      required: function() {
        // Only required if startDate and endDate are the same (single-day booking)
        return this.details && this.details.startDate && this.details.endDate &&
          new Date(this.details.startDate).toDateString() === new Date(this.details.endDate).toDateString();
      }
    },
    duration: {
      hours: Number,
      days: Number,
      totalHours: Number, // Total hours across all days
      isMultiDay: {
        type: Boolean,
        default: false
      }
    },
    schedule: [{ // For multi-day bookings with different daily schedules
      date: {
        type: Date,
        required: true
      },
      startTime: {
        type: String,
        required: true
      },
      endTime: {
        type: String,
        required: true
      },
      dailyHours: Number,
      notes: {
        en: {
          type: String,
          trim: true
        },
        nl: {
          type: String,
          trim: true
        }
      }
    }],
    eventLocation: { // Updated field name
      type: String,
      required: true
    },
    eventType: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
    guestCount: Number,
    specialRequests: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
    contactPreference: {
      type: String,
      enum: ['phone', 'email', 'whatsapp'],
      default: 'email'
    }
  },
  pricing: {
    bookingPrice: {
      type: Number,
      required: true,
      min: 0
    },
    securityPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    extraCharges: {
      type: Number,
      default: 0,
      min: 0
    },
    securityFee: {
      type: Number,
      default: 0,
      min: 0
    },
    claimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'paid', 'on_the_way', 'received', 'picked_up', 'completed', 'cancelled', 'claim', 'finished', 'received_back'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer', 'cash', 'card']
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      userType: String,
      name: String
    },
    notes: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    }
  }],
  cancellationDetails: {
    reason: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
    requestedBy: {
      type: String,
      enum: ['client', 'vendor']
    },
    requestedAt: Date,
    isWithinCancellationWindow: Boolean,
    refundAmount: {
      type: Number,
      default: 0
    }
  },
  rejectionReason: {
    en: {
      type: String,
      trim: true
    },
    nl: {
      type: String,
      trim: true
    }
  },
  claimDetails: {
    reason: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
    claimedBy: {
      type: String,
      enum: ['client', 'vendor']
    },
    claimedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'resolved', 'rejected'],
      default: 'pending'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    adminNotes: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    }
  },
  deliveryDetails: {
    driverInfo: {
      name: String,
      id: String,
      contactNumber: String
    },
    pickupTime: Date,
    deliveryTime: Date,
    returnTime: Date
  },
  feedback: {
    clientFeedback: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    },
    vendorFeedback: {
      en: {
        type: String,
        trim: true
      },
      nl: {
        type: String,
        trim: true
      }
    }
  },
  invoiceUrl: String,
  // Platform fees
  platformFee: {
    type: Number,
    default: 0
  },
  itemPlatformFee: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

// Pre-save middleware
bookingRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate tracking ID if not exists
  if (!this.trackingId) {
    this.trackingId = 'TRK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  
  // Calculate multi-day booking details
  if (this.details && this.details.startDate && this.details.endDate) {
    const startDate = new Date(this.details.startDate);
    const endDate = new Date(this.details.endDate);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end dates
    
    // Set multi-day flag
    this.details.duration.isMultiDay = diffDays > 1;
    this.details.duration.days = diffDays;
    
    // If no custom schedule provided and it's multi-day, create default schedule
    if (this.details.duration.isMultiDay && (!this.details.schedule || this.details.schedule.length === 0)) {
      this.details.schedule = [];
      const currentDate = new Date(startDate);
      
      for (let i = 0; i < diffDays; i++) {
        const scheduleDate = new Date(currentDate);
        scheduleDate.setDate(currentDate.getDate() + i);
        
        // Calculate daily hours
        const dailyStartTime = this.details.startTime || '09:00';
        const dailyEndTime = this.details.endTime || '17:00';
        const dailyHours = this.calculateHoursBetween(dailyStartTime, dailyEndTime);
        
        this.details.schedule.push({
          date: scheduleDate,
          startTime: dailyStartTime,
          endTime: dailyEndTime,
          dailyHours: dailyHours,
          notes: {
            en: i === 0 ? 'First day' : i === diffDays - 1 ? 'Last day' : `Day ${i + 1}`,
            nl: i === 0 ? 'Eerste dag' : i === diffDays - 1 ? 'Laatste dag' : `Dag ${i + 1}`
          }
        });
      }
    }
    
    // Calculate total hours across all days
    if (this.details.schedule && this.details.schedule.length > 0) {
      this.details.duration.totalHours = this.details.schedule.reduce((total, day) => {
        return total + (day.dailyHours || 8); // Default to 8 hours if not specified
      }, 0);
    } else {
      // Single day calculation
      const dailyHours = this.calculateHoursBetween(this.details.startTime, this.details.endTime);
      this.details.duration.hours = dailyHours;
      this.details.duration.totalHours = dailyHours;
    }
  }
  
  // Add status to history if status changed
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      notes: {
        en: 'Status updated',
        nl: 'Status bijgewerkt'
      }
    });
  }
  
  next();
});

// Helper method to calculate hours between two time strings
bookingRequestSchema.methods.calculateHoursBetween = function(startTime, endTime) {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  let diffHours = (end - start) / (1000 * 60 * 60);
  
  // Handle overnight bookings (e.g., 22:00 to 02:00)
  if (diffHours < 0) {
    diffHours += 24;
  }
  
  return Math.max(diffHours, 0);
};

// Indexes for better performance
bookingRequestSchema.index({ trackingId: 1 });
bookingRequestSchema.index({ userId: 1, status: 1 });
bookingRequestSchema.index({ vendorId: 1, status: 1 });
bookingRequestSchema.index({ listingId: 1 });
bookingRequestSchema.index({ 'details.startDate': 1, 'details.endDate': 1 });
bookingRequestSchema.index({ paymentStatus: 1 });
bookingRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BookingRequest', bookingRequestSchema);