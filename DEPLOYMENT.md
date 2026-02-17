# AdultAI Deployment Guide

## Overview

AdultAI is a Next.js 14 application with AI-powered image generation, video generation, and AI companion chat features.

**Tech Stack:**
- Next.js 14 (App Router)
- TypeScript
- Prisma (MongoDB)
- NextAuth.js
- Stripe
- TailwindCSS
- Bunny CDN

---

## Prerequisites

- Node.js 18+ or Bun
- MongoDB instance
- GPU server (for image/video generation)
- Bunny CDN account
- Stripe account
- OpenAI API key
- ElevenLabs API key (optional, for voice)

---

## Quick Start (Production)

### 1. Clone & Install

```bash
git clone https://github.com/EngineeredEverything/adultai.git
cd adultai
pnpm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.production`:

```bash
cp .env.example .env.production
```

**Required variables:**

```env
# Database
DATABASE_URL=mongodb://root:password@database-adultai:27017/adultai-production?directConnection=true&authSource=admin

# App
APP_URL=https://adultai.com
APP_SECRET=<generate-random-secret>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# GPU Server
GPU_API_URL=http://213.224.31.105:8080
GPU_API_KEY=<your-gpu-api-key>

# AI Services
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=<optional>

# Bunny CDN
BUNNY_API_KEY=<your-bunny-api-key>
NEXT_PUBLIC_BUNNY_CDN_URL=https://adultai-com.b-cdn.net
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Optional: Seed database with initial plans
pnpm prisma db seed
```

### 4. Build & Run

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

Server will run on `http://localhost:3000`

---

## Docker Deployment (Recommended)

### Using Dokploy (Current Setup)

1. Push code to GitHub
2. Connect repo to Dokploy
3. Set environment variables in Dokploy dashboard
4. Deploy via Dokploy UI

### Manual Docker

```bash
# Build image
docker build -t adultai .

# Run container
docker run -p 3000:3000 \
  --env-file .env.production \
  adultai
```

---

## Stripe Setup

### 1. Create Products

In Stripe Dashboard → Products:

1. **Free Plan** - $0/month (or hide from UI)
2. **Pro Plan** - $20/month or $200/year
3. **Premium Plan** - $50/month or $500/year

### 2. Configure Webhook

1. Go to Developers → Webhooks
2. Add endpoint: `https://adultai.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

### 3. Test Mode

Use Stripe test keys during development:
- Test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC

---

## GPU Server Setup

The GPU server handles:
- Image generation (Stable Diffusion)
- Video generation (Wan-AI)
- Talking avatars (Wav2Lip)

**Server:** 213.224.31.105:8080 (vast.ai RTX 3090)

### Required API Key

Set `GPU_API_KEY` in environment variables to authenticate with GPU server.

### Endpoints

- Image: `POST /api/v1/generate`
- Video: `POST /api/v1/video/generate`
- Talking Avatar: `POST /api/v1/talking-avatar/generate`

---

## Bunny CDN Setup

### 1. Create Storage Zone

1. Go to Bunny CDN → Storage
2. Create zone: `adultai-com`
3. Get API key

### 2. Create Pull Zone

1. Create pull zone linked to storage zone
2. Note the CDN URL: `https://adultai-com.b-cdn.net`

### 3. Configure in App

```env
BUNNY_API_KEY=your-api-key
NEXT_PUBLIC_BUNNY_CDN_URL=https://adultai-com.b-cdn.net
```

Files are automatically uploaded to:
- `/audio/` - TTS audio files
- `/videos/` - Talking avatar videos
- `/images/` - Generated images

---

## Database Schema

The app uses MongoDB with Prisma ORM.

**Key models:**
- `User` - User accounts & authentication
- `Subscription` - Stripe subscription tracking
- `Plan` - Subscription plans
- `Character` - AI companions
- `ChatMessage` - Conversation history
- `GeneratedImage` - Image generation history
- `GeneratedVideo` - Video generation history

### Migrations

Prisma automatically syncs schema with MongoDB. No manual migrations needed.

---

## Features

### ✅ Implemented

- User authentication (email/password + OAuth)
- Subscription management (Stripe)
- Image generation (GPU API)
- Video generation (GPU API)
- AI companion character creation
- Real-time chat with AI companions
- Voice responses (ElevenLabs TTS)
- Talking avatar videos (Wav2Lip)
- CDN storage (Bunny CDN)
- Admin panel

### 🚧 In Progress

- Payment webhook testing
- ElevenLabs voice integration testing
- Wav2Lip talking avatar testing

### 📋 Planned

- Character memory system (vector DB)
- Custom voice cloning
- Image-to-video generation
- Creator marketplace

---

## Monitoring & Logs

### Production Logs

```bash
# Docker logs
docker logs -f <container-name>

# PM2 logs (if using PM2)
pm2 logs adultai
```

### Key Metrics

- API response times
- GPU server uptime
- Stripe webhook success rate
- Image generation success rate
- User signup conversion

---

## Security

### Environment Variables

**NEVER commit:**
- API keys
- Database passwords
- Stripe keys
- Session secrets

Use `.env.production` (gitignored) or Dokploy environment variables.

### Webhooks

Always verify webhook signatures:
- Stripe webhooks: signature verification implemented
- GPU webhooks: API key authentication

### User Data

- Passwords hashed with bcrypt
- Email verification required
- Age verification gate (18+)
- GDPR-compliant data handling

---

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next
pnpm install
pnpm build
```

### Database Connection

Check MongoDB is running and connection string is correct:
```bash
mongosh "$DATABASE_URL"
```

### Stripe Webhook Not Working

1. Check webhook endpoint is publicly accessible
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Test with Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

### GPU Server Timeout

Check GPU server status:
```bash
curl http://213.224.31.105:8080/
```

If down, SSH into server and restart:
```bash
ssh -p 29579 root@213.224.31.105
cd /root/urpm
python3 main.py
```

---

## Support

- **Documentation:** [STRIPE-SETUP.md](./STRIPE-SETUP.md)
- **Server Info:** [SERVER-ACCESS.md](../SERVER-ACCESS.md)
- **GitHub:** https://github.com/EngineeredEverything/adultai
- **Discord:** (if available)

---

## License

Proprietary - AdultAI Platform
