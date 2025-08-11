const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const supportTicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    default: () => `TICKET-${uuidv4().substring(0, 8).toUpperCase()}`
  },
  userEmail: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issueRelatedTo: {
    type: String,
    required: true,
    enum: [
      'Account Issues',
      'Booking Problems', 
      'Payment Issues',
      'Technical Support',
      'Service Quality',
      'Refund Request',
      'General Inquiry',
      'Other'
    ]
  },
  details: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date
  }
});

// Update the updatedAt field before saving
supportTicketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.status === 'closed' && !this.closedAt) {
    this.closedAt = Date.now();
  }
  next();
});

// Create indexes for better performance
supportTicketSchema.index({ userEmail: 1, createdAt: -1 });
supportTicketSchema.index({ ticketId: 1 });
supportTicketSchema.index({ status: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);