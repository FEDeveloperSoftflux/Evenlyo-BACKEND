const mongoose = require('mongoose');

const serviceItemStockLogSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceItem',
    required: true
  },
  type: {
    type: String,
    enum: ['checkin', 'checkout', 'missing', 'stockin'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  dateTime: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('ServiceItemStockLog', serviceItemStockLogSchema);
