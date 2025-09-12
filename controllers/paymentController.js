const stripe = require('../config/stripe');
const asyncHandler = require('express-async-handler');
const Listing = require('../models/Listing');
const PaymentIntent = require('../models/PaymentIntent');

// Create a payment intent for a product (store internal mapping)
exports.createPaymentIntent = asyncHandler(async (req, res) => {
  // Accept booking flow: { bookingId, items } OR listing flow: { listingId or productId }
  const { bookingId, items, listingId, productId, quantity = 1, metadata = {}, currency } = req.body;

  let usedCurrency = currency || 'usd';
  let amount = 0; // in smallest unit
  let listing;
  let booking;

  if (bookingId) {
    // Booking-based payment
    const Booking = require('../models/Booking');
    booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Use booking.pricing.totalPrice as main amount (assume stored in main units)
    usedCurrency = booking.pricing?.currency || usedCurrency;
    amount = Math.round((booking.pricing.totalPrice || booking.pricing.bookingPrice || 0) * 100);

    // Fallback: if booking total is missing/zero and items array provided,
    // sum listing prices from provided item listing IDs
    if ((!amount || amount <= 0) && Array.isArray(items) && items.length > 0) {
      const ListingModel = require('../models/Listing');
      const listings = await ListingModel.find({ _id: { $in: items } });
      if (listings && listings.length > 0) {
        // If listings have pricing.amount, sum them
        const sum = listings.reduce((acc, l) => acc + (l.pricing?.amount || 0), 0);
        amount = Math.round(sum * 100);
        // try derive currency from first listing
        usedCurrency = listings[0].pricing?.currency || usedCurrency;
      }
    }
  } else {
    // Listing-based payment
    const id = listingId || productId;
    if (!id) return res.status(400).json({ error: 'listingId or productId is required' });

    listing = await Listing.findById(id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    usedCurrency = currency || listing.pricing?.currency || usedCurrency;
    amount = Math.round((listing.pricing.amount * 100) * quantity);
  }

  // Validate amount
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount is missing or zero. Check booking.pricing.totalPrice or listing.pricing.amount.' });
  }

  // prepare metadata for Stripe: all values must be strings
  const metadataForStripe = {};
  // include listing/booking/quantity/items as strings when present
  if (listing) metadataForStripe.listingId = String(listing._id);
  if (booking) metadataForStripe.bookingId = String(booking._id);
  metadataForStripe.quantity = String(quantity || 1);
  if (items) metadataForStripe.items = Array.isArray(items) ? JSON.stringify(items) : String(items);

  // include any additional metadata provided in request, stringifying non-string values
  if (metadata && typeof metadata === 'object') {
    Object.entries(metadata).forEach(([k, v]) => {
      metadataForStripe[k] = typeof v === 'string' ? v : JSON.stringify(v);
    });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: usedCurrency,
    automatic_payment_methods: { enabled: true },
    metadata: metadataForStripe,
  });

  // store mapping in DB
  const pi = await PaymentIntent.create({
    stripeIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
    listing: listing ? listing._id : undefined,
    booking: booking ? booking._id : undefined,
    amount,
    currency: usedCurrency,
    quantity,
    metadata: { ...(metadata || {}), items: items || undefined },
  });

  // Return internal id, Stripe client secret and Stripe intent id
  res.status(201).json({
    internalId: pi.internalId,
    client_secret: paymentIntent.client_secret,
    stripeId: paymentIntent.id,
  });
});

// Get payment intent by internal id (returns client_secret and status)
exports.getPaymentIntent = asyncHandler(async (req, res) => {
  const { internalId } = req.body;
  if (!internalId) return res.status(400).json({ error: 'internalId is required' });

  // populate the listing reference
  const pi = await PaymentIntent.findOne({ internalId }).populate('listing');
  if (!pi) return res.status(404).json({ error: 'PaymentIntent not found' });

  res.json({
    internalId: pi.internalId,
    clientSecret: pi.clientSecret,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    listing: pi.listing,
    quantity: pi.quantity,
  });
});

// GET handler by URL param
exports.getPaymentIntentByInternalId = asyncHandler(async (req, res) => {
  const { internalId } = req.params;
  if (!internalId) return res.status(400).json({ error: 'internalId is required' });

  const pi = await PaymentIntent.findOne({ internalId }).populate('listing').populate('booking');
  if (!pi) return res.status(404).json({ error: 'PaymentIntent not found' });

  res.json({
    internalId: pi.internalId,
    clientSecret: pi.clientSecret,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    listing: pi.listing,
    booking: pi.booking,
    quantity: pi.quantity,
  });
});

