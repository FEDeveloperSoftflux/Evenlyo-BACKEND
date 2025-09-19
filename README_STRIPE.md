(Stripe integration notes)

(This project includes a basic Stripe PaymentIntents integration using the Stripe Node SDK and MongoDB models to persist internal mappings.)

(Environment variables)
- STRIPE_SECRET_KEY - your Stripe secret key (required)
- STRIPE_WEBHOOK_SECRET - optional, used to verify webhook signatures (recommended)

(Models)
- `models/Product.js` - stores product metadata and price (price stored in main currency units, e.g. 9.99)
- `models/PaymentIntent.js` - stores internalId (UUID), stripeIntentId, clientSecret, status, product ref, amount, currency, quantity

(Endpoints (mounted under /api/payments))
- POST /create-payment-intent
	- Body: { productId, quantity = 1, metadata?, currency? }
	- Creates a Stripe PaymentIntent for the product, stores a PaymentIntent document, returns { internalId }

- POST /get-payment-intent
	- Body: { internalId }
	- Returns stored clientSecret and status for the internal payment intent

- POST /webhook
	- Stripe sends events here. The route expects raw request body for signature verification.
	- Configure `STRIPE_WEBHOOK_SECRET` and set your webhook endpoint in the Stripe dashboard.

(Notes / Security)
- Use HTTPS in production and keep STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET private.
- Webhook route uses express.raw to validate signatures. If STRIPE_WEBHOOK_SECRET is not set the handler will accept the JSON body (not recommended for production).

(Testing locally)
- Use the Stripe CLI to forward events and test webhooks: `stripe listen --forward-to localhost:5000/api/payments/webhook`


Admin 1

Email: admin1@example.com
Password: Admin@123
Admin 2

Email: admin2@example.com
Password: SecurePass456

