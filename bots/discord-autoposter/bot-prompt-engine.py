"""
Bot Prompt Engine
Generates personality-driven prompts for each AdultAI bot user.
Each bot has a distinct archetype, visual style, and weighted preferences.
Weights evolve over time via the learning system (bot-learner.py).
"""
import json
import random
import os

PROFILES_FILE = os.path.join(os.path.dirname(__file__), "bot-profiles.json")

# ── Quality suffixes ───────────────────────────────────────────────────────────

QUALITY_PHOTOREALISTIC = (
    ", RAW photo, photorealistic, masterpiece, best quality, ultra-detailed, "
    "sharp focus, professional photography, 8k uhd, realistic skin texture, "
    "subsurface scattering, natural lighting, film grain"
)

QUALITY_ARTISTIC = (
    ", masterpiece, best quality, ultra-detailed, sharp focus, cinematic, "
    "8k, highly detailed, stunning composition, professional digital art, "
    "dramatic lighting"
)

NEGATIVE_PHOTOREALISTIC = (
    "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated hands, "
    "poorly drawn face, blurry, watermark, text, logo, cartoon, anime, "
    "3d render, painting, drawing, illustration, cgi, unrealistic, "
    "plastic skin, overly smooth skin, fake, doll-like, wax figure, "
    "over-processed, over-saturated, HDR-look, artificial, generic"
)

NEGATIVE_ARTISTIC = (
    "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, "
    "poorly drawn face, blurry, watermark, text, logo, lowres, worst quality, "
    "low quality, amateur"
)

# ── Setting options ────────────────────────────────────────────────────────────

SETTING_OPTIONS = {
    "bedroom": [
        "in a luxury bedroom with silk sheets and soft warm lighting",
        "in a dimly lit bedroom with candles and velvet decor",
        "on a king bed in a boutique hotel room, golden hour light",
        "in a rustic cabin bedroom with fireplace glow",
    ],
    "kitchen": [
        "in a modern sun-drenched kitchen, morning light",
        "leaning against a marble kitchen counter, warm natural light",
        "in a sleek minimalist kitchen, soft morning sun",
    ],
    "bathroom": [
        "in a steamy luxury marble bathroom with gold fixtures",
        "in a glass walk-in shower with steam and wet hair",
        "in a deep clawfoot bathtub surrounded by candles",
        "at a vanity mirror in a softly lit bathroom",
    ],
    "outdoor": [
        "on a private beach at golden hour, warm sunset light",
        "in a sun-drenched garden with wildflowers",
        "on a rooftop pool at night with city lights below",
        "in a meadow at dusk, warm backlit glow",
        "on a yacht deck in the Mediterranean, midday sun",
    ],
    "office": [
        "in a sleek corner office after hours, city lights through floor-to-ceiling windows",
        "at a mahogany desk in a luxury executive office, dramatic lamp light",
        "in a modern minimalist office, late night, ambient glow",
    ],
    "other": [
        "in a minimalist white photography studio with dramatic key light",
        "in a penthouse suite with panoramic city views",
        "in a dark moody lounge with neon accents",
        "in a dimly lit art gallery surrounded by sculptures",
        "in an enchanted forest with bioluminescent flowers (fantasy)",
        "in a rain-soaked neon-lit alley (cyberpunk setting)",
        "in a candlelit gothic castle interior",
        "on a space station observation deck with Earth below",
    ],
}

# ── Outfit options ─────────────────────────────────────────────────────────────

