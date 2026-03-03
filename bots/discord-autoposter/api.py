import requests
import time
import os
import json
import base64
import random
from datetime import datetime

DOMAIN = os.environ.get("API_DOMAIN", "https://adultai.com")
API_TOKEN = os.environ.get("BOT_API_TOKEN", "fasjhgfauiygjfahg")

# Support multiple webhook URLs (comma-separated) for posting to multiple channels
_webhooks_raw = os.environ.get("DISCORD_WEBHOOK_URL", "")
DISCORD_WEBHOOK_URLS = [u.strip() for u in _webhooks_raw.split(",") if u.strip()]

# Optional: separate log channel webhook (status/errors only, no images)
DISCORD_LOG_WEBHOOK = os.environ.get("DISCORD_LOG_WEBHOOK", "")

API_URL = f"{DOMAIN}/api/bot/generate"
WEBHOOK_URL = f"{DOMAIN}/api/webhooks/image-generation"

# GPU API config
GPU_API_URL = "http://213.224.31.105:29612"
GPU_API_KEY = os.environ.get("GPU_API_KEY", "")

# ElevenLabs config
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel — warm and natural

# Bunny CDN config
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_STORAGE_ZONE = "storage-adultai"
BUNNY_STORAGE_HOST = "la.storage.bunnycdn.com"
BUNNY_CDN_URL = "https://adultai-com.b-cdn.net"

POLL_INTERVAL = 15   # seconds between polls
MAX_RETRIES = 30     # 7.5 min max

# Teaser phrases companions say in automated posts
COMPANION_PHRASES = [
    "Hey... I was just thinking about you.",
    "I missed you. Where have you been?",
    "Come find me at AdultAI.com... I'll be waiting.",
    "I have something special to show you tonight.",
    "You're the only one I want to talk to right now.",
    "I've been lonely. Can you keep me company?",
    "I made this just for you. Don't keep me waiting.",
    "Thinking about you keeps me up at night.",
    "I need to tell you something... come closer.",
    "Nobody else makes me feel like this.",
]


# ── Bunny CDN helpers ──────────────────────────────────────────────────────────

