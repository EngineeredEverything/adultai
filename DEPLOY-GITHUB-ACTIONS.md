# Auto-Deploy via GitHub Actions (No Dokploy)

Simple automatic deployments - every push to `main` triggers deployment to production.

## How It Works

```
Push to GitHub → GitHub Actions → SSH to VPS → Build → Deploy → Live
```

**Time:** ~3-5 minutes per deployment

## Setup (5 Minutes)

### Step 1: Add SSH Key to GitHub Secrets

1. **Get your VPS SSH private key:**
   ```bash
   # On your local machine (or wherever you have SSH access)
   cat ~/.ssh/id_rsa
   # Copy the entire private key (including BEGIN/END lines)
   ```

2. **Add secrets to GitHub:**
   - Go to https://github.com/EngineeredEverything/adultai/settings/secrets/actions
   - Click "New repository secret"
   - Add these 3 secrets:

   | Name | Value |
   |------|-------|
   | `VPS_HOST` | `145.79.1.40` |
   | `VPS_USER` | `root` |
   | `VPS_SSH_KEY` | Your SSH private key (entire file) |

### Step 2: Test Deployment

```bash
# Make a small change
git commit --allow-empty -m "test: trigger deployment"
git push origin main

# Watch deployment:
# https://github.com/EngineeredEverything/adultai/actions
```

That's it! Every push to `main` now auto-deploys.

---

## Deployment Process

When you push to `main`, GitHub Actions automatically:

1. ✅ Connects to your VPS via SSH
2. ✅ Pulls latest code from GitHub
3. ✅ Installs dependencies (`pnpm install`)
4. ✅ Builds the app (`pnpm build`)
5. ✅ Copies build to running container
6. ✅ Restarts Docker service (zero-downtime)

**No manual steps required!**

---

## Monitoring Deployments

**View deployment status:**
- https://github.com/EngineeredEverything/adultai/actions

**Check deployment logs:**
- Click on any workflow run
- See build output, errors, timing

**Rollback if needed:**
```bash
# Revert last commit
git revert HEAD
git push origin main
# Auto-deploys previous version
```

---

## Benefits vs Dokploy

✅ **Simpler** - No extra dashboard to manage  
✅ **Free** - GitHub Actions free tier (2000 min/month)  
✅ **Visible** - All builds in GitHub UI  
✅ **Fast** - Builds on GitHub's fast runners  
✅ **Flexible** - Easy to customize workflow  
✅ **Reliable** - GitHub's infrastructure  

---

## Deployment Workflow

### Normal Development
```bash
# 1. Make changes locally
git add .
git commit -m "feat: new feature"
git push origin main

# 2. GitHub Actions takes over
# - Runs workflow automatically
# - Shows green checkmark when done
# - Site is live in 3-5 minutes

# 3. Verify
curl https://adultai.com
```

### Emergency Rollback
```bash
# Option 1: Revert commit
git revert HEAD
git push origin main
# Auto-deploys previous version

# Option 2: Manual rollback on VPS
ssh root@145.79.1.40
cd /root/adultai-backup
git reset --hard HEAD~1  # Go back one commit
pnpm build
docker cp .next $(docker ps | grep website-adultai | awk '{print $NF}'):/app/
docker service update --force website-adultai-pbaavf
```

---

## Customizing Deployment

Edit `.github/workflows/deploy.yml` to:

- Add tests before deployment
- Deploy to staging first
- Send Slack/Discord notifications
- Run database migrations
- Clear CDN cache
- Anything you want!

Example - Add tests:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm test  # Add this
  
  deploy:
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    # ... existing deploy steps
```

---

## Troubleshooting

### Deployment Failed

**Check GitHub Actions logs:**
1. Go to https://github.com/EngineeredEverything/adultai/actions
2. Click the failed run
3. Read error messages

**Common issues:**

- **SSH connection failed** → Check VPS_SSH_KEY secret
- **Build failed** → Syntax error in code, check locally first
- **Container not found** → VPS container restarted, may have new ID
- **Permission denied** → SSH key doesn't match VPS

### Deployment Stuck

**Cancel and retry:**
1. GitHub Actions → Cancel workflow
2. Fix issue
3. Push again

**Manual deployment:**
```bash
ssh root@145.79.1.40
cd /root/adultai-backup
./deploy.sh  # Or run commands manually
```

---

## Adding Deploy Script (Optional)

Create a quick deploy script on VPS:

```bash
ssh root@145.79.1.40
cat > /root/adultai-backup/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Pulling latest..."
git pull origin main

echo "📦 Installing..."
pnpm install

echo "🏗️  Building..."
pnpm build

echo "📦 Deploying..."
CONTAINER=$(docker ps | grep "website-adultai-pbaavf" | grep "Running" | awk '{print $NF}' | head -1)
docker cp .next $CONTAINER:/app/

echo "♻️  Restarting..."
docker service update --force website-adultai-pbaavf

echo "✅ Done!"
EOF

chmod +x /root/adultai-backup/deploy.sh
```

Now you can manually deploy anytime:
```bash
ssh root@145.79.1.40 /root/adultai-backup/deploy.sh
```

---

## Next Steps

1. ✅ Add GitHub secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)
2. ✅ Push to main to test deployment
3. ✅ Watch GitHub Actions tab
4. ✅ Verify site is live
5. ✅ Delete Dokploy-related files if you want

**That's it! Simple, automated, no Dokploy needed.**
