# Stripe Payment Integration Setup

## Installation

```bash
npm install stripe @stripe/stripe-js
# or
pnpm add stripe @stripe/stripe-js
```

## Environment Variables

Add these to your `.env.production` file:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://adultai.com
```

**Note:** Use test keys for development, live keys for production.

## Stripe Dashboard Setup

### 1. Create Products & Prices

In the Stripe Dashboard, create products for each subscription plan:

1. Go to Products → Add product
2. Create a product for each plan (Free, Pro, Premium, etc.)
3. Add pricing for monthly and yearly billing
4. Note down the Price IDs

### 2. Configure Webhook

1. Go to Developers → Webhooks
2. Add endpoint: `https://adultai.com/api/stripe/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Testing

### Test Cards

Stripe provides test cards for development:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`

Use any future expiration date and any 3-digit CVC.

### Test Webhook Locally

Install Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will give you a webhook secret for local testing.

## Revenue Tracking

All Stripe checkouts are tagged with:
```javascript
metadata: {
  bot: "adultai",  // Required for fleet revenue tracking
  userId: "...",
  planId: "...",
  billing: "monthly" | "yearly"
}
```

## Migration from PayPal

The old PayPal checkout is backed up at:
- `app/(user)/checkout/CheckoutPage.paypal.backup.tsx`

To revert to PayPal, restore this file and update `page.tsx`.

## API Endpoints

### Create Checkout Session
`POST /api/stripe/create-checkout-session`

Request:
```json
{
  "planId": "plan_id_from_database",
  "billing": "monthly"
}
```

Response:
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Webhook Handler
`POST /api/stripe/webhook`

Processes Stripe webhook events. Must be called from Stripe servers with valid signature.

## Security Notes

1. **Never expose** `STRIPE_SECRET_KEY` in client code
2. **Always verify** webhook signatures
3. **Use HTTPS** in production
4. **Store minimal** customer data (Stripe handles PII)

## Support

- Stripe Docs: https://stripe.com/docs
- Test Mode Dashboard: https://dashboard.stripe.com/test
- Live Mode Dashboard: https://dashboard.stripe.com/live
