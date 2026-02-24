import os
import discord
from discord import app_commands
from discord.ext import commands
import aiohttp
import asyncio
from PIL import Image
import io
import base64
import time
import random

# --- Config ---
GPU_API_URL = "http://localhost:8080"
GPU_API_KEY = os.environ.get("GPU_API_KEY", "")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_STORAGE_ZONE = "storage-adultai"
BUNNY_STORAGE_HOST = "la.storage.bunnycdn.com"
BUNNY_CDN_URL = "https://adultai-com.b-cdn.net"

WATERMARK_IMAGE = Image.open("watermark.png").convert("RGBA")

# --- Helpers ---

async def upload_to_bunny(session: aiohttp.ClientSession, data: bytes, path: str, content_type: str = "application/octet-stream") -> str:
    url = f"https://{BUNNY_STORAGE_HOST}/{BUNNY_STORAGE_ZONE}/{path}"
    async with session.put(url, data=data, headers={"AccessKey": BUNNY_API_KEY, "Content-Type": content_type}) as r:
        r.raise_for_status()
    return f"{BUNNY_CDN_URL}/{path}"


async def upload_audio_to_bunny(session: aiohttp.ClientSession, audio_bytes: bytes) -> str:
    uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
    return await upload_to_bunny(session, audio_bytes, f"audio/bot_{uid}.mp3", "audio/mpeg")


async def upload_video_to_bunny(session: aiohttp.ClientSession, video_bytes: bytes) -> str:
    uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
    return await upload_to_bunny(session, video_bytes, f"video/bot_{uid}.mp4", "video/mp4")


async def tts_to_audio(session: aiohttp.ClientSession, text: str, voice_id: str = DEFAULT_VOICE_ID) -> bytes | None:
    """Generate audio from text using ElevenLabs."""
    async with session.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        json={"text": text, "model_id": "eleven_turbo_v2", "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.2}},
        headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
    ) as r:
        if not r.ok:
            print(f"[TTS] ElevenLabs error: {r.status}")
            return None
        return await r.read()


async def generate_talking_avatar(session: aiohttp.ClientSession, portrait_url: str, audio_url: str) -> str | None:
    """Generate a lip-synced talking avatar video. Returns CDN URL or None."""
    async with session.post(
        f"{GPU_API_URL}/api/v1/talking-avatar/generate",
        json={"portrait_url": portrait_url, "audio_url": audio_url, "fps": 25, "static": True},
        headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=120),
    ) as r:
        if not r.ok:
            print(f"[AVATAR] GPU error: {r.status}")
            return None
        data = await r.json()

    video_url = data.get("video_url")
    task_id = data.get("task_id")

    if task_id and not video_url:
        for _ in range(12):
            await asyncio.sleep(5)
            async with session.get(f"{GPU_API_URL}/api/v1/talking-avatar/status/{task_id}", headers={"X-API-Key": GPU_API_KEY}) as poll:
                if poll.ok:
                    pd = await poll.json()
                    if pd.get("status") == "completed":
                        video_url = pd.get("video_url")
                        break
                    if pd.get("status") == "failed":
                        return None

    if not video_url:
        return None

    # Fix localhost URL (on GPU server, localhost = GPU server itself)
    video_url = video_url.replace("http://localhost", f"http://localhost")  # already on GPU

    # Download and re-upload to Bunny CDN for permanent hosting
    async with session.get(video_url) as vr:
        if not vr.ok:
            return None
        video_bytes = await vr.read()

    return await upload_video_to_bunny(session, video_bytes)


async def generate_animation(session: aiohttp.ClientSession, image_url: str) -> str | None:
    """Animate a still image into a short video. Returns CDN URL or None."""
    async with session.get(image_url) as r:
        if not r.ok:
            return None
        img_bytes = await r.read()
    b64 = base64.b64encode(img_bytes).decode()

    async with session.post(
        f"{GPU_API_URL}/api/v1/video/image-to-video",
        json={"image": b64, "num_frames": 25, "fps": 8, "motion_bucket_id": 100, "noise_aug_strength": 0},
        headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
        timeout=aiohttp.ClientTimeout(total=30),
    ) as r:
        if not r.ok:
            print(f"[ANIMATE] GPU error: {r.status}")
            return None
        data = await r.json()

    video_url = data.get("video_url")
    task_id = data.get("task_id")

    if task_id and not video_url:
        for _ in range(24):
            await asyncio.sleep(5)
            async with session.get(f"{GPU_API_URL}/api/v1/video/fetch-video/{task_id}", headers={"X-API-Key": GPU_API_KEY}) as poll:
                if poll.ok:
                    pd = await poll.json()
                    if pd.get("status") == "completed" and pd.get("video_url"):
                        video_url = pd["video_url"]
                        break
                    if pd.get("status") == "failed":
                        return None

    if not video_url:
        return None

    async with session.get(video_url) as vr:
        if not vr.ok:
            return None
        video_bytes = await vr.read()

    return await upload_video_to_bunny(session, video_bytes)


