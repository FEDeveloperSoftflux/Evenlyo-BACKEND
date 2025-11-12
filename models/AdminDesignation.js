const mongoose = require('mongoose');

const adminDesignationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  permissions: {
    type: Array,
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
}, { timestamps: true });

module.exports = mongoose.model('AdminDesignation', adminDesignationSchema);