def upload_to_bunny(data: bytes, path: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to Bunny CDN storage. Returns CDN URL."""
    url = f"https://{BUNNY_STORAGE_HOST}/{BUNNY_STORAGE_ZONE}/{path}"
    r = requests.put(url, data=data, headers={"AccessKey": BUNNY_API_KEY, "Content-Type": content_type}, timeout=60)
    r.raise_for_status()
    return f"{BUNNY_CDN_URL}/{path}"


def upload_audio_to_bunny(audio_bytes: bytes) -> str:
    uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
    return upload_to_bunny(audio_bytes, f"audio/bot_{uid}.mp3", "audio/mpeg")


def upload_video_to_bunny(video_bytes: bytes) -> str:
    uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
    return upload_to_bunny(video_bytes, f"video/bot_{uid}.mp4", "video/mp4")


def fix_gpu_url(url: str) -> str:
    """Replace localhost/127.0.0.1 references with GPU server public IP."""
    for local in ["http://localhost", "http://127.0.0.1"]:
        if url.startswith(local):
            port_path = url[len(local):]
            return f"http://213.224.31.105{port_path}"
    return url


# ── GPU API helpers ────────────────────────────────────────────────────────────

def make_companion_speak(portrait_url: str, text: str, voice_id: str = DEFAULT_VOICE_ID) -> str | None:
    """
    Generate a lip-synced talking avatar video.
    Returns a Bunny CDN URL for the video, or None on failure.
    """
    try:
        # Step 1: ElevenLabs TTS
        print(f"[SPEAK] Calling ElevenLabs TTS for '{text[:40]}...'")
        tts_res = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            json={"text": text, "model_id": "eleven_turbo_v2", "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.2}},
            headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
            timeout=30,
        )
        if not tts_res.ok:
            print(f"[SPEAK] TTS failed: {tts_res.status_code} {tts_res.text[:200]}")
            return None
        audio_bytes = tts_res.content

        # Step 2: Upload audio to Bunny CDN
        audio_url = upload_audio_to_bunny(audio_bytes)
        print(f"[SPEAK] Audio uploaded: {audio_url}")

        # Step 3: Wav2Lip talking avatar
        avatar_res = requests.post(
            f"{GPU_API_URL}/api/v1/talking-avatar/generate",
            json={"portrait_url": portrait_url, "audio_url": audio_url, "fps": 25, "static": True},
            headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
            timeout=120,
        )
        if not avatar_res.ok:
            print(f"[SPEAK] Avatar API failed: {avatar_res.status_code}")
            return None
        avatar_data = avatar_res.json()

        # Handle async (task_id) or sync (video_url) response
        video_url = avatar_data.get("video_url")
        task_id = avatar_data.get("task_id")

        if task_id and not video_url:
            print(f"[SPEAK] Polling avatar task {task_id}...")
            for _ in range(12):  # up to 60s
                time.sleep(5)
                poll = requests.get(f"{GPU_API_URL}/api/v1/talking-avatar/status/{task_id}", headers={"X-API-Key": GPU_API_KEY}, timeout=15)
                if poll.ok:
                    pd = poll.json()
                    if pd.get("status") == "completed":
                        video_url = pd.get("video_url")
                        break
                    if pd.get("status") == "failed":
                        print(f"[SPEAK] Avatar task failed")
                        return None

        if not video_url:
            print("[SPEAK] No video URL returned")
            return None

        video_url = fix_gpu_url(video_url)
        print(f"[SPEAK] Downloading video from {video_url}")
        video_res = requests.get(video_url, timeout=60)
        if not video_res.ok:
            print(f"[SPEAK] Video download failed: {video_res.status_code}")
            return None

        cdn_url = upload_video_to_bunny(video_res.content)
        print(f"[SPEAK] Video uploaded to CDN: {cdn_url}")
        return cdn_url

    except Exception as e:
        print(f"[SPEAK ERROR] {e}")
        return None


def animate_image_to_video(image_url: str) -> str | None:
    """
    Generate a short animated video clip from a still image.
    Returns a Bunny CDN URL for the video, or None on failure.
    """
    try:
        # Download source image
        print(f"[ANIMATE] Downloading image from {image_url}")
        img_res = requests.get(image_url, timeout=20)
        if not img_res.ok:
            print(f"[ANIMATE] Image download failed: {img_res.status_code}")
            return None
        b64 = base64.b64encode(img_res.content).decode()

        # Submit to GPU API
        print("[ANIMATE] Submitting to GPU image-to-video API...")
        gpu_res = requests.post(
            f"{GPU_API_URL}/api/v1/video/image-to-video",
            json={"image": b64, "num_frames": 25, "fps": 8, "motion_bucket_id": 100, "noise_aug_strength": 0},
            headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
            timeout=30,
        )
        if not gpu_res.ok:
            print(f"[ANIMATE] GPU API failed: {gpu_res.status_code}")
            return None
        data = gpu_res.json()

        video_url = data.get("video_url")
        task_id = data.get("task_id")

        if task_id and not video_url:
            print(f"[ANIMATE] Polling video task {task_id}...")
            for _ in range(24):  # up to 2 min
                time.sleep(5)
                poll = requests.get(f"{GPU_API_URL}/api/v1/video/fetch-video/{task_id}", headers={"X-API-Key": GPU_API_KEY}, timeout=15)
                if poll.ok:
                    pd = poll.json()
                    if pd.get("status") == "completed" and pd.get("video_url"):
                        video_url = pd["video_url"]
                        break
                    if pd.get("status") == "failed":
                        print("[ANIMATE] Video task failed")
                        return None

        if not video_url:
            print("[ANIMATE] No video URL returned")
            return None

        video_url = fix_gpu_url(video_url)
        print(f"[ANIMATE] Downloading video from {video_url}")
        video_res = requests.get(video_url, timeout=60)
        if not video_res.ok:
            print(f"[ANIMATE] Video download failed: {video_res.status_code}")
            return None

        cdn_url = upload_video_to_bunny(video_res.content)
        print(f"[ANIMATE] Video uploaded to CDN: {cdn_url}")
        return cdn_url

    except Exception as e:
        print(f"[ANIMATE ERROR] {e}")
        return None


# ── Discord helpers ────────────────────────────────────────────────────────────

def _post_to_webhooks(payload: dict = None, files: dict = None, form_data: dict = None, log_only: bool = False):
    """Post to all configured Discord webhooks."""
    targets = DISCORD_LOG_WEBHOOK.split(",") if log_only and DISCORD_LOG_WEBHOOK else DISCORD_WEBHOOK_URLS
    for url in [u.strip() for u in targets if u.strip()]:
        try:
            if files:
                r = requests.post(url, data=form_data or {}, files=files, timeout=30)
            else:
                r = requests.post(url, json=payload, timeout=10)
            r.raise_for_status()
        except Exception as e:
            print(f"[Discord ERROR] {e}")


def post_image_gallery(image_urls: list, prompt: str, model: str, processing_time: int, seed: str = None):
    """
    Post generated images directly into Discord as visual embeds.
    Discord supports up to 10 embeds per message — we'll use one per image.
    Returns the list of valid image URLs for potential follow-up actions.
    """
    if not image_urls:
        return []

    valid_urls = [u for u in image_urls if u and u.startswith("http")]
    if not valid_urls:
        return []

    # Build embeds — first one has title/description, rest are just images
    embeds = []
    for i, url in enumerate(valid_urls[:4]):
        embed = {
            "color": 0x9b59b6,  # purple
            "image": {"url": url},
        }
        if i == 0:
            short_prompt = prompt[:120] + "..." if len(prompt) > 120 else prompt
            embed["title"] = "✨ New AI Image Generated"
            embed["description"] = f"```{short_prompt}```"
            embed["footer"] = {
                "text": f"Model: {model}  ·  {processing_time}s  ·  AdultAI.com"
                + (f"  ·  Seed: {seed}" if seed else "")
            }
            embed["timestamp"] = datetime.utcnow().isoformat()
        embeds.append(embed)

    # Discord allows max 10 embeds per message
    _post_to_webhooks({"embeds": embeds})
    print(f"[Discord] Posted {len(embeds)} image(s) to Discord.")
    return valid_urls


def post_speaking_video_to_discord(video_cdn_url: str, portrait_cdn_url: str, phrase: str):
    """Post a talking avatar video to Discord."""
    try:
        print(f"[Discord] Downloading speaking video for post...")
        video_res = requests.get(video_cdn_url, timeout=60)
        if not video_res.ok:
            raise Exception(f"Download failed: {video_res.status_code}")

        video_bytes = video_res.content
        size_mb = len(video_bytes) / (1024 * 1024)
        print(f"[Discord] Video size: {size_mb:.1f}MB")

        if size_mb <= 24:
            files = {"file": ("companion_speak.mp4", video_bytes, "video/mp4")}
            form_data = {"content": f'🎙️ *"{phrase}"*\n\nCreate your own AI companion → **AdultAI.com** ✨'}
            _post_to_webhooks(files=files, form_data=form_data)
            print("[Discord] Posted speaking video as file attachment.")
        else:
            # Fallback: post portrait image embed with the phrase
            embed = {
                "title": "🎙️ Your AI Companion is Waiting",
                "description": f'*"{phrase}"*\n\n[**Create your own at AdultAI.com →**](https://adultai.com)',
                "color": 0xe91e8c,
                "image": {"url": portrait_cdn_url},
                "timestamp": datetime.utcnow().isoformat(),
            }
            _post_to_webhooks({"embeds": [embed]})
            print("[Discord] Posted speaking video fallback embed (video too large).")

    except Exception as e:
        print(f"[SPEAK POST ERROR] {e}")
        # Minimal fallback
        try:
            embed = {
                "title": "🎙️ Your AI Companion is Waiting",
                "description": f'*"{phrase}"*\n\n[**Create your own at AdultAI.com →**](https://adultai.com)',
                "color": 0xe91e8c,
                "image": {"url": portrait_cdn_url},
            }
            _post_to_webhooks({"embeds": [embed]})
        except Exception:
            pass


def post_animated_video_to_discord(video_cdn_url: str, prompt: str, model: str, elapsed: int):
    """Post an animated video clip to Discord."""
    try:
        print(f"[Discord] Downloading animation for post...")
        video_res = requests.get(video_cdn_url, timeout=60)
        if not video_res.ok:
            raise Exception(f"Download failed: {video_res.status_code}")

        video_bytes = video_res.content
        size_mb = len(video_bytes) / (1024 * 1024)
        short_prompt = prompt[:100] + "..." if len(prompt) > 100 else prompt

        if size_mb <= 24:
            files = {"file": ("animation.mp4", video_bytes, "video/mp4")}
            form_data = {
                "content": f"🎬 **AI Animation** — AdultAI.com\n```{short_prompt}```"
            }
            _post_to_webhooks(files=files, form_data=form_data)
            print("[Discord] Posted animation as file attachment.")
        else:
            print(f"[Discord] Animation too large ({size_mb:.1f}MB), skipping.")

    except Exception as e:
        print(f"[ANIMATE POST ERROR] {e}")


def post_log(title: str, description: str, color: int = 0x95a5a6, fields: list = None):
    """Post a quiet log/status message (errors, queue updates)."""
    embed = {
        "title": title,
        "description": description,
        "color": color,
        "timestamp": datetime.utcnow().isoformat(),
        "footer": {"text": "AdultAI Bot"},
    }
    if fields:
        embed["fields"] = fields

    # Only send to log channel if configured, else skip noisy status messages
    if DISCORD_LOG_WEBHOOK:
        _post_to_webhooks({"embeds": [embed]}, log_only=True)
    else:
        print(f"[LOG] {title}: {description}")


# ── API calls ──────────────────────────────────────────────────────────────────

def callApi(task: dict):
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }

    print(f"[API] Starting generation — model={task.get('modelId')} prompt={task.get('prompt','')[:60]}...")

    try:
        response = requests.post(API_URL, json=task, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()

        if not result.get("success") or not result.get("taskId"):
            err = result.get("error", "Unknown error")
            print(f"[API] Task submission failed: {err}")
            post_log("❌ Generation Failed", f"Could not submit task: `{err}`", color=0xe74c3c)
            return

        task_id = result["taskId"]
        print(f"[API] Task queued: {task_id}")

        # Poll for completion
        start = time.time()
        image_urls = []

        for attempt in range(MAX_RETRIES):
            print(f"[Poll] Attempt {attempt + 1}/{MAX_RETRIES} for {task_id}")
            data = poll_webhook(task_id, headers, task.get("email"), task.get("password"))

            if data:
                status = data.get("status")

                if status == "success":
                    images = data.get("images", [])
                    elapsed = int(time.time() - start)
                    image_urls = [
                        img.get("imageUrl") or img.get("imageLink")
                        for img in images
                        if img.get("imageUrl") or img.get("imageLink")
                    ]
                    print(f"[API] Done! {len(image_urls)} images in {elapsed}s")

                    # Post images directly to Discord (the main event)
                    valid_urls = post_image_gallery(
                        image_urls=image_urls,
                        prompt=task.get("prompt", ""),
                        model=task.get("modelId", "AI"),
                        processing_time=elapsed,
                        seed=task.get("seed"),
                    )

                    # ── Bonus content: speaking avatar or animation ──
                    if valid_urls:
                        roll = random.random()
                        portrait_url = valid_urls[0]

                        if roll < 0.30:
                            # 30% chance: companion speaks
                            phrase = random.choice(COMPANION_PHRASES)
                            print(f"[BONUS] Generating speaking avatar: '{phrase}'")
                            video_url = make_companion_speak(portrait_url, phrase)
                            if video_url:
                                post_speaking_video_to_discord(video_url, portrait_url, phrase)
                            else:
                                print("[BONUS] Speaking avatar failed, skipping.")

                        elif roll < 0.50:
                            # 20% chance (30-50 range): animate the image
                            print("[BONUS] Generating image animation...")
                            video_url = animate_image_to_video(portrait_url)
                            if video_url:
                                post_animated_video_to_discord(
                                    video_url,
                                    task.get("prompt", ""),
                                    task.get("modelId", "AI"),
                                    elapsed,
                                )
                            else:
                                print("[BONUS] Animation failed, skipping.")

                    return

                elif status == "failed":
                    err = data.get("error", "Unknown")
                    print(f"[API] Generation failed: {err}")
                    post_log("💥 Generation Failed", f"`{err}`", color=0xe74c3c)
                    return

                # Still processing — just print, no Discord spam
                progress = data.get("progress", 0)
                print(f"[Poll] Still processing... {progress}%")

            time.sleep(POLL_INTERVAL)

        # Timeout
        elapsed = int(time.time() - start)
        post_log("⏰ Timeout", f"Task `{task_id}` did not complete after {elapsed}s", color=0xe67e22)

    except requests.exceptions.RequestException as e:
        print(f"[API ERROR] {e}")
        post_log("🌐 Network Error", str(e)[:300], color=0xe74c3c)
    except Exception as e:
        print(f"[API ERROR] Unexpected: {e}")
        post_log("⚠️ Unexpected Error", str(e)[:300], color=0xe74c3c)


def poll_webhook(task_id: str, headers: dict, email: str, password: str) -> dict:
    try:
        h = {
            "Authorization": f"Bearer {API_TOKEN}",
            "x-email": email or "",
            "x-password": password or "",
            "Content-Type": "application/json",
        }
        r = requests.get(f"{WEBHOOK_URL}?taskId={task_id}", headers=h, timeout=20)
        r.raise_for_status()
        data = r.json()

        if data.get("error"):
            return {"status": "failed", "error": data["error"]}

        status = data.get("status", "")
        if status in ("completed", "success"):
            return {"status": "success", "images": data.get("images", []), "progress": 100}
        elif status in ("failed", "error"):
            return {"status": "failed", "error": data.get("message", "Failed")}
        elif status in ("processing", "pending"):
            return {"status": "processing", "progress": data.get("progress", 0), "eta": data.get("eta")}
        elif data.get("images"):
            return {"status": "success", "images": data["images"], "progress": 100}

        return {"status": "processing", "progress": data.get("progress", 0)}

    except Exception as e:
        print(f"[Poll ERROR] {e}")
        return None