def apply_watermark(image_bytes):
    """Applies a watermark to the bottom-right of an image."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    watermark = WATERMARK_IMAGE.copy()
    # Resize watermark if larger than image
    if watermark.width > img.width or watermark.height > img.height:
        watermark = watermark.resize((min(watermark.width, img.width), min(watermark.height, img.height)), Image.LANCZOS)
    # Position at bottom-right
    x = img.width - watermark.width
    y = img.height - watermark.height
    img.paste(watermark, (x, y), watermark)
    buffer = io.BytesIO()
    img.convert("RGB").save(buffer, "PNG")
    buffer.seek(0)
    return buffer.getvalue()


IMAGE_API_URL = f"{GPU_API_URL}/api/v1/generate"

# Quality suffix for all prompts
QUALITY_SUFFIX = (
    ", masterpiece, best quality, ultra-detailed, sharp focus, "
    "professional photography, 8k uhd, photorealistic"
)
NEGATIVE_PROMPT = (
    "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, "
    "poorly drawn face, blurry, watermark, text, logo, signature, "
    "out of frame, lowres, worst quality, low quality, child, minor, underage"
)


async def generate_image_collage(prompt, gen_opts=None, count=4):
    # Use portrait dimensions, add quality boosters
    full_prompt = prompt + QUALITY_SUFFIX
    async with aiohttp.ClientSession() as session:
        tasks = [asyncio.ensure_future(fetch_image(session, full_prompt, gen_opts)) for _ in range(count)]
        image_bytes_list = await asyncio.gather(*tasks)
        watermarked_images = [apply_watermark(img) for img in image_bytes_list if img]
        return watermarked_images


async def fetch_image(session, prompt, gen_opts=None):
    opts = gen_opts or {}
    data = {
        "prompt": prompt,
        "negative_prompt": opts.get("negative_prompt", NEGATIVE_PROMPT),
        "num_inference_steps": opts.get("steps", 42),
        "guidance_scale": opts.get("cfg", 6.8),
        "width": opts.get("width", 512),
        "height": opts.get("height", 768),
        "hires_fix": opts.get("hires_fix", True),
        "hires_scale": opts.get("hires_scale", 1.75),
        "hires_denoise": opts.get("hires_denoise", 0.4),
        "hires_steps": opts.get("hires_steps", 28),
        "face_restore": opts.get("face_restore", True),
        "face_restore_strength": opts.get("face_restore_strength", 0.2),
    }
    if "seed" in opts and opts["seed"] is not None:
        data["seed"] = opts["seed"]
    if "sampler" in opts and opts["sampler"]:
        data["sampler"] = opts["sampler"]
    try:
        async with session.post(
            IMAGE_API_URL,
            json=data,
            headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=120),
        ) as resp:
            if resp.status == 200:
                response_json = await resp.json()
                image_base64 = response_json.get("image", "")
                if not image_base64:
                    print(f"[IMG] No image in response: {list(response_json.keys())}")
                    return None
                image_data = base64.b64decode(image_base64)
                return image_data
            else:
                print(f"[IMG] API error: {resp.status}")
    except asyncio.TimeoutError:
        print("[IMG] Timeout generating image")
    except Exception as e:
        print(f"[IMG] Error: {e}")
    return None


def create_collage(image_bytes_list):
    images = [Image.open(io.BytesIO(img)) for img in image_bytes_list]
    if not images or len(images) < 4:
        return None
    widths, heights = zip(*(i.size for i in images))
    grid_img = Image.new("RGB", (widths[0] + widths[1], heights[0] + heights[2]))
    grid_img.paste(images[0], (0, 0))
    grid_img.paste(images[1], (widths[0], 0))
    grid_img.paste(images[2], (0, heights[0]))
    grid_img.paste(images[3], (widths[0], heights[0]))
    buffer = io.BytesIO()
    grid_img.save(buffer, "PNG")
    buffer.seek(0)
    return buffer


# --- Modals ---

class SpeakModal(discord.ui.Modal, title="Make it Speak"):
    text = discord.ui.TextInput(
        label="What should she say?",
        placeholder='e.g. "Hey... I was just thinking about you."',
        style=discord.TextStyle.paragraph,
        max_length=400,
        required=True,
    )

    def __init__(self, image_url: str, image_bytes: bytes | None = None):
        super().__init__()
        self.image_url = image_url
        self.image_bytes = image_bytes

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        phrase = str(self.text)

        await interaction.followup.send(f"🎙️ Generating voice + lip sync for: *\"{phrase[:60]}...\"* — this takes ~30s...", ephemeral=True)

        async with aiohttp.ClientSession() as session:
            # Upload image to Bunny CDN if we have bytes (for a stable URL)
            portrait_url = self.image_url
            if self.image_bytes:
                try:
                    portrait_url = await upload_video_to_bunny(session, self.image_bytes)
                    portrait_url = portrait_url.replace(".mp4", ".png")
                    portrait_url = await upload_to_bunny(session, self.image_bytes, f"img/speak_{int(time.time())}.png", "image/png")
                except Exception:
                    pass  # use original URL

            # TTS
            audio_bytes = await tts_to_audio(session, phrase)
            if not audio_bytes:
                await interaction.followup.send("❌ Voice generation failed. Please try again.", ephemeral=True)
                return

            audio_url = await upload_audio_to_bunny(session, audio_bytes)
            video_cdn_url = await generate_talking_avatar(session, portrait_url, audio_url)

        if not video_cdn_url:
            # Fallback: post audio only
            audio_file = discord.File(io.BytesIO(audio_bytes), filename="voice.mp3")
            await interaction.followup.send(f"🔊 Voice only (lip sync unavailable for this image):\n*\"{phrase}\"*", file=audio_file)
            return

        # Download and send video
        async with aiohttp.ClientSession() as session:
            async with session.get(video_cdn_url) as vr:
                video_bytes = await vr.read()

        if len(video_bytes) <= 24 * 1024 * 1024:
            vid_file = discord.File(io.BytesIO(video_bytes), filename="speaking.mp4")
            await interaction.followup.send(f"🎙️ *\"{phrase}\"*\n\nCreate your own companion → **AdultAI.com** ✨", file=vid_file)
        else:
            await interaction.followup.send(f"🎙️ *\"{phrase}\"*\n\nVideo: {video_cdn_url}\n\nCreate your own → **AdultAI.com** ✨")


# --- Button Views ---

class AnimateButton(discord.ui.Button):
    def __init__(self, image_bytes: bytes, image_url: str = None):
        super().__init__(label="🎬 Animate", style=discord.ButtonStyle.primary)
        self.image_bytes = image_bytes
        self.image_url = image_url

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        await interaction.followup.send("🎬 Animating image... (~60s)", ephemeral=True)

        async with aiohttp.ClientSession() as session:
            # Upload the image to Bunny for a stable URL
            uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
            portrait_url = await upload_to_bunny(session, self.image_bytes, f"img/animate_{uid}.png", "image/png")
            video_cdn_url = await generate_animation(session, portrait_url)

        if not video_cdn_url:
            await interaction.followup.send("❌ Animation failed — GPU may be busy. Try again in a moment.", ephemeral=True)
            return

        async with aiohttp.ClientSession() as session:
            async with session.get(video_cdn_url) as vr:
                video_bytes = await vr.read()

        if len(video_bytes) <= 24 * 1024 * 1024:
            vid_file = discord.File(io.BytesIO(video_bytes), filename="animation.mp4")
            await interaction.followup.send("🎬 **Animated!** Generate more at **AdultAI.com** ✨", file=vid_file)
        else:
            await interaction.followup.send(f"🎬 Animation ready: {video_cdn_url}")


class SpeakButton(discord.ui.Button):
    def __init__(self, image_bytes: bytes, image_url: str = None):
        super().__init__(label="🗣️ Speak", style=discord.ButtonStyle.secondary)
        self.image_bytes = image_bytes
        self.image_url = image_url

    async def callback(self, interaction: discord.Interaction):
        modal = SpeakModal(image_url=self.image_url or "", image_bytes=self.image_bytes)
        await interaction.response.send_modal(modal)



class FaceFixButton(discord.ui.Button):
    def __init__(self, image_bytes: bytes, image_url: str = None):
        super().__init__(style=discord.ButtonStyle.secondary, label="💆 Face Fix", row=1)
        self.image_bytes = image_bytes
        self.image_url = image_url

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        try:
            async with aiohttp.ClientSession() as session:
                # Upload to Bunny for a public URL if needed
                if not self.image_url:
                    uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
                    self.image_url = await upload_to_bunny(session, self.image_bytes, f"img/facefix_{uid}.png", "image/png")

                # Call face-restore API
                async with session.post(
                    f"{GPU_API_URL}/api/v1/face-restore",
                    json={"image_url": self.image_url, "strength": 0.4},
                    headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as r:
                    if not r.ok:
                        await interaction.followup.send("❌ Face fix failed. Try again.", ephemeral=True)
                        return
                    data = await r.json()

                result_url = data.get("image_url")
                if not result_url:
                    await interaction.followup.send("❌ No result returned.", ephemeral=True)
                    return

                async with session.get(result_url) as vr:
                    fixed_bytes = await vr.read()

            file = discord.File(io.BytesIO(fixed_bytes), filename="face_fixed.png")
            await interaction.followup.send("💆 **Face fixed!** More tools at **AdultAI.com**", file=file)
        except Exception as e:
            print(f"[FACEFIX BUTTON ERROR] {e}")
            await interaction.followup.send("❌ Face fix failed.", ephemeral=True)



class UpscaleButton(discord.ui.Button):
    def __init__(self, image_bytes: bytes, scale: int = 2):
        label = f"\u2b06\ufe0f Upscale {scale}x"
        super().__init__(label=label, style=discord.ButtonStyle.secondary, row=1)
        self.image_bytes = image_bytes
        self.scale = scale

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        await interaction.followup.send(f"\u2b06\ufe0f Upscaling {self.scale}x... (~15s)", ephemeral=True)
        try:
            import base64 as b64mod
            b64_img = b64mod.b64encode(self.image_bytes).decode()
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{GPU_API_URL}/api/v1/upscale",
                    json={"image": b64_img, "scale": self.scale},
                    headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as r:
                    if r.ok:
                        data = await r.json()
                        if "image" in data:
                            result_bytes = b64mod.b64decode(data["image"])
                            file = discord.File(io.BytesIO(result_bytes), filename=f"upscaled_{self.scale}x.png")
                            await interaction.followup.send(
                                f"\u2b06\ufe0f **Upscaled {self.scale}x!** More at **AdultAI.com** \u2728",
                                file=file,
                            )
                            return
                    err_text = await r.text()
                    print(f"[UPSCALE] API error {r.status}: {err_text[:200]}")
            await interaction.followup.send("\u274c Upscale failed \u2014 GPU may be busy.", ephemeral=True)
        except Exception as e:
            print(f"[UPSCALE ERROR] {e}")
            await interaction.followup.send("\u274c Upscale failed.", ephemeral=True)


class FullImageView(discord.ui.View):
    """View shown when a single image is expanded with action buttons."""
    def __init__(self, image_bytes: bytes, prompt: str):
        super().__init__(timeout=None)  # Never timeout — keep buttons always active
        self.image_bytes = image_bytes
        self.prompt = prompt
        # Row 0: primary actions
        self.add_item(AnimateButton(image_bytes))
        self.add_item(SpeakButton(image_bytes))
        self.add_item(EditButton(image_bytes, prompt))
        self.add_item(DeleteButton())
        # Row 1: enhance actions
        self.add_item(UpscaleButton(image_bytes, scale=2))
        self.add_item(UpscaleButton(image_bytes, scale=4))
        self.add_item(FaceFixButton(image_bytes))


class EditButton(discord.ui.Button):
    def __init__(self, image_bytes: bytes, prompt: str):
        super().__init__(label="✏️ Edit", style=discord.ButtonStyle.secondary)
        self.image_bytes = image_bytes
        self.prompt = prompt

    async def callback(self, interaction: discord.Interaction):
        modal = EditModal(image_bytes=self.image_bytes, original_prompt=self.prompt)
        await interaction.response.send_modal(modal)


class EditModal(discord.ui.Modal, title="Edit / Remix Image"):
    new_prompt = discord.ui.TextInput(
        label="New prompt (edit the original)",
        style=discord.TextStyle.paragraph,
        placeholder="Describe the changes you want...",
        required=True,
        max_length=500,
    )
    strength = discord.ui.TextInput(
        label="Edit strength (0.3=subtle, 0.7=major)",
        style=discord.TextStyle.short,
        default="0.5",
        required=False,
        max_length=5,
    )

    def __init__(self, image_bytes: bytes, original_prompt: str):
        super().__init__()
        self.image_bytes = image_bytes
        self.new_prompt.default = original_prompt

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        try:
            strength_val = float(self.strength.value or "0.5")
            strength_val = max(0.1, min(0.9, strength_val))
        except ValueError:
            strength_val = 0.5

        await interaction.followup.send(f"✏️ Editing image with strength {strength_val}... (~30s)", ephemeral=True)

        async with aiohttp.ClientSession() as session:
            uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
            # Upload source image
            src_url = await upload_to_bunny(session, self.image_bytes, f"img/edit_src_{uid}.png", "image/png")

            # Call img2img endpoint
            try:
                async with session.post(
                    f"{GPU_API_URL}/api/v1/img2img",
                    json={
                        "prompt": self.new_prompt.value,
                        "image_url": src_url,
                        "strength": strength_val,
                        "steps": 30,
                    },
                    headers={"X-API-Key": GPU_API_KEY},
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if "image" in data:
                            import base64
                            img_bytes = base64.b64decode(data["image"])
                            file = discord.File(io.BytesIO(img_bytes), filename="edited.png")
                            view = FullImageView(img_bytes, self.new_prompt.value)
                            msg = await interaction.followup.send(
                                f"✏️ **Edited!** Prompt: `{self.new_prompt.value}`",
                                file=file,
                                view=view,
                            )
                            view.message = msg
                            return
            except Exception as e:
                pass

        await interaction.followup.send("❌ Edit failed — GPU may be busy.", ephemeral=True)


class ImageButton(discord.ui.Button):
    def __init__(self, number, image_bytes, prompt):
        super().__init__(label=str(number), style=discord.ButtonStyle.secondary)
        self.image_bytes = image_bytes
        self.prompt = prompt

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer()
        buffer = io.BytesIO(self.image_bytes)
        file = discord.File(buffer, filename=f"image_{self.label}.png")
        view = FullImageView(self.image_bytes, self.prompt)
        msg = await interaction.followup.send(
            f"Image {self.label} — `{self.prompt}`\n🎬 Animate · 🗣️ Speak · ✏️ Edit",
            file=file,
            view=view,
        )
        view.message = msg


class DeleteButton(discord.ui.Button):
    def __init__(self):
        super().__init__(label="🗑 Delete", style=discord.ButtonStyle.danger)

    async def callback(self, interaction: discord.Interaction):
        await interaction.message.delete()


class RetryButton(discord.ui.Button):
    def __init__(self, prompt: str, gen_opts=None):
        super().__init__(label="\U0001f504 Retry", style=discord.ButtonStyle.primary)
        self.prompt = prompt
        self.gen_opts = gen_opts or {}

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(thinking=True)
        await interaction.followup.send(f"\U0001f3a8 Regenerating: `{self.prompt}`...", ephemeral=True)
        try:
            image_bytes_list = await generate_image_collage(self.prompt, self.gen_opts)
            if image_bytes_list:
                collage_buffer = create_collage(image_bytes_list)
                if collage_buffer:
                    file = discord.File(collage_buffer, filename="collage.png")
                    view = ImageButtons(image_bytes_list, self.prompt)
                    msg = await interaction.followup.send(
                        f"\U0001f504 Retry for: `{self.prompt}`",
                        file=file,
                        view=view,
                    )
                    view.message = msg
                else:
                    await interaction.followup.send("\u274c Could not create collage.", ephemeral=True)
            else:
                await interaction.followup.send("\u274c Could not generate images.", ephemeral=True)
        except Exception as e:
            await interaction.followup.send(f"\u274c Error: {e}", ephemeral=True)


class ImageButtons(discord.ui.View):
    def __init__(self, images, prompt):
        super().__init__(timeout=None)  # Never timeout — keep retry always active
        self.images = images
        self.prompt = prompt

        # Number buttons to select individual images (shows full-size with action buttons)
        for i in range(min(4, len(images))):
            self.add_item(ImageButton(i + 1, self.images[i], self.prompt))

        # Retry with same prompt, different seed
        self.add_item(RetryButton(prompt))

        self.add_item(DeleteButton())


# --- Cog Class ---

class AaiCog(commands.Cog, name="aai"):
    def __init__(self, bot):
        self.bot = bot
        self.request_queue = asyncio.Queue()
        self.is_processing = False
        self.bot.loop.create_task(self.process_queue())

    async def process_queue(self):
        while True:
            item = await self.request_queue.get()
            interaction, prompt = item[0], item[1]
            gen_opts = item[2] if len(item) > 2 else {}
            try:
                full_prompt = prompt + QUALITY_SUFFIX
                total = gen_opts.get("count", 4)
                completed = []

                # Build settings summary if non-default options used
                opts_parts = []
                if gen_opts.get("steps"): opts_parts.append(f"steps={gen_opts['steps']}")
                if gen_opts.get("cfg"): opts_parts.append(f"cfg={gen_opts['cfg']}")
                if gen_opts.get("sampler"): opts_parts.append(f"sampler={gen_opts['sampler']}")
                if gen_opts.get("seed") is not None: opts_parts.append(f"seed={gen_opts['seed']}")
                if gen_opts.get("width"): opts_parts.append(f"{gen_opts['width']}x{gen_opts.get('height', 768)}")
                sep = " \u00b7 "; opts_line = f"\n\u2699\ufe0f {sep.join(opts_parts)}" if opts_parts else ""

                # Single loading message
                status_msg = await interaction.followup.send(
                    f"\U0001f3a8 **Generating {total} images** for: `{prompt}`{opts_line}\n"
                    f"\u23f3 This usually takes 30\u201360 seconds..."
                )

                # Fire off all 4 generations concurrently
                async def gen_one(session, idx):
                    result = await fetch_image(session, full_prompt, gen_opts)
                    if result:
                        result = apply_watermark(result)
                    return (idx, result)

                async with aiohttp.ClientSession() as session:
                    tasks = [asyncio.ensure_future(gen_one(session, i)) for i in range(total)]

                    # Post each image as it finishes
                    for coro in asyncio.as_completed(tasks):
                        idx, img_bytes = await coro
                        if img_bytes:
                            completed.append(img_bytes)
                            n = len(completed)
                            try:
                                buf = io.BytesIO(img_bytes)
                                file = discord.File(buf, filename=f"image_{n}.png")
                                await interaction.followup.send(
                                    f"\U0001f5bc\ufe0f **Image {n}/{total}**",
                                    file=file
                                )
                            except Exception as e:
                                print(f"[IMG POST] Failed to post image {n}: {e}")

                # Delete the loading message
                try:
                    await status_msg.delete()
                except Exception:
                    pass

                # If we got enough images, also post the collage with action buttons
                if len(completed) >= 2:
                    # Pad to 4 if needed for collage (duplicate last image)
                    while len(completed) < 4:
                        completed.append(completed[-1])
                    collage_buffer = create_collage(completed)
                    if collage_buffer:
                        file = discord.File(collage_buffer, filename="collage.png")
                        view = ImageButtons(completed, prompt)
                        message = await interaction.followup.send(
                            f"\u2705 **{min(len(completed), total)}x images** for: `{prompt}`\n"
                            f"Click 1-4 to expand \u00b7 \U0001f504 Retry \u00b7 \U0001f5d1 Delete",
                            file=file, view=view
                        )
                        view.message = message
                elif len(completed) == 1:
                    # Only got 1 image, no collage needed
                    view = ImageButtons(completed, prompt)
                    message = await interaction.followup.send(
                        f"\u26a0\ufe0f Only **1/{total}** image generated (GPU was busy) \u00b7 \U0001f504 Retry",
                        view=view
                    )
                    view.message = message
                else:
                    await interaction.followup.send(
                        "\u274c Could not generate images. The GPU may be overloaded \u2014 try again in a moment."
                    )

            except Exception as e:
                print(f"[QUEUE ERROR] {e}")
                try:
                    await interaction.followup.send(f"An error occurred: {e}")
                except Exception:
                    pass
            finally:
                self.request_queue.task_done()

    @app_commands.command(name="aai", description="Generate AI images from a prompt.")
    @app_commands.describe(
        prompt="The image prompt to generate.",
        negative="Negative prompt (what to avoid).",
        steps="Inference steps (10-100, default 42).",
        cfg="CFG/guidance scale (1-20, default 6.8).",
        sampler="Sampler: euler_a, dpmpp_2m_karras, dpmpp_sde_karras.",
        seed="Seed for reproducible results.",
        width="Image width (default 512).",
        height="Image height (default 768).",
        count="Number of images (1-4, default 4).",
        hires="Enable high-res fix (default: on).",
        face_fix="Enable face restoration (default: on).",
    )
    @app_commands.choices(sampler=[
        app_commands.Choice(name="DPM++ 2M Karras (default)", value="dpmpp_2m_karras"),
        app_commands.Choice(name="DPM++ SDE Karras", value="dpmpp_sde_karras"),
        app_commands.Choice(name="Euler Ancestral", value="euler_a"),
    ])
    async def aai(
        self,
        interaction: discord.Interaction,
        prompt: str,
        negative: str = None,
        steps: int = None,
        cfg: float = None,
        sampler: str = None,
        seed: int = None,
        width: int = None,
        height: int = None,
        count: int = None,
        hires: bool = None,
        face_fix: bool = None,
    ):
        await interaction.response.defer()
        gen_opts = {}
        if negative: gen_opts["negative_prompt"] = negative
        if steps: gen_opts["steps"] = max(10, min(100, steps))
        if cfg: gen_opts["cfg"] = max(1.0, min(20.0, cfg))
        if sampler: gen_opts["sampler"] = sampler
        if seed is not None: gen_opts["seed"] = seed
        if width: gen_opts["width"] = max(256, min(1024, (width // 8) * 8))
        if height: gen_opts["height"] = max(256, min(1024, (height // 8) * 8))
        if count: gen_opts["count"] = max(1, min(4, count))
        if hires is not None: gen_opts["hires_fix"] = hires
        if face_fix is not None: gen_opts["face_restore"] = face_fix
        await self.request_queue.put((interaction, prompt, gen_opts))

    @app_commands.command(name="animate", description="Animate an image into a short video clip.")
    @app_commands.describe(image="Attach the image you want to animate.", url="Or paste a public image URL.")
    async def animate(self, interaction: discord.Interaction, image: discord.Attachment = None, url: str = None):
        await interaction.response.defer(thinking=True)

        image_url = None
        image_bytes = None

        if image:
            image_url = image.url
            async with aiohttp.ClientSession() as session:
                async with session.get(image.url) as r:
                    image_bytes = await r.read()
        elif url:
            image_url = url
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as r:
                    image_bytes = await r.read()
        else:
            await interaction.followup.send("Please attach an image or provide a URL with `url:`.", ephemeral=True)
            return

        await interaction.followup.send("🎬 Animating... (~60s) — powered by **AdultAI.com**")

        async with aiohttp.ClientSession() as session:
            # Upload to Bunny for stable URL
            uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
            portrait_url = await upload_to_bunny(session, image_bytes, f"img/animate_{uid}.png", "image/png")
            video_cdn_url = await generate_animation(session, portrait_url)

        if not video_cdn_url:
            await interaction.followup.send("❌ Animation failed — GPU may be busy. Try again shortly.")
            return

        async with aiohttp.ClientSession() as session:
            async with session.get(video_cdn_url) as vr:
                video_bytes = await vr.read()

        if len(video_bytes) <= 24 * 1024 * 1024:
            vid_file = discord.File(io.BytesIO(video_bytes), filename="animation.mp4")
            await interaction.followup.send("🎬 **Animation complete!** More at **AdultAI.com** ✨", file=vid_file)
        else:
            await interaction.followup.send(f"🎬 Done! Video: {video_cdn_url}")

    @app_commands.command(name="speak", description="Make an image speak with AI voice + lip sync.")
    @app_commands.describe(
        text="What should she say?",
        image="Attach the portrait image.",
        url="Or paste a public image URL.",
    )
    async def speak(self, interaction: discord.Interaction, text: str, image: discord.Attachment = None, url: str = None):
        await interaction.response.defer(thinking=True)

        if not text.strip():
            await interaction.followup.send("Please provide some text to speak.", ephemeral=True)
            return

        if len(text) > 400:
            await interaction.followup.send("Text too long (max 400 characters).", ephemeral=True)
            return

        image_bytes = None

        if image:
            async with aiohttp.ClientSession() as session:
                async with session.get(image.url) as r:
                    image_bytes = await r.read()
            image_url = image.url
        elif url:
            image_url = url
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as r:
                    image_bytes = await r.read()
        else:
            await interaction.followup.send("Please attach an image or provide a URL.", ephemeral=True)
            return

        await interaction.followup.send(f"🎙️ Generating voice + lip sync (~30s)...")

        async with aiohttp.ClientSession() as session:
            # Upload image
            uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
            portrait_url = await upload_to_bunny(session, image_bytes, f"img/speak_{uid}.png", "image/png")

            # TTS
            audio_bytes = await tts_to_audio(session, text.strip())
            if not audio_bytes:
                await interaction.followup.send("❌ Voice generation failed. Try again.")
                return

            audio_url = await upload_audio_to_bunny(session, audio_bytes)

            # Talking avatar
            video_cdn_url = await generate_talking_avatar(session, portrait_url, audio_url)

        if not video_cdn_url:
            # Fallback: audio only
            audio_file = discord.File(io.BytesIO(audio_bytes), filename="voice.mp3")
            await interaction.followup.send(
                f"🔊 Voice ready (lip sync unavailable for this image):\n*\"{text[:100]}\"*",
                file=audio_file,
            )
            return

        async with aiohttp.ClientSession() as session:
            async with session.get(video_cdn_url) as vr:
                video_bytes = await vr.read()

        if len(video_bytes) <= 24 * 1024 * 1024:
            vid_file = discord.File(io.BytesIO(video_bytes), filename="speaking.mp4")
            await interaction.followup.send(
                f"🎙️ *\"{text[:100]}\"*\n\nMore at **AdultAI.com** ✨",
                file=vid_file,
            )
        else:
            await interaction.followup.send(f"🎙️ *\"{text[:100]}\"*\n\nVideo: {video_cdn_url}")

    @app_commands.command(name="status", description="Check the status of the AI generation API.")
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{GPU_API_URL}/api/v1/status", headers={"X-API-Key": GPU_API_KEY}) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("status") == "Running" and data.get("model_loaded"):
                            embed = discord.Embed(
                                title="✅ API Status",
                                description="Image generation API is online and ready.",
                                color=discord.Color.green(),
                            )
                            embed.add_field(name="Features", value="🖼️ Images · 🎬 Animation · 🎙️ Lip Sync")
                            await interaction.followup.send(embed=embed)
                            return
            await interaction.followup.send("⚠️ API is running but not fully ready.")
        except Exception:
            await interaction.followup.send("❌ API is offline or unreachable.")

    @app_commands.command(name="upscale", description="Upscale an image 2x or 4x using AI.")
    @app_commands.describe(
        image="Attach the image to upscale.",
        url="Or paste a public image URL.",
        scale="Upscale factor: 2 or 4 (default 2).",
    )
    @app_commands.choices(scale=[
        app_commands.Choice(name="2x", value=2),
        app_commands.Choice(name="4x", value=4),
    ])
    async def upscale(self, interaction: discord.Interaction, image: discord.Attachment = None, url: str = None, scale: int = 2):
        await interaction.response.defer(thinking=True)

        image_url = None
        image_bytes = None

        if image:
            image_url = image.url
            async with aiohttp.ClientSession() as session:
                async with session.get(image.url) as r:
                    image_bytes = await r.read()
        elif url:
            image_url = url
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as r:
                    image_bytes = await r.read()
        else:
            await interaction.followup.send("Please attach an image or provide a URL.", ephemeral=True)
            return

        factor = scale if scale in (2, 4) else 2
        await interaction.followup.send(f"🔍 Upscaling {factor}x... (~15s)")

        try:
            async with aiohttp.ClientSession() as session:
                # Upload image to Bunny first to get a public URL
                uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
                portrait_url = await upload_to_bunny(session, image_bytes, f"img/upscale_{uid}.png", "image/png")

                # Call GPU upscale API with URL
                async with session.post(
                    f"{GPU_API_URL}/api/v1/upscale",
                    json={"image_url": portrait_url, "scale": factor, "enhance": True},
                    headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=90),
                ) as r:
                    if not r.ok:
                        await interaction.followup.send(f"❌ Upscale failed (GPU error {r.status}). Try again shortly.")
                        return
                    data = await r.json()

                result_url = data.get("image_url")
                if not result_url:
                    await interaction.followup.send("❌ Upscale returned no image. Try again.")
                    return

                # Download the upscaled image and send to Discord
                async with session.get(result_url) as vr:
                    upscaled_bytes = await vr.read()

            size_mb = len(upscaled_bytes) / (1024 * 1024)
            if size_mb <= 24:
                file = discord.File(io.BytesIO(upscaled_bytes), filename=f"upscaled_{factor}x.png")
                method = data.get("method", "AI")
                await interaction.followup.send(
                    f"✨ **{factor}x Upscale complete!** ({method.upper()}) More tools at **AdultAI.com**",
                    file=file,
                )
            else:
                await interaction.followup.send(f"✨ **{factor}x Upscale ready!** Image: {result_url}")

        except asyncio.TimeoutError:
            await interaction.followup.send("❌ Upscale timed out. The GPU may be busy — try again shortly.")
        except Exception as e:
            print(f"[UPSCALE ERROR] {e}")
            await interaction.followup.send("❌ Upscale failed. Try again.")


    @app_commands.command(name="facefix", description="Fix and enhance faces in an image using AI.")
    @app_commands.describe(
        image="Attach the image to fix faces in.",
        url="Or paste a public image URL.",
        strength="Fix strength 0.2 (subtle) to 0.6 (strong). Default 0.4.",
    )
    async def facefix(self, interaction: discord.Interaction, image: discord.Attachment = None, url: str = None, strength: float = 0.4):
        await interaction.response.defer(thinking=True)

        image_url = None
        image_bytes = None

        if image:
            image_url = image.url
            async with aiohttp.ClientSession() as session:
                async with session.get(image.url) as r:
                    image_bytes = await r.read()
        elif url:
            image_url = url
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as r:
                    image_bytes = await r.read()
        else:
            await interaction.followup.send("Please attach an image or provide a URL.", ephemeral=True)
            return

        strength = max(0.2, min(0.6, strength))
        await interaction.followup.send(f"💆 Fixing faces (strength {strength})... (~10s)")

        try:
            async with aiohttp.ClientSession() as session:
                uid = f"{int(time.time())}_{random.randint(1000, 9999)}"
                portrait_url = await upload_to_bunny(session, image_bytes, f"img/facefix_{uid}.png", "image/png")

                async with session.post(
                    f"{GPU_API_URL}/api/v1/face-restore",
                    json={"image_url": portrait_url, "strength": strength},
                    headers={"X-API-Key": GPU_API_KEY, "Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=60),
                ) as r:
                    if not r.ok:
                        await interaction.followup.send(f"❌ Face fix failed (GPU error {r.status}).")
                        return
                    data = await r.json()

                result_url = data.get("image_url")
                if not result_url:
                    await interaction.followup.send("❌ No result. Try again.")
                    return

                async with session.get(result_url) as vr:
                    fixed_bytes = await vr.read()

            file = discord.File(io.BytesIO(fixed_bytes), filename="face_fixed.png")
            method = data.get("method", "GFPGAN")
            await interaction.followup.send(
                f"💆 **Face fix done!** (Method: {method.upper()}, Strength: {strength}) More tools at **AdultAI.com**",
                file=file,
            )
        except asyncio.TimeoutError:
            await interaction.followup.send("❌ Timed out. GPU may be busy.")
        except Exception as e:
            print(f"[FACEFIX ERROR] {e}")
            await interaction.followup.send("❌ Face fix failed.")


    @app_commands.command(name="help", description="Shows all available commands.")
    async def help(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🔞 AdultAI Bot — Commands",
            description="AI-generated adult content powered by **AdultAI.com**",
            color=0x9b59b6,
        )
        embed.add_field(name="/aai `prompt`", value="Generate 4 AI images from a text prompt", inline=False)
        embed.add_field(name="/animate", value="Animate an image into a video clip (attach image or paste URL)", inline=False)
        embed.add_field(name="/speak `text`", value="Make an image speak with AI voice + lip sync", inline=False)
        embed.add_field(name="/upscale", value="Upscale an image 2x or 4x with AI (attach image or paste URL)", inline=False)
        embed.add_field(name="/status", value="Check if the AI API is online", inline=False)
        embed.set_footer(text="AdultAI.com — Create your own AI companions")
        await interaction.response.send_message(embed=embed, ephemeral=True)



    async def cog_app_command_error(self, interaction: discord.Interaction, error):
        """Global error handler for all app commands in this cog."""
        import traceback
        if isinstance(error, discord.app_commands.errors.CommandInvokeError):
            original = error.original
            if isinstance(original, discord.errors.NotFound) and original.code == 10062:
                print(f"[CMD] Interaction expired for /{interaction.command.name if interaction.command else chr(63)} — Discord was too slow or event loop blocked")
                return  # Silently ignore expired interactions
        # Log other errors
        print(f"[CMD ERROR] /{interaction.command.name if interaction.command else chr(63)}: {error}")
        traceback.print_exc()

async def setup(bot):
    await bot.add_cog(AaiCog(bot))
