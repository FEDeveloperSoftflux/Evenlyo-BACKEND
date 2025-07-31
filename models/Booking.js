const mongoose = require('mongoose');

// Booking Schema
const bookingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    unique: true,
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  serviceItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: true
  },
  bookingDetails: {
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
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    duration: {
      hours: Number,
      days: Number
    },
    location: {
      type: String,
      required: true
    },
    instructions: String
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
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'paid', 'on_the_way', 'received', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer', 'cash']
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
    notes: String
  }],
  cancellationDetails: {
    reason: String,
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
  rejectionReason: String,
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
    clientFeedback: String,
    vendorFeedback: String
  },
  invoiceUrl: String,
 timestamps: true
});

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate tracking ID if not exists
  if (!this.trackingId) {
    this.trackingId = 'TRK' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  
  // Add status to history if status changed
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      notes: 'Status updated'
    });
  }
  
  next();
});

// Indexes for better performance
bookingSchema.index({ trackingId: 1 });
bookingSchema.index({ clientId: 1, status: 1 });
bookingSchema.index({ vendorId: 1, status: 1 });
bookingSchema.index({ serviceItemId: 1 });
bookingSchema.index({ 'bookingDetails.startDate': 1, 'bookingDetails.endDate': 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);