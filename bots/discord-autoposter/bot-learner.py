"""
Bot Learning System
===================
Reads vote, comment, and admin_deleted data from MongoDB for each bot user.
Identifies which content categories/styles perform best AND worst.

Positive signals:  upvotes, comments
Negative signals:  downvotes, admin_deleted status

The learner blends positive and negative evidence via a signed score per
category, then converts to weights via softmax. Categories that consistently
get deleted or downvoted get lower weights over time.

Run manually:       python3 bot-learner.py
Run for one bot:    python3 bot-learner.py norma@adultai.bot
Show stats only:    python3 bot-learner.py --stats
"""

import json
import os
import sys
import re
import math
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

# ── Weights for each signal type ─────────────────────────────────────────────
# Positive signals add to category score; negative signals subtract.

SIGNAL_WEIGHTS = {
    "upvote":        +1.0,   # each upvote
    "downvote":      -1.5,   # each downvote (weighted heavier — explicit rejection)
    "comment":       +0.5,   # each comment (engagement)
    "admin_deleted": -5.0,   # admin deleted the image (strong "don't do this" signal)
}

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
    All scores are shifted to be positive first so softmax still works
    even when some categories have negative net scores.
    Higher temperature = more uniform. Lower = more peaked.
    """
    if not scores:
        return {}
    # Shift so minimum is 0.1 (preserves relative ordering, avoids zero weights)
    min_v = min(scores.values())
    shifted = {k: v - min_v + 0.1 for k, v in scores.items()}
    exp_scores = {k: math.exp(v / temperature) for k, v in shifted.items()}
    total = sum(exp_scores.values())
    return {k: round(v / total, 4) for k, v in exp_scores.items()}


def learn_for_bot(email: str, db, profiles: dict) -> bool:
    """
    Run learning for a single bot. Modifies profiles in-place.
    Returns True if learned successfully, False otherwise.

    Signals used:
    - upvotes / downvotes / voteScore from GeneratedImage
    - comment count from ImageComment
    - admin_deleted status (strong negative — means "this content is unwanted")
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
    cutoff = datetime.utcnow() - timedelta(days=60)

    # Fetch ALL images including admin_deleted ones (that's the whole point)
    images = list(db["GeneratedImage"].find(
        {
            "userId": user_id,
            "createdAt": {"$gte": cutoff},
            "prompt": {"$exists": True},
            "status": {"$in": ["completed", "admin_deleted", "flagged"]},
        },
        {"prompt": 1, "voteScore": 1, "upvotes": 1, "downvotes": 1,
         "status": 1, "createdAt": 1},
    ))

    if len(images) < 5:
        print(f"[Learner] {email}: only {len(images)} images (need 5+), skipping")
        return False

    # Fetch comment counts
    image_ids = [str(img["_id"]) for img in images]
    comment_counts = {}
    try:
        comments = list(db["ImageComment"].find(
            {"imageId": {"$in": image_ids}},
            {"imageId": 1},
        ))
        for c in comments:
            iid = c.get("imageId", "")
            comment_counts[iid] = comment_counts.get(iid, 0) + 1
    except Exception:
        pass

    # Score each image
    setting_scores = {}
    outfit_scores = {}
    total_images = len(images)
    total_up = 0
    total_down = 0
    total_deleted = 0

    for img in images:
        prompt = img.get("prompt", "")
        upvotes = int(img.get("upvotes", 0))
        downvotes = int(img.get("downvotes", 0))
        status = img.get("status", "completed")
        comment_count = comment_counts.get(str(img["_id"]), 0)

        total_up += upvotes
        total_down += downvotes
        if status == "admin_deleted":
            total_deleted += 1

        # Build signed engagement score from all signals
        score = (
            upvotes   * SIGNAL_WEIGHTS["upvote"] +
            downvotes * SIGNAL_WEIGHTS["downvote"] +
            comment_count * SIGNAL_WEIGHTS["comment"] +
            (SIGNAL_WEIGHTS["admin_deleted"] if status == "admin_deleted" else 0)
        )

        classification = classify_prompt(prompt)
        s = classification["setting"]
        o = classification["outfit"]

        setting_scores[s] = setting_scores.get(s, 0) + score
        outfit_scores[o] = outfit_scores.get(o, 0) + score

    # Convert signed scores → probability weights via shifted softmax
    learned_settings = softmax_weights(setting_scores, temperature=0.8)
    learned_outfits = softmax_weights(outfit_scores, temperature=0.8)

    avg_score = (total_up - total_down) / total_images if total_images > 0 else 0

    # Identify what's being penalized (for logging)
    worst_setting = min(setting_scores, key=setting_scores.get) if setting_scores else "n/a"
    worst_outfit = min(outfit_scores, key=outfit_scores.get) if outfit_scores else "n/a"
    top_setting = max(setting_scores, key=setting_scores.get) if setting_scores else "n/a"
    top_outfit = max(outfit_scores, key=outfit_scores.get) if outfit_scores else "n/a"

    # Update profile
    profile["learnedWeights"] = {
        "settings": learned_settings,
        "outfits": learned_outfits,
    }
    profile["totalVotes"] = total_up + total_down
    profile["totalDeleted"] = total_deleted
    profile["avgVoteScore"] = round(avg_score, 3)
    profile["lastLearned"] = datetime.utcnow().isoformat()

    print(f"[Learner] ✓ {profile['name']} ({email})")
    print(f"          Images: {total_images} | Votes: +{total_up}/-{total_down} | Deleted: {total_deleted}")
    print(f"          Best:  setting={top_setting}, outfit={top_outfit}")
    print(f"          Worst: setting={worst_setting}, outfit={worst_outfit}")

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
    print(f"[Learner] Signals: upvote={SIGNAL_WEIGHTS['upvote']:+}, downvote={SIGNAL_WEIGHTS['downvote']:+}, "
          f"comment={SIGNAL_WEIGHTS['comment']:+}, admin_deleted={SIGNAL_WEIGHTS['admin_deleted']:+}")

    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
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

    print(f"\n[Learner] Done. Learned: {learned_count} | Skipped: {skipped_count}")
    print(f"[Learner] Profiles saved to {os.path.abspath('bot-profiles.json')}")


def show_stats():
    """Print current learned stats for all bots."""
    profiles = load_profiles()
    print("\n=== Bot Learning Stats ===\n")
    for email, profile in profiles.items():
        name = profile.get("name", email)
        last = profile.get("lastLearned") or "never"
        votes = profile.get("totalVotes", 0)
        deleted = profile.get("totalDeleted", 0)
        avg = profile.get("avgVoteScore", 0)
        learned = profile.get("learnedWeights", {})
        has_data = bool(learned.get("settings") or learned.get("outfits"))
        print(f"{name:25s} | votes: {votes:4d} | deleted: {deleted:3d} | avg: {avg:+.2f} | "
              f"learned: {'yes' if has_data else 'no'} | last: {last[:10] if last != 'never' else 'never'}")
    print()


if __name__ == "__main__":
    args = sys.argv[1:]

    if "--stats" in args:
        show_stats()
    elif args and "@" in args[0]:
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
