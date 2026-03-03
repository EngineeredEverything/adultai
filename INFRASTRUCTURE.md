# AdultAI Infrastructure Overview

**Last Updated:** 2026-03-03

---

## Servers

| Server | IP | Provider | Role |
|--------|-----|----------|------|
| Main | 145.79.1.40 | Dedicated | Website, MongoDB, Docker Swarm, Auto-poster bot |
| GPU | 213.224.31.105 | vast.ai | Stable Diffusion API, Ollama LLM, Wav2Lip, Discord bot |

---

## Main Server (145.79.1.40)

### Services
- **Website** — Next.js 15, Docker Swarm service `adultai-web`, port 3000 (behind Traefik)
- **MongoDB** — Docker container `database-adultai-yp8zp9`, port 27017 (internal only)
- **Discord Auto-Poster** — Dokploy app `bot-python-t3domn`, posts images to Discord every 12-25 min
- **Bunny CDN** — Zone: `storage-adultai`, URL: `https://adultai-com.b-cdn.net`

### Website Deploy
```bash
ssh 145.79.1.40 "/root/deploy.sh"
# OR manually:
ssh 145.79.1.40 "cd /root/adultai-backup && NODE_ENV=production pnpm build && docker service update --force adultai-web"
```
**IMPORTANT:** Always build on the host (not inside the container). Source is bind-mounted.

### MongoDB Connection
```
mongodb://root:<pass>@database-adultai-yp8zp9:27017/adultai-production-v2?directConnection=true&authSource=admin
```
Password stored in `.env.production` on main server. Never committed to git.

### Key Paths
- Website source: `/root/adultai-backup/`
- Auto-poster bot: `/etc/dokploy/applications/bot-python-t3domn/code/`
- Deploy script: `/root/deploy.sh`
- Env file: `/root/adultai-backup/.env.production` (gitignored)

---

## GPU Server (213.224.31.105 — vast.ai)

### SSH Access
```bash
ssh -p 29579 root@213.224.31.105
```

### Services
- **URPM FastAPI** — Port 8080 (internal) / 29612 (external via vast.ai NAT)
  - Path: `/root/urpm/main.py`
  - Managed by: supervisor (`adultai-urpm` or manual)
  - Restart: `supervisorctl restart adultai-urpm` or `pkill -f urpm/main.py && cd /root/urpm && nohup python3 main.py &`
- **Ollama LLM** — Port 11434 (localhost only, bound to 127.0.0.1)
  - Model: `dolphin-llama3:8b` (uncensored)
  - Auto-unloads after 5min idle
- **Wav2Lip** — Path: `/root/Wav2Lip/`
- **Discord Bot** — Path: `/root/bot/main.py`
  - Managed by: supervisor (`adultai-discord-bot`)
  - Restart: `supervisorctl restart adultai-discord-bot`
  - Logs: `/root/bot/bot.log`

### GPU API Endpoints (base: `http://213.224.31.105:29612`)
| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/generate` | Stable Diffusion image generation |
| `POST /api/v1/img2img` | Image-to-image |
| `POST /api/v1/inpaint` | Inpainting |
| `POST /api/v1/upscale` | 2x/4x upscale (Real-ESRGAN/Lanczos) |
| `POST /api/v1/talking-avatar/generate` | Wav2Lip lip sync |
| `GET /api/v1/talking-avatar/status/{task_id}` | Poll lip sync task |
| `POST /api/v1/video/image-to-video` | SVD image-to-video |
| `GET /api/v1/video/fetch-video/{task_id}` | Poll video task |
| `POST /api/v1/video/to-gif` | ffmpeg video → GIF |
| `GET /temp/{filename}` | Static file serving |

### GPU API Auth
Header: `X-API-Key: <key>` — stored in `/root/urpm/.env` and `.env.production` on main server.

### SD Model
- Name: `uberRealisticPornMerge_v23Final`
- Format: diffusers (SD 1.5)
- Path: `/root/urpm/model/`

### GPU Specs
- RTX 3090 24GB VRAM
- 64GB RAM
- 491GB storage

---

## Discord Bots

### 1. Discord GPU Bot (`/root/bot/` on GPU server)
- **Bot:** AdultAi#3871
- **App ID:** 1056305598267936828
- **Slash commands:** `/aai`, `/animate`, `/speak`, `/help`, etc.
- **Supervisor service:** `adultai-discord-bot`
- **Source in this repo:** `bots/discord-gpu-bot/`

### 2. Discord Auto-Poster (`bot-python-t3domn` on main server)
- Posts AI-generated images to Discord every 12-25 min
- 30% chance: talking avatar video after image post
- 20% chance: animated SVD video after image post
- **Source in this repo:** `bots/discord-autoposter/`

---

## Integrations

| Service | Purpose | Key Location |
|---------|---------|--------------|
| Google OAuth | User auth (NextAuth) | Docker env on main server |
| ElevenLabs | TTS for companions & avatars | Docker env on main server |
| Bunny CDN | Image/video/audio hosting | Docker env on main server |
| Discord OAuth | User account linking | Docker env on main server |
| Ollama | Uncensored LLM for companion chat | localhost:11434 on GPU |

---

## Key Environment Variables (locations, never values)

All secrets are stored in `/root/adultai-backup/.env.production` on the main server.
GPU secrets are in `/root/urpm/.env` on the GPU server.
**Never commit these files.** `.env*` is in `.gitignore`.

---

## Deployment Flow

```
Developer → git push → GitHub (EngineeredEverything/adultai)
                ↓
         SSH to 145.79.1.40
                ↓
         /root/deploy.sh
         (pnpm build → docker service update)
                ↓
         adultai-web Docker service (bind mount /root/adultai-backup)
```

Note: Dokploy auto-deploy does NOT work — always use `/root/deploy.sh`.

---

## Bots Directory (this repo)

```
bots/
├── discord-gpu-bot/       # Slash command bot running on GPU server
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── cogs/
│   │   └── aai.py         # Main command cog
│   └── utils/
│       └── bot.py
└── discord-autoposter/    # Auto-posting bot running on main server
    ├── api.py             # Main posting loop
    ├── main.py
    ├── prompt.py          # Prompt templates
    └── requirements.txt
```
