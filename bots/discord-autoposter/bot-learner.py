"""
Bot Learning System
===================
Reads vote + comment data from MongoDB for each bot user.
Identifies which content categories/styles perform best.
Updates learnedWeights in bot-profiles.json so future generations
are biased toward what the audience actually responds to.

Run manually:       python3 bot-learner.py
Run for one bot:    python3 bot-learner.py norma@adultai.bot
Show stats only:    python3 bot-learner.py --stats
"""

import json
import os
import sys
import re
from datetime import datetime, timedelta

try:
    import pymongo
    from pymongo import MongoClient
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False
    print("[Learner] WARNING: pymongo not installed. Run: pip3 install pymongo")

from bot_prompt_engine import load_profiles, save_profiles

MONGO_URL = os.environ.get("DATABASE_URL", "")
DB_NAME = "adultai-production-v2"

# ── Keyword maps for classifying prompts ──────────────────────────────────────

SETTING_KEYWORDS = {
    "bedroom":  ["bedroom", "bed ", " bed,", "sheets", "pillow", "hotel room", "cabin"],
    "kitchen":  ["kitchen", "counter", "cooking"],
    "bathroom": ["bathroom", "shower", "bath", "bathtub", "tub", "steam", "vanity"],
    "outdoor":  ["beach", "outdoor", "garden", "rooftop", "pool", "yacht", "meadow", "nature", "forest"],
    "office":   ["office", "desk", "executive", "professional"],
    "other":    [],  # fallback
}

OUTFIT_KEYWORDS = {
    "lingerie":  ["lingerie", "lace", "bralette", "silk slip", "babydoll"],
    "casual":    ["casual", "oversized", "t-shirt", "sundress", "crop top", "shorts"],
    "nude":      ["nude", "naked", "undressed", "tasteful nude"],
    "athletic":  ["sports bra", "yoga", "athletic", "leggings", "workout"],
    "formal":    ["gown", "blazer", "cocktail", "formal", "evening"],
    "vintage":   ["vintage", "1950s", "retro", "pin-up", "classic hollywood"],
    "fantasy":   ["elven", "goddess", "fantasy", "armor", "robe"],
    "cyberpunk": ["cyberpunk", "holographic", "bodysuit", "neon", "chrome", "futuristic"],
}


def classify_prompt(prompt: str) -> dict:
    """Returns {'setting': key, 'outfit': key} from prompt text."""
    p = prompt.lower()

    setting = "other"
    for key, keywords in SETTING_KEYWORDS.items():
        if key == "other":
            continue
        if any(kw in p for kw in keywords):
            setting = key
            break

    outfit = "lingerie"
    for key, keywords in OUTFIT_KEYWORDS.items():
        if any(kw in p for kw in keywords):
            outfit = key
            break

    return {"setting": setting, "outfit": outfit}


def softmax_weights(scores: dict, temperature: float = 1.0) -> dict:
    """
    Convert raw scores to probability weights via softmax.
    Higher temperature = more uniform (less learned bias).
    Lower temperature = more peaked (stronger learned preference).
    """
    if not scores:
        return {}
    import math
    exp_scores = {k: math.exp(v / temperature) for k, v in scores.items()}
    total = sum(exp_scores.values())
    return {k: round(v / total, 4) for k, v in exp_scores.items()}


