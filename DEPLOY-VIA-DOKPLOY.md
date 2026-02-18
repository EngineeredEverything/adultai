# Deploying AdultAI via Dokploy (Auto-Deploy from GitHub)

## Current Setup
- **Dokploy Dashboard:** http://145.79.1.40:3000
- **GitHub Repo:** https://github.com/EngineeredEverything/adultai
- **Branch:** main
- **Service:** website-adultai-pbaavf

## Step 1: Configure GitHub Integration in Dokploy

### Access Dokploy Dashboard
1. Visit http://145.79.1.40:3000
2. Login with your Dokploy credentials
3. Navigate to the `website-adultai-pbaavf` application

### Connect GitHub Repository
1. **Go to Application Settings**
2. **Source/Repository Section:**
   - Source Type: Git
   - Repository URL: `https://github.com/EngineeredEverything/adultai.git`
   - Branch: `main`
   - Build Path: `/` (root)

3. **Authentication:**
   - Add GitHub Personal Access Token (PAT)
   - Or use SSH key (if configured)

### Build Configuration
1. **Build Method:** Dockerfile or Nixpacks
   
2. **If using Dockerfile** (recommended):
   ```dockerfile
   # Add this to /root/adultai/Dockerfile
   FROM node:24-alpine
   WORKDIR /app
   
   # Copy package files
   COPY package.json pnpm-lock.yaml ./
   
   # Install pnpm
   RUN npm install -g pnpm
   
   # Install dependencies
   RUN pnpm install --frozen-lockfile
   
   # Copy source code
   COPY . .
   
   # Build
   RUN pnpm build
   
   # Expose port
   EXPOSE 3000
   
   # Start
   CMD ["pnpm", "start"]
   ```

3. **If using Nixpacks** (auto-detect):
   - Dokploy will auto-detect Next.js
   - Set build command: `pnpm build`
   - Set start command: `pnpm start`

### Environment Variables
Add these in Dokploy's Environment section:
```env
NODE_ENV=production
DATABASE_URL=mongodb://root:1234567890@database-adultai-yp8zp9:27017/adultai-production-v2
GPU_API_URL=http://213.224.31.105:8080
GPU_API_KEY=Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o
OPENAI_API_KEY=<your_key>
ELEVENLABS_API_KEY=<your_key>
BUNNY_API_KEY=<your_key>
NEXT_PUBLIC_BUNNY_CDN_URL=<your_cdn_url>
```

## Step 2: Enable Auto-Deploy

### GitHub Webhook (Automatic)
1. **In Dokploy Application Settings:**
   - Enable "Auto Deploy on Push"
   - Copy the webhook URL provided

2. **In GitHub Repository Settings:**
   - Go to Settings → Webhooks → Add webhook
   - Paste Dokploy webhook URL
   - Content type: `application/json`
   - Events: "Just the push event"
   - Save

**Result:** Every `git push` to `main` triggers automatic rebuild and deployment

### Manual Deploy
- Click "Deploy" button in Dokploy dashboard
- Or use Dokploy CLI: `dokploy deploy <service-id>`

## Step 3: Container Resource Limits

**Current Issue:** Build fails in-container due to memory limits

**Fix in Dokploy:**
1. Go to Application → Resources
2. Increase limits:
   - Memory Limit: 4GB (currently hitting OOM during build)
   - CPU Limit: 2 CPUs
   - Memory Reservation: 2GB

## Step 4: Health Checks

Configure in Dokploy → Health:
```yaml
HTTP:
  Path: /api/health
  Port: 3000
  Interval: 30s
  Timeout: 10s
  Retries: 3
```

## Deployment Workflow

### After GitHub Integration:
```bash
# Local development
git add .
git commit -m "feature: new feature"
git push origin main

# Dokploy automatically:
# 1. Receives webhook from GitHub
# 2. Pulls latest code
# 3. Builds Docker image
# 4. Runs health checks
# 5. Deploys new container
# 6. Routes traffic (zero-downtime)
```

### Build Time
- First build: ~3-5 minutes
- Subsequent builds: ~2-3 minutes (cached layers)

## Troubleshooting

### Build Fails (Out of Memory)
**Solution 1:** Increase container memory to 4GB in Dokploy

**Solution 2:** Multi-stage Dockerfile
```dockerfile
# Builder stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

# Production stage (smaller image)
FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Webhook Not Firing
1. Check GitHub webhook delivery logs
2. Verify webhook URL is correct
3. Check Dokploy webhook secret matches

### Build Succeeds but Site Down
1. Check Dokploy logs: Application → Logs
2. Verify environment variables are set
3. Check database connectivity
4. Ensure port 3000 is exposed

## Alternative: GitHub Actions → Dokploy

If webhooks don't work, use GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Dokploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Trigger Dokploy Deploy
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.DOKPLOY_TOKEN }}" \
            https://145.79.1.40:3000/api/deploy/webhook/<your-webhook-id>
```

## Benefits of Auto-Deploy

✅ **No manual SSH required** - Push to GitHub and done
✅ **Zero-downtime deployments** - Dokploy handles graceful rollover
✅ **Rollback support** - Easy to revert to previous version
✅ **Build logs** - See exactly what happened if build fails
✅ **Environment management** - Store secrets securely in Dokploy
✅ **Health checks** - Auto-restart if container crashes

## Current Manual Workaround (Until Auto-Deploy Configured)

```bash
ssh root@145.79.1.40
cd /root/adultai-backup
git pull origin main
pnpm install
pnpm build
CONTAINER=$(docker ps | grep "website-adultai" | grep "Running" | awk '{print $NF}')
docker cp .next $CONTAINER:/app/
docker service update --force website-adultai-pbaavf
```

## Next Steps

1. **Configure GitHub integration in Dokploy** (5 minutes)
2. **Add webhook to GitHub repo** (2 minutes)
3. **Test by pushing small change** (verify auto-deploy works)
4. **Increase container memory to 4GB** (prevent OOM during builds)
5. **Monitor first few deployments** (ensure stability)

After setup, deployments are as simple as:
```bash
git push origin main
# Wait 2-3 minutes, site is live!
```
