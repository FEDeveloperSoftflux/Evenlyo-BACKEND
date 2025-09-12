const express = require('express');
const router = express.Router();
const {createPaymentIntent,getPaymentIntentByInternalId} = require('../controllers/paymentController');
const stripeWebhookController = require('../controllers/stripeWebhookController');


// Create a payment intent
router.post('/create-payment-intent', createPaymentIntent);

// Convenience GET by internalId
router.get('/get-payment-intent/:internalId', getPaymentIntentByInternalId);

// Stripe webhook endpoint
router.post('/webhook', (req, res, next) => {
	// `req.rawBody` is populated by the application-level json verify middleware in app.js
	return stripeWebhookController.handleWebhook(req, res, next);
});

module.exports = router;
