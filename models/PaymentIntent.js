const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const paymentIntentSchema = new mongoose.Schema({
  internalId: { type: String, unique: true, default: () => uuidv4() },
  stripeIntentId: { type: String },
  clientSecret: { type: String },
  // Allow any Stripe status string (Stripe uses values like "requires_payment_method", "requires_action", "succeeded", etc.)
  status: { type: String, default: 'pending' },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'BookingRequest' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  amount: { type: Number }, // amount in smallest currency unit
  currency: { type: String },
  quantity: { type: Number, default: 1 },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
