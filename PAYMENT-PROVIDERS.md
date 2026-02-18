# Payment Provider Options for AdultAI

## Why Not Stripe?
Stripe explicitly prohibits adult content in their [Prohibited & Restricted Businesses policy](https://stripe.com/legal/restricted-businesses). Using Stripe for adult content will result in account termination.

## Adult-Friendly Payment Processors

### 1. CCBill (Recommended)
- **Industry Standard** for adult content
- Merchant account + payment gateway
- Supports subscriptions, one-time payments, credits
- 10-15% processing fee
- Setup: Requires business verification, 2-4 week approval
- Integration: REST API, hosted payment pages
- **Best for:** Established businesses, recurring subscriptions

### 2. Segpay
- Competitor to CCBill
- Similar features and pricing
- Good for international payments
- 10-14% processing fee
- Setup: 1-3 week approval
- **Best for:** International audience

### 3. Epoch
- Focused on digital content
- Lower fees (8-12%)
- Fast approval (1-2 weeks)
- Good fraud protection
- **Best for:** Digital goods, lower volume

### 4. Cryptocurrency
- **TEMPT Token Integration** (planned)
- Lower fees (2-5%)
- No chargebacks
- Instant settlement
- **Best for:** Crypto-native users, international payments

### 5. Vendo
- Full payment orchestration platform
- Supports multiple processors (CCBill, Segpay, etc.)
- Smart routing for best approval rates
- Higher setup cost
- **Best for:** High volume, optimization

## Recommendation

**Phase 1 (MVP):** Start with CCBill or Segpay
- Proven, trusted in adult industry
- Supports all payment types
- Good customer support

**Phase 2:** Add TEMPT token integration
- Lower fees
- Synergy with TEMPTtoken project
- Appeals to crypto users

**Phase 3:** Add payment orchestration (Vendo) if volume justifies it

## Integration Checklist

- [ ] Choose primary provider (CCBill/Segpay/Epoch)
- [ ] Submit merchant application
- [ ] Get approved (2-4 weeks)
- [ ] Integrate API/webhooks
- [ ] Test payment flow
- [ ] Add age verification (required by processors)
- [ ] Set up subscription management
- [ ] Implement 2257 compliance (US requirement)

## Revenue Tracking

All payments should include metadata:
```json
{
  "bot": "adultai",
  "userId": "user_id",
  "planId": "plan_id",
  "transactionType": "subscription|credits|one-time"
}
```

This ensures proper revenue attribution in the EngineeredEverything fleet.
