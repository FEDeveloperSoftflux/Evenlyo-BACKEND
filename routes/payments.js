const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const stripeWebhookController = require('../controllers/stripeWebhookController');

// Minimal payments API surface:
// - POST /api/payments/create-payment-intent  -> create a Stripe PaymentIntent and store mapping
// - GET  /api/payments/get-payment-intent/:internalId -> retrieve client_secret/status by internalId
// - POST /api/payments/webhook -> Stripe webhook handler (uses raw body captured at app level)

// Create a payment intent
router.post('/create-payment-intent', paymentController.createPaymentIntent);

// Convenience GET by internalId
router.get('/get-payment-intent/:internalId', paymentController.getPaymentIntentByInternalId);

// Stripe webhook endpoint
router.post('/webhook', (req, res, next) => {
	// `req.rawBody` is populated by the application-level json verify middleware in app.js
	return stripeWebhookController.handleWebhook(req, res, next);
});

module.exports = router;
