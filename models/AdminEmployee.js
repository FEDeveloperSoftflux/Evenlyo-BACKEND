const mongoose = require('mongoose');

const adminEmployeeSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, unique: true },
  contactNumber: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  designation: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminDesignation', required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
}, { timestamps: true });

module.exports = mongoose.model('AdminEmployee', adminEmployeeSchema);