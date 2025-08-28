const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'failed'],
    default: 'pending'
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  billingDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Billing', billingSchema);
  