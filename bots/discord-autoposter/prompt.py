"""
Prompt generator for AdultAI Discord bot.
Uses curated, high-quality Stable Diffusion prompt templates
instead of random word combinations.
"""
import random

# ── Quality boosters appended to every prompt ─────────────────────────────────
QUALITY_SUFFIX = (
    ", masterpiece, best quality, ultra-detailed, sharp focus, "
    "professional photography, 8k uhd, RAW photo, photorealistic"
)

NEGATIVE_PROMPT = (
    "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, "
    "poorly drawn face, blurry, watermark, text, logo, signature, "
    "out of frame, cropped, lowres, worst quality, low quality"
)

# ── Character archetypes ───────────────────────────────────────────────────────
CHARACTERS = [
    "a stunning brunette woman",
    "a gorgeous blonde woman",
    "a beautiful redhead woman",
    "an athletic woman with dark skin",
    "a petite Asian woman",
    "a curvy Latina woman",
    "a tall Scandinavian woman",
    "a voluptuous woman with tattoos",
    "a slender woman with freckles",
    "a confident older woman",
]

# ── Settings / environments ────────────────────────────────────────────────────
SETTINGS = [
    "in a luxury hotel room with soft golden lighting",
    "on a private tropical beach at sunset",
    "in a modern apartment with floor-to-ceiling windows overlooking the city",
    "in a dimly lit bedroom with silk sheets",
    "in a steamy shower with glass walls",
    "in a candlelit bathroom with a marble tub",
    "on a rooftop pool at night with city lights",
    "in a sleek penthouse with ambient lighting",
    "in a rustic bedroom with warm fireplace light",
    "in a minimalist white studio with dramatic lighting",
]

# ── Poses / actions ────────────────────────────────────────────────────────────
POSES = [
    "lying on her back, arching sensuously",
    "sitting confidently with legs crossed",
    "standing with one hand on her hip, looking over her shoulder",
    "reclining on a bed with an inviting expression",
    "kneeling on satin sheets",
    "leaning against a wall with a seductive gaze",
    "stretching gracefully with eyes closed",
    "sitting on the edge of a bathtub",
    "standing in a doorway with soft backlight",
    "lying on her stomach, looking back at camera",
]

# ── Clothing / wardrobe ────────────────────────────────────────────────────────
OUTFITS = [
    "wearing sheer lingerie",
    "in a silk robe that falls open",
    "in lace underwear",
    "completely nude",
    "topless in denim shorts",
    "in a tiny bikini",
    "wearing nothing but heels",
    "in a sheer babydoll",
    "in a tight dress with no bra",
    "in fishnet stockings and a corset",
]

# ── Lighting styles ────────────────────────────────────────────────────────────
LIGHTING = [
    "soft golden hour lighting",
    "dramatic chiaroscuro lighting",
    "moody blue ambient light",
    "warm candlelight",
    "crisp studio strobe lighting",
    "backlit silhouette",
    "soft diffused natural light",
    "neon accent lighting",
    "soft window light casting long shadows",
    "low-key cinematic lighting",
]

# ── Camera / style directives ──────────────────────────────────────────────────
CAMERA_STYLES = [
    "shot on Canon EOS R5, 85mm f/1.4",
    "shot on Sony A7IV, 50mm prime lens",
    "editorial fashion photography",
    "boudoir photography",
    "cinematic film still",
    "high fashion photography",
    "intimate portrait photography",
    "lifestyle photography",
    "fine art nude photography",
    "commercial beauty photography",
]

# ── Themed prompt sets (for variety) ──────────────────────────────────────────
THEMED_PROMPTS = [
    # Fantasy / Sci-Fi
    "a beautiful elf woman with pointed ears and silver hair, wearing a translucent elven gown, in an enchanted forest with bioluminescent flowers, golden hour, ultra detailed fantasy art",
    "a gorgeous cyberpunk woman with neon tattoos and chrome implants, wearing a skintight bodysuit, in a rain-soaked neon-lit alley, cyberpunk 2077 style, cinematic lighting",
    "a stunning vampire queen in a gothic velvet gown, alabaster skin, blood red lips, in a candlelit castle, dark fantasy art, ultra detailed",
    "a beautiful succubus with wings and horns, smoldering gaze, wearing dark fantasy armor, in a hellfire-lit throne room, digital art masterpiece",
    "a ethereal angel with massive white wings, wearing flowing white silk, in heavenly golden light, divine and sensual, fine art",

    # Real-world scenarios
    "a confident professional woman in a power suit undressing in a luxury hotel room, dramatic window light, cinematic composition",
    "a beautiful yoga instructor in a sports bra and leggings, doing a backbend pose on a rooftop at sunset, athletic and sensual",
    "a stunning bartender leaning over the bar, low-cut top, warm pub lighting, shallow depth of field, intimate portrait",
    "a gorgeous woman in a sheer sundress on a private yacht, Mediterranean sea, golden afternoon light, lifestyle photography",
    "a beautiful dancer in a flowing dress mid-spin in an empty theater, dramatic stage lighting, artistic motion",

    # Artistic / editorial
    "studio boudoir portrait of a confident woman in silk lingerie, soft natural window light, shallow depth of field, Hasselblad medium format",
    "artistic nude portrait of a woman with flowers draped over her body, fine art photography, soft diffused light, black and white",
    "fashion editorial of a woman in a sequin gown, dramatic fashion lighting, high contrast, Vogue style photography",
    "intimate bedroom portrait of a woman in an oversized shirt, morning light streaming through curtains, warm and sensual atmosphere",
    "poolside luxury portrait of a woman in a designer bikini, summer light, ultra sharp, commercial beauty photography",
]


def generate_prompt() -> str:
    """
    Generate a high-quality image prompt.
    Alternates between structured prompts and curated themed prompts
    for maximum variety and quality.
    """
    # 40% chance of using a fully curated themed prompt
    if random.random() < 0.4:
        return random.choice(THEMED_PROMPTS) + QUALITY_SUFFIX

    # 60% chance of using the structured builder
    character = random.choice(CHARACTERS)
    setting = random.choice(SETTINGS)
    pose = random.choice(POSES)
    outfit = random.choice(OUTFITS)
    lighting = random.choice(LIGHTING)
    camera = random.choice(CAMERA_STYLES)

    prompt = f"{character}, {outfit}, {pose}, {setting}, {lighting}, {camera}{QUALITY_SUFFIX}"
    return prompt


def get_negative_prompt() -> str:
    return NEGATIVE_PROMPT


if __name__ == "__main__":
    print("Sample prompts:")
    for i in range(5):
        print(f"\n[{i+1}] {generate_prompt()}")
    print(f"\nNegative: {get_negative_prompt()}")