def learn_for_bot(email: str, db, profiles: dict) -> bool:
    """
    Run learning for a single bot. Modifies profiles in-place.
    Returns True if learned successfully, False otherwise.
    """
    profile = profiles.get(email)
    if not profile:
        print(f"[Learner] {email}: no profile found, skipping")
        return False

    user = db["User"].find_one({"email": email})
    if not user:
        print(f"[Learner] {email}: user not in DB, skipping")
        return False

    user_id = user["_id"]
    cutoff = datetime.utcnow() - timedelta(days=60)  # 60-day window

    # Fetch images with vote data
    images = list(db["GeneratedImage"].find(
        {
            "userId": user_id,
            "createdAt": {"$gte": cutoff},
            "prompt": {"$exists": True},
        },
        {"prompt": 1, "voteScore": 1, "upvotes": 1, "downvotes": 1, "createdAt": 1},
    ))

    if len(images) < 5:
        print(f"[Learner] {email}: only {len(images)} images (need 5+), skipping")
        return False

    # Fetch comments for this user's images (bonus signal)
    image_ids = [img["_id"] for img in images]
    comment_counts = {}
    try:
        comments = list(db["ImageComment"].find(
            {"imageId": {"$in": [str(i) for i in image_ids]}},
            {"imageId": 1},
        ))
        for c in comments:
            iid = c.get("imageId", "")
            comment_counts[iid] = comment_counts.get(iid, 0) + 1
    except Exception:
        pass  # Comments are a bonus signal, not required

    # Score each image
    setting_scores = {}
    outfit_scores = {}
    total_images = len(images)
    total_up = 0
    total_down = 0

    for img in images:
        prompt = img.get("prompt", "")
        vote_score = float(img.get("voteScore", 0))
        upvotes = int(img.get("upvotes", 0))
        downvotes = int(img.get("downvotes", 0))
        comment_bonus = comment_counts.get(str(img["_id"]), 0) * 0.5

        total_up += upvotes
        total_down += downvotes

        # Engagement score: vote score + comment bonus
        engagement = vote_score + comment_bonus

        classification = classify_prompt(prompt)
        s = classification["setting"]
        o = classification["outfit"]

        setting_scores[s] = setting_scores.get(s, 0) + engagement
        outfit_scores[o] = outfit_scores.get(o, 0) + engagement

    # Convert to weights (shift to avoid negatives, then softmax)
    def score_to_weights(scores, temperature=0.8):
        if not scores:
            return {}
        # Shift to positive
        min_v = min(scores.values())
        shifted = {k: v - min_v + 0.1 for k, v in scores.items()}
        return softmax_weights(shifted, temperature=temperature)

    learned_settings = score_to_weights(setting_scores)
    learned_outfits = score_to_weights(outfit_scores)

    avg_score = (total_up - total_down) / total_images if total_images > 0 else 0

    # Update profile
    profile["learnedWeights"] = {
        "settings": learned_settings,
        "outfits": learned_outfits,
    }
    profile["totalVotes"] = total_up + total_down
    profile["avgVoteScore"] = round(avg_score, 3)
    profile["lastLearned"] = datetime.utcnow().isoformat()

    # Find top performers
    top_setting = max(setting_scores, key=setting_scores.get) if setting_scores else "n/a"
    top_outfit = max(outfit_scores, key=outfit_scores.get) if outfit_scores else "n/a"

    print(f"[Learner] ✓ {profile['name']} ({email})")
    print(f"          Images analyzed: {total_images} | Avg score: {avg_score:.2f}")
    print(f"          Top setting: {top_setting} | Top outfit: {top_outfit}")

    return True


def learn_for_all_bots():
    """Run the full learning loop for all bots."""
    if not MONGO_AVAILABLE:
        print("[Learner] pymongo not available. Install with: pip3 install pymongo")
        return

    if not MONGO_URL:
        print("[Learner] No DATABASE_URL set. Cannot connect to MongoDB.")
        return

    print(f"[Learner] Starting learning loop at {datetime.utcnow().isoformat()}")
    print(f"[Learner] Connecting to MongoDB...")

    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        # Test connection
        db.command("ping")
    except Exception as e:
        print(f"[Learner] MongoDB connection failed: {e}")
        return

    profiles = load_profiles()
    learned_count = 0
    skipped_count = 0

    for email in profiles.keys():
        try:
            success = learn_for_bot(email, db, profiles)
            if success:
                learned_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            print(f"[Learner] Error for {email}: {e}")
            skipped_count += 1

    save_profiles(profiles)
    client.close()

    print(f"\n[Learner] Done. Learned: {learned_count} | Skipped (not enough data): {skipped_count}")
    print(f"[Learner] Profiles saved to {os.path.abspath('bot-profiles.json')}")


def show_stats():
    """Print current learned stats for all bots."""
    profiles = load_profiles()
    print("\n=== Bot Learning Stats ===\n")
    for email, profile in profiles.items():
        name = profile.get("name", email)
        last = profile.get("lastLearned") or "never"
        votes = profile.get("totalVotes", 0)
        avg = profile.get("avgVoteScore", 0)
        learned = profile.get("learnedWeights", {})
        has_data = bool(learned.get("settings") or learned.get("outfits"))
        print(f"{name:25s} | votes: {votes:4d} | avg: {avg:+.2f} | learned: {'yes' if has_data else 'no'} | last: {last[:10] if last != 'never' else 'never'}")
    print()


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--stats" in args:
        show_stats()
    elif args and "@" in args[0]:
        # Learn for a specific bot
        email = args[0]
        if not MONGO_AVAILABLE or not MONGO_URL:
            print("[Learner] pymongo or DATABASE_URL not available")
            sys.exit(1)
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        profiles = load_profiles()
        learn_for_bot(email, db, profiles)
        save_profiles(profiles)
        client.close()
    else:
        learn_for_all_bots()
