# Free Tier & Abuse Prevention

## Overview

AdultAI offers **10 free image generations** to new users with smart abuse prevention to protect the platform from exploitation.

---

## Free Tier Details

### What You Get
- **10 free image generations** for all new users
- Full access to basic generation features
- Try before you buy - no credit card required
- Requires email verification

### Limitations
- **Rate limiting:** 30 seconds cooldown between generations
- **Email verification required** - No unverified accounts can generate
- **Single IP preferred** - Flagged if using 3+ different IPs
- **Standard resolution** - 1024x1024 max for free tier

### After Free Tier
- Clear upgrade prompts when credits run low
- Smooth transition to paid plans
- All features unlock with subscription

---

## Abuse Prevention Layers

### 1. Email Verification ✉️
- **Requirement:** Email must be verified before first generation
- **Purpose:** Prevent bot signups
- **Implementation:** Check `user.emailVerified` field
- **Bypass:** None (mandatory for all free tier users)

### 2. Rate Limiting ⏱️
- **Limit:** 1 generation every 30 seconds
- **Applies to:** All users (free and paid)
- **Purpose:** Prevent rapid-fire abuse
- **Implementation:** Track `user.lastGenerationAt` timestamp
- **Error message:** "Please wait X seconds before generating another image"

### 3. IP Tracking 🌐
- **Track:** All IPs used for generation per user
- **Limit:** Max 3 different IPs per user
- **Purpose:** Detect multi-account abuse
- **Implementation:** Store IPs in `user.generationIPs[]` array
- **Flags:** Suspicious if 4+ IPs used by same account

### 4. Suspicious IP Detection 🚨
- **Monitor:** IPs used by multiple accounts
- **Threshold:** Flag IPs used by 5+ different users
- **Purpose:** Detect VPN/proxy abuse
- **Action:** Block generation from flagged IPs
- **Implementation:** Count users per IP in database

### 5. Progressive Restrictions 📊
- **Basic Plan:** Max 1024x1024, 50 steps, no upscaling
- **Premium Plans:** Higher resolutions, more steps, upscaling
- **Purpose:** Incentivize upgrades for power users
- **Implementation:** Check plan tier in `checkAndUpdateAdvancedUsage()`

---

## Database Schema

### User Model Fields

```prisma
model User {
  // ... existing fields ...

  // Free tier tracking
  freeGenerationsUsed  Int      @default(0)
  freeGenerationsLimit Int      @default(10)

  // Rate limiting
  lastGenerationAt     DateTime?

  // Abuse prevention
  generationIPs        String[] @default([])
  emailVerified        DateTime?
  isSuspended          Boolean  @default(false)
  isBanned             Boolean  @default(false)
}
```

---

## Implementation Details

### Rate Limit Check Flow

```typescript
// 1. Check if user can generate
const rateLimitCheck = await checkGenerationLimit(userId, clientIP)

if (!rateLimitCheck.allowed) {
  throw new Error(rateLimitCheck.reason)
}

// 2. Generate image...

// 3. Record generation
await recordGeneration(userId, clientIP)
```

### Check Logic (lib/rate-limit.ts)

```typescript
export async function checkGenerationLimit(
  userId: string,
  clientIP: string
): Promise<RateLimitResult> {
  // 1. Check if banned/suspended
  // 2. Require email verification (free tier only)
  // 3. Paid users bypass free tier limits
  // 4. Check free tier credits remaining
  // 5. Check rate limit (30s cooldown)
  // 6. Check IP abuse (max 3 IPs per user)
  // 7. Check suspicious IP (5+ users per IP)

  return { allowed: true, remainingCredits: X }
}
```

### Recording Generation

```typescript
export async function recordGeneration(
  userId: string,
  clientIP: string
): Promise<void> {
  // 1. Increment freeGenerationsUsed (free tier only)
  // 2. Update lastGenerationAt timestamp
  // 3. Add IP to generationIPs[] if new
  // 4. Update UsageRecord
}
```

---

## UI Components

### FreeCreditsIndicator.tsx

Shows remaining free credits with:
- Progress bar (visual indicator)
- Dismissible (until low/empty)
- Upgrade CTA (when low or empty)
- Color-coded warnings (green → orange → red)

**Usage:**
```tsx
import FreeCreditsIndicator from "@/components/FreeCreditsIndicator"

const { remainingCredits, freeLimit } = await getUserCredits()

<FreeCreditsIndicator
  remainingCredits={remainingCredits}
  freeLimit={freeLimit}
/>
```

---

## Server Actions

### getUserCredits()
- **Returns:** `{ remainingCredits, freeLimit, hasSubscription }`
- **Values:**
  - `remainingCredits: number` - Free tier credits left
  - `remainingCredits: -1` - Unlimited (paid subscriber)
  - `remainingCredits: null` - Error or not authenticated

### getRateLimitInfo()
- **Returns:** `{ canGenerate, resetIn?, error? }`
- **Purpose:** Check if user needs to wait before next generation

---

## Configuration

### Default Limits (lib/rate-limit.ts)