OUTFIT_OPTIONS = {
    "lingerie": [
        "wearing sheer black lace lingerie, pulling panties aside",
        "in delicate white silk lingerie, bra unclasped falling off",
        "wearing a strappy lace bralette and thong, nipples visible through sheer fabric",
        "in a sheer babydoll lingerie set, breasts exposed",
        "in crotchless lace panties and garter belt, spread legs",
        "wearing a see-through mesh bodysuit, everything visible",
    ],
    "casual": [
        "in an oversized button-down shirt fully open, nude underneath, tits out",
        "topless in low-rise jeans, hand between thighs",
        "wearing just an apron, nude from behind, great ass",
        "in a fitted white t-shirt soaking wet, completely see-through, no bra",
        "in a sundress hiked up, no panties, teasing",
    ],
    "nude": [
        "completely nude, legs spread, pussy visible, confident sultry expression",
        "nude on all fours, ass up, looking back seductively",
        "fully nude, wet skin glistening, hands cupping breasts",
        "nude lying back with legs open, inviting pose",
        "naked and dripping wet, fresh from shower, nipples hard",
        "nude straddling position, tits bouncing, ecstatic expression",
        "completely nude spreading pussy lips, close-up detail, dripping wet",
        "nude bent over showing ass and pussy from behind",
    ],
    "hardcore": [
        "nude covered in cum on face and tits, satisfied expression",
        "ahegao face, tongue out, drooling, nude and sweaty",
        "nude squeezing large tits together, cum on chest",
        "legs spread wide showing wet pussy close-up, dripping",
        "on knees nude, cum on face, looking up seductively",
        "nude riding position, bouncing tits, mouth open in pleasure",
        "bent over spreading ass cheeks, pussy and ass visible",
        "nude with vibrator, orgasm face, back arched",
    ],
    "hardcore_explicit": [
        "nude, both hands spreading pussy lips wide open showing pink inside, close-up, dripping wet, photorealistic",
        "nude bent over, ass spread wide, asshole and pussy fully exposed, extreme close-up, glistening",
        "nude kneeling, face covered in thick cum, mouth open, cum dripping from lips and chin, ahegao expression",
        "cum on face, cum in mouth, tongue out showing cum pool, satisfied dripping expression",
        "nude legs spread missionary, pussy spread wide open, close-up detail, dripping arousal",
        "cum soaked nude body, cum on tits, stomach, face, multiple loads, blissed-out expression",
        "nude presenting ass and pussy from behind, both holes exposed, spreading cheeks wide",
        "nude squatting, spreading pussy lips apart showing wet pink interior, direct camera view",
        "cum gurgling, mouthful of cum, letting it drip down chin onto tits, eyes rolled back",
        "nude facial, thick cum ropes across face and hair, mouth open catching it, orgasm face",
        "legs in air spread eagle, pussy gaping and dripping, post-orgasm flush",
        "nude reverse cowgirl view from below, pussy lips spread, riding motion implied",
        "nude doggy perspective, asshole and pussy framed perfectly, back arched, moaning",
        "nude covered in cum lying back, cum on face tits belly, exhausted satisfied expression",
        "squirting orgasm, legs spread wide, clear stream, eyes rolled back, back arched",
    ],
    "athletic": [
        "in a sports bra pulled up exposing tits, yoga pants pulled down",
        "in a tight yoga outfit, camel toe visible, bent over stretching",
        "post-workout nude in locker room, sweaty skin glistening",
    ],
    "formal": [
        "in an elegant backless evening gown, no panties, side slit showing everything",
        "wearing a tailored blazer with nothing underneath, tits out",
        "cocktail dress pulled up, no underwear, bent over desk",
    ],
    "vintage": [
        "in vintage 1950s lingerie, classic pin-up style, stocking tops visible",
        "retro burlesque style, tassels on nipples, feather boa",
        "wearing retro high-waisted panties pulled aside, vintage garter belt",
    ],
    "fantasy": [
        "in translucent elven robe open at the front, nude underneath, ethereal beauty",
        "wearing flowing goddess silk barely covering anything, nipples showing",
        "nude forest nymph with body paint, spread among flowers",
    ],
    "cyberpunk": [
        "in a skintight holographic bodysuit unzipped to navel, tits spilling out",
        "wearing only neon body harness, fully nude, cyberpunk aesthetic",
        "nude with glowing cyberpunk tattoos, chrome accessories, spread pose",
    ],
}

# ── Camera / lighting directives ───────────────────────────────────────────────

CAMERA_STYLES_PHOTOREALISTIC = [
    "shot on Canon EOS R5, 85mm f/1.4 lens, shallow depth of field",
    "shot on Sony A7 IV, 50mm prime, boudoir photography",
    "Hasselblad medium format, editorial photography",
    "cinematic 35mm film still, Kodak Portra 400",
    "intimate portrait photography, soft diffused light",
]

CAMERA_STYLES_ARTISTIC = [
    "cinematic composition, dramatic lighting",
    "fine art photography, gallery quality",
    "editorial fashion photography, high contrast",
    "digital art, highly detailed, stunning composition",
]


def load_profiles() -> dict:
    with open(PROFILES_FILE) as f:
        return json.load(f)


