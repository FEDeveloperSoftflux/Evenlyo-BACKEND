const stripe = require('../config/stripe');

// Create a payment intent
exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