```typescript
const DEFAULT_LIMITS: GenerationLimits = {
  freeGenerationsLimit: 10,        // Free tier credits
  rateLimitSeconds: 30,            // Cooldown between gens
  maxIPsPerUser: 3,                // Max IPs per account
  suspiciousIPThreshold: 5,        // Flag IPs used by 5+ users
}
```

### Customization

Override defaults per call:

```typescript
await checkGenerationLimit(userId, clientIP, {
  freeGenerationsLimit: 20,  // Give more free credits
  rateLimitSeconds: 60,      // Longer cooldown
  maxIPsPerUser: 5,          // Allow more IPs
  suspiciousIPThreshold: 10, // Higher threshold
})
```

---

## Error Messages

### User-Friendly Errors

- **Email not verified:** "Please verify your email before generating images"
- **Free tier exhausted:** "Free generation limit reached. Please upgrade to continue."
- **Rate limited:** "Please wait 15 seconds before generating another image"
- **Too many IPs:** "Suspicious activity detected. Please contact support if this is an error."
- **Suspicious IP:** "This IP has been flagged for suspicious activity. Please contact support."
- **Account suspended:** "Account is suspended"
- **Account banned:** "Account is banned"

---

## Testing

### Test Free Tier Flow

```bash
# 1. Create new account
# 2. Verify email
# 3. Generate 10 images (should work)
# 4. Try 11th image (should fail with upgrade prompt)
# 5. Subscribe
# 6. Generate again (should work - unlimited)
```

### Test Rate Limiting

```bash
# 1. Generate image
# 2. Immediately try another (should fail with "wait 30s")
# 3. Wait 30 seconds
# 4. Try again (should work)
```

### Test IP Tracking

```bash
# 1. Generate from IP A
# 2. Generate from IP B (should work)
# 3. Generate from IP C (should work)
# 4. Generate from IP D (should fail - max 3 IPs)
```

### Test Suspicious IP

```bash
# 1. Create 5 accounts with same IP
# 2. Generate image from each
# 3. Create 6th account with same IP
# 4. Try to generate (should fail - suspicious IP)
```

---

## Monitoring & Analytics

### Metrics to Track

1. **Free tier conversion rate**
   - Users who exhaust free tier → subscribe
   - Target: 2-5%

2. **Abuse detection rate**
   - Accounts flagged for suspicious activity
   - Target: <1%

3. **Average credits used**
   - How many free gens users actually use
   - Optimize limit based on this

4. **Rate limit hits**
   - How often users hit the 30s cooldown
   - Adjust if too restrictive

### Database Queries

```typescript
// Users who exhausted free tier
await db.user.count({
  where: {
    freeGenerationsUsed: { gte: freeGenerationsLimit },
    subscription: null,
  },
})

// Suspicious IPs (used by 5+ accounts)
const suspiciousIPs = await db.$queryRaw`
  SELECT "generationIPs", COUNT(*)
  FROM "User"
  WHERE array_length("generationIPs", 1) > 0
  GROUP BY "generationIPs"
  HAVING COUNT(*) >= 5
`

// Users with multiple IPs
await db.user.count({
  where: {
    generationIPs: { isEmpty: false },
    // Custom logic: array length > 3
  },
})
```

---

## Roadmap

### Phase 1 (Now) ✅
- 10 free generations
- Email verification required
- 30s rate limiting
- IP tracking
- Basic abuse detection

### Phase 2 (Next)
- Device fingerprinting (more accurate than IP)
- CAPTCHA on 8th/9th generation (prevent bot automation)
- Phone verification for higher free tier (20 credits)
- Referral bonuses (invite friend = +5 credits each)

### Phase 3 (Future)
- Machine learning abuse detection
- Behavioral analysis (bot vs human patterns)
- IP reputation scoring (trust known IPs)
- Graduated rate limits (new users stricter, trusted users looser)

---

## Support & Appeals

### If User is Wrongly Flagged

1. **Contact support** - Provide account email
2. **Review logs** - Check `user.generationIPs`, `lastGenerationAt`
3. **Manual override** - Admin can:
   - Clear `generationIPs` array
   - Reset `freeGenerationsUsed` to 0
   - Add user to whitelist (bypass IP checks)

### Admin Tools Needed

```typescript
// Reset user's free tier
await db.user.update({
  where: { id: userId },
  data: {
    freeGenerationsUsed: 0,
    generationIPs: [],
    isSuspended: false,
  },
})

// Whitelist user (bypass IP checks)
await db.user.update({
  where: { id: userId },
  data: {
    features: { push: "bypass_ip_check" },
  },
})
```

---

## Security Considerations

### What This Prevents
✅ Bot signups (email verification)  
✅ Rapid-fire abuse (rate limiting)  
✅ Multi-accounting (IP tracking)  
✅ VPN/proxy abuse (suspicious IP detection)  
✅ Credit farming (progressive restrictions)

### What This Doesn't Prevent
❌ Dedicated attackers with residential proxies  
❌ Slow, patient abuse (30s between gens)  
❌ Stolen/compromised accounts  

### Additional Layers to Consider
- 2FA for high-value actions
- Payment verification (add card for bonus credits)
- Social proof (link Twitter/Discord for bonus)
- Behavioral analysis (detect non-human patterns)

---

**Last Updated:** 2026-02-18  
**Version:** 1.0  
**Author:** AdultAI Orchestrator