def save_profiles(profiles: dict):
    with open(PROFILES_FILE, "w") as f:
        json.dump(profiles, f, indent=2)


def weighted_choice(weights_dict: dict) -> str:
    """Choose a key from a {key: float_weight} dict using weighted random."""
    if not weights_dict:
        return list(SETTING_OPTIONS.keys())[0]
    keys = list(weights_dict.keys())
    weights = [float(weights_dict[k]) for k in keys]
    return random.choices(keys, weights=weights, k=1)[0]


def merge_weights(base: dict, learned: dict, learned_boost: float = 0.4) -> dict:
    """
    Blend base personality weights with learned weights.
    learned_boost=0.4 means learned weights count for 40% of the final mix.
    """
    if not learned:
        return base

    all_keys = set(base.keys()) | set(learned.keys())
    merged = {}
    for k in all_keys:
        b = float(base.get(k, 0.0))
        l = float(learned.get(k, 0.0))
        merged[k] = b * (1 - learned_boost) + l * learned_boost

    # Normalize
    total = sum(merged.values())
    if total > 0:
        merged = {k: round(v / total, 4) for k, v in merged.items()}
    return merged


def generate_prompt_for_bot(email: str) -> dict:
    """
    Generate a personality-driven prompt for a given bot email.

    Returns:
        {
            "prompt": str,
            "negativePrompt": str,
            "modelId": str,
            "cfg": float,
            "steps": int,
        }
    """
    profiles = load_profiles()
    profile = profiles.get(email)

    if not profile:
        return {
            "prompt": (
                "a beautiful woman, photorealistic, RAW photo, masterpiece, "
                "best quality, ultra-detailed, sharp focus, 8k"
            ),
            "negativePrompt": NEGATIVE_PHOTOREALISTIC,
            "modelId": "cyberrealistic_pony",
            "cfg": 6.5,
            "steps": 40,
        }

    style = profile.get("style", "photorealistic")
    learned = profile.get("learnedWeights", {})

    # --- Character ---
    character = random.choice(profile.get("characterPrompts", ["a beautiful woman"]))

    # --- Setting (merge base + learned) ---
    base_setting_w = profile.get("settingWeights", {"other": 1.0})
    learned_setting_w = learned.get("settings", {})
    setting_weights = merge_weights(base_setting_w, learned_setting_w)
    setting_key = weighted_choice(setting_weights)
    setting_pool = SETTING_OPTIONS.get(setting_key, SETTING_OPTIONS["other"])
    setting = random.choice(setting_pool)

    # --- Outfit (merge base + learned) ---
    base_outfit_w = profile.get("outfitWeights", {"lingerie": 1.0})
    learned_outfit_w = learned.get("outfits", {})
    outfit_weights = merge_weights(base_outfit_w, learned_outfit_w)
    outfit_key = weighted_choice(outfit_weights)
    outfit_pool = OUTFIT_OPTIONS.get(outfit_key, OUTFIT_OPTIONS["lingerie"])
    outfit = random.choice(outfit_pool)

    # --- Camera / quality ---
    if style == "photorealistic":
        quality = QUALITY_PHOTOREALISTIC
        camera = random.choice(CAMERA_STYLES_PHOTOREALISTIC)
        neg_prompt = NEGATIVE_PHOTOREALISTIC
    else:
        quality = QUALITY_ARTISTIC
        camera = random.choice(CAMERA_STYLES_ARTISTIC)
        neg_prompt = NEGATIVE_ARTISTIC

    # --- Assemble ---
    prompt = f"{character}, {outfit}, {setting}, {camera}{quality}"

    return {
        "prompt": prompt,
        "negativePrompt": neg_prompt,
        "modelId": profile.get("modelId", "cyberrealistic_pony"),
        "cfg": random.choice(profile.get("cfg", [6.5])),
        "steps": random.choice(profile.get("steps", [40])),
    }


if __name__ == "__main__":
    import sys
    emails = list(load_profiles().keys())
    print("Sample prompts for each bot:\n")
    for email in emails:
        result = generate_prompt_for_bot(email)
        name = load_profiles()[email]["name"]
        print(f"[{name}]")
        print(f"  Model: {result['modelId']} | CFG: {result['cfg']} | Steps: {result['steps']}")
        print(f"  Prompt: {result['prompt'][:120]}...")
        print()