// GET /api/payments/status/:internalId
exports.getPaymentIntentStatus = asyncHandler(async (req, res) => {
  const { internalId } = req.params;
  if (!internalId) return res.status(400).json({ error: 'internalId is required' });

  const pi = await PaymentIntent.findOne({ internalId });
  if (!pi) return res.status(404).json({ error: 'PaymentIntent not found' });

  res.json({ internalId: pi.internalId, status: pi.status, stripeId: pi.stripeIntentId });
});

// POST /api/payments/refresh/:internalId - force fetch from Stripe and update DB
exports.refreshPaymentIntentFromStripe = asyncHandler(async (req, res) => {
  const { internalId } = req.params;
  if (!internalId) return res.status(400).json({ error: 'internalId is required' });

  const pi = await PaymentIntent.findOne({ internalId });
  if (!pi) return res.status(404).json({ error: 'PaymentIntent not found' });
  if (!pi.stripeIntentId) return res.status(400).json({ error: 'No stripe intent id stored for this payment' });

  // Fetch fresh from Stripe
  const stripeIntent = await stripe.paymentIntents.retrieve(pi.stripeIntentId);
  if (!stripeIntent) return res.status(500).json({ error: 'Failed to fetch PaymentIntent from Stripe' });

  // Update status in DB using existing helper
  await exports.updateStatus(stripeIntent.id, stripeIntent.status);

  const updated = await PaymentIntent.findOne({ internalId });
  res.json({ internalId: updated.internalId, status: updated.status, stripeId: updated.stripeIntentId });
});

// POST /api/payments/refresh-by-stripe/:stripeId - force fetch from Stripe by Stripe PaymentIntent id and update DB
exports.refreshPaymentIntentByStripe = asyncHandler(async (req, res) => {
  const { stripeId } = req.params;
  if (!stripeId) return res.status(400).json({ error: 'stripeId is required' });

  // Find local mapping by stripeIntentId
  const piLocal = await PaymentIntent.findOne({ stripeIntentId: stripeId });
  if (!piLocal) return res.status(404).json({ error: 'PaymentIntent not found locally for provided stripeId' });
  // Fetch fresh from Stripe
  const stripeIntent = await stripe.paymentIntents.retrieve(stripeId);
  if (!stripeIntent) return res.status(500).json({ error: 'Failed to fetch PaymentIntent from Stripe' });

  // Update status in DB using existing helper
  await exports.updateStatus(stripeIntent.id, stripeIntent.status);

  const updated = await PaymentIntent.findOne({ stripeIntentId: stripeId });
  res.json({ internalId: updated.internalId, status: updated.status, stripeId: updated.stripeIntentId });
});

// Exported for webhook controller to update status
exports.updateStatus = asyncHandler(async (stripeIntentId, status) => {
  try {
    console.log(`updateStatus called for stripeIntentId=${stripeIntentId} status=${status}`);
    const pi = await PaymentIntent.findOne({ stripeIntentId });
    if (!pi) {
      console.warn('updateStatus: PaymentIntent not found for stripeIntentId=', stripeIntentId);
      return null;
    }
    pi.status = status;
    await pi.save();

    // If this payment intent is linked to a booking, update booking status/paymentStatus
    if (pi.booking) {
      const Booking = require('../models/Booking');
      const booking = await Booking.findById(pi.booking);
      if (booking) {
        // Map Stripe status to booking fields
        if (status === 'succeeded') {
          booking.paymentStatus = 'paid';
          booking.paymentMethod = 'stripe';
          // also set booking.status to paid if your flow expects that
          booking.status = 'paid';
        } else if (status === 'failed' || (status && status.includes('fail'))) {
          booking.paymentStatus = booking.paymentStatus || 'pending';
        } else if (status && status.includes('requires')) {
          booking.paymentStatus = booking.paymentStatus || 'pending';
        }
        await booking.save();
        console.log('updateStatus: booking updated', booking._id.toString(), 'paymentStatus=', booking.paymentStatus);
      } else {
        console.warn('updateStatus: linked booking not found for id=', pi.booking);
      }
    }

    return pi;
  } catch (err) {
    console.error('updateStatus error for', stripeIntentId, err);
    throw err;
  }
});
