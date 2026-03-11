# AdultAI Bot System — Personality + Learning

The Discord autoposter now runs 14 distinctive bot personalities that learn and evolve based on user feedback.

## Architecture

### 1. **Bot Profiles** (`bot-profiles.json`)

Each bot has:
- **Name & Archetype** — The character (girl-next-door, bombshell, cyberpunk, etc.)
- **Visual Style** — Photorealistic or artistic
- **Base Weights** — Starting preferences for settings/outfits (e.g., bedroom 30%, outdoor 20%)
- **Learned Weights** — Updated over time based on vote/comment data
- **Generation Config** — Model, CFG, steps, sampler tailored to their style

### 2. **Prompt Engine** (`bot-prompt-engine.py`)

Generates personality-driven prompts:
```python
from bot_prompt_engine import generate_prompt_for_bot

# Returns {'prompt': str, 'negativePrompt': str, 'modelId': str, 'cfg': float, 'steps': int}
gen = generate_prompt_for_bot("norma@adultai.bot")
```

**How it works:**
1. Pick a character archetype (from the bot's personality)
2. Select setting + outfit based on their weights (blending base + learned preferences)
3. Add camera direction and quality suffix
4. Build final prompt with negative prompt, model config

**Blending learned preferences:**
- Base weights: "This is who I am" (default personality)
- Learned weights: "This is what the audience wants" (60% of influence)
- Result: Bots evolve toward audience preferences while staying true to character

### 3. **Learning Loop** (`bot-learner.py`)

Runs periodically (every ~20 generations) and:
1. Queries MongoDB for each bot's images from the last 60 days
2. Classifies each image by setting + outfit
3. Scores each based on vote score + upvotes + comment count
4. Uses softmax to convert scores → probability weights
5. Updates `learnedWeights` in bot-profiles.json

**Run manually:**
```bash
python3 bot-learner.py                    # Learn for all bots
python3 bot-learner.py norma@adultai.bot  # Learn for one bot only
python3 bot-learner.py --stats            # Show current stats
```

### 4. **Integration** (`main.py`)

Updated to:
- Call `generate_prompt_for_bot(user.email)` instead of generic `generate_prompt()`
- Track generation count
- Spawn learner in background every 20 generations
- Log which bot was selected and what parameters were used

## Bot Roster

| Bot | Archetype | Style | Focus |
|-----|-----------|-------|-------|
| Norma Stitz | Girl-next-door | Photorealistic | Everyday beauty, natural |
| Connie Lingus | Seductive professional | Photorealistic | Office, luxury, power |
| Dick Gozinya | Experimental provocateur | Artistic | Bold, unconventional |
| Seymour Butts | Playful comic | Photorealistic | Fun, cheeky, playful |
| Amanda Hugginkiss | Wholesome sweetheart | Photorealistic | Cozy, romantic, soft |
| Mike Rotch | Alt-punk | Artistic | Tattoos, edgy, rebellious |
| Anita Bath | Spa wellness goddess | Photorealistic | Bathing, self-care, glow |
| Wilma Fingerdoo | Wild adventurer | Photorealistic | Outdoor, nature, sporty |
| Dixie Normous | Southern belle | Photorealistic | Country, ranch, rustic |
| Ben Dover | Dominatrix power | Photorealistic | Authority, confidence, control |
| Oliver Klozoff | Minimalist art | Artistic | Clean lines, gallery aesthetic |
| Vye Brator | Cyberpunk experimental | Artistic | Neon, chrome, futuristic |
| Alotta Fagina | Classic bombshell | Photorealistic | Vintage glamour, pin-up |
| Yuri Nator | Sci-fi fantasy | Artistic | Elf, goddess, cyberpunk realms |

## Key Features

### Personality Distinctiveness
Each bot has different:
- **Character archetypes** — "Norma" will never look or act like "Vye"
- **Setting preferences** — Norma loves bedrooms + kitchens (domestic), Vye loves experimental spaces
- **Outfit preferences** — Amanda prefers casual (sweetheart), Connie prefers formal/lingerie (professional)
- **Lighting & camera** — Photorealistic bots use film photography language, artistic bots use digital art language

### Learning from Audience
The learning system tracks:
- **Vote score** — Normalized upvote/downvote ratio
- **Comments** — Engagement signal (more comments = higher engagement)
- **Category performance** — "Users love Norma's beach photos, let's bias toward outdoor more"

Weights evolve with softmax, so:
- High-performing categories get boosted (but never become 100% — personality still matters)
- Low-performing categories fade (but aren't eliminated — may come back)
- New learnings blend with base personality (40% learned influence by default)

### Experimental Categories
Bots like Vye and Yuri and Oliver push boundaries with:
- **Fantasy content** — Dragons, elves, magical realms
- **Cyberpunk aesthetics** — Neon, chrome, futuristic
- **Minimalist art** — Gallery-quality artistic compositions

If these gain traction, the learning system will boost them. If they don't, the bots revert to safer defaults while preserving their personality.

## Deployment

### On GPU Server

Files go in: `/root/bot/`

Required dependencies:
```bash
pip3 install pymongo  # For bot-learner.py
```

### On Main Server (Docker)

Files are in: `/etc/dokploy/applications/bot-python-t3domn/code/`

After updating code:
```bash
ssh root@145.79.1.40
docker ps | grep bot  # Find container
docker cp <local-path>/bot-profiles.json <container-id>:/root/bot/
docker cp <local-path>/bot-prompt-engine.py <container-id>:/root/bot/
docker cp <local-path>/bot-learner.py <container-id>:/root/bot/
docker cp <local-path>/main.py <container-id>:/root/bot/
docker restart <container-id>
```

Or use the deploy script:
```bash
cd /root/fleet && ./deploy-bot.sh
```

## Monitoring

### Check Bot Stats
```bash
python3 bot-learner.py --stats
```

Output shows:
- Total votes per bot
- Average vote score (likes vs dislikes)
- Which categories are performing
- When learning last ran

### Watch Generation Logs
```bash
# On GPU server
tail -f /root/bot/logs/api.log

# Look for lines like:
# [TASK] bot=Norma Stitz model=cyberrealistic_pony size=9:16 cfg=6.0 steps=40
# [LEARN] Generation #20: triggering bot learning loop...
```

### Query Image Data
```bash
# SSH into main server
ssh root@145.79.1.40

# Connect to MongoDB
mongosh "mongodb://root:<password>@database-adultai-yp8zp9:27017/adultai-production-v2?authSource=admin"

# Check votes for a bot
db.GeneratedImage.aggregate([
  { $match: { userId: ObjectId("<bot-user-id>") } },
  { $group: { _id: null, avgScore: { $avg: "$voteScore" }, total: { $sum: 1 } } }
])

# See vote distribution
db.GeneratedImage.findOne({ userId: ObjectId("<bot-user-id>") })
```

## Tweaking

### Adjust Learning Influence
In `bot-prompt-engine.py`, change the `learned_boost` parameter:
```python
# Default: 40% learned, 60% base personality
merged_weights = merge_weights(base, learned, learned_boost=0.4)

# More influence from learning:
merged_weights = merge_weights(base, learned, learned_boost=0.6)

# Less influence from learning (stay true to personality):
merged_weights = merge_weights(base, learned, learned_boost=0.2)
```

### Adjust Learning Frequency
In `main.py`:
```python
LEARN_EVERY_N = 20  # Change to 10 for more frequent, 50 for less frequent
```

### Add New Bot Personality
1. Add entry to `bot-profiles.json` with new email, archetype, character prompts, weights
2. Create accounts.json entry for that bot user
3. Run learner once to initialize
4. Next generation will include the new bot

### Adjust Sampler/CFG per Bot
Each bot's config in `bot-profiles.json`:
```json
{
  "cfg": [6.0, 6.5, 7.0],      // Range to randomly sample from
  "steps": [35, 40, 45],        // Step range
  "modelId": "cyberrealistic_pony"
}
```

Lower CFG = more natural, less constrained to prompt
Higher CFG = follows prompt more strictly, potentially over-saturated
Adjust per bot's style (artistic bots can handle higher CFG, photorealistic need lower).

## Troubleshooting

### "No profiles found" error
Check that `bot-profiles.json` exists in the discord-autoposter directory.

### Learner not running
1. Check pymongo installed: `python3 -m pip install pymongo`
2. Check DATABASE_URL env var is set
3. Check MongoDB is reachable
4. Run manually: `python3 bot-learner.py` to see errors

### Bots not showing personality
Check `bot-prompt-engine.py` is being imported correctly:
```bash
python3 -c "from bot_prompt_engine import generate_prompt_for_bot; print(generate_prompt_for_bot('norma@adultai.bot'))"
```

### Weights not updating
Check:
1. Images have vote data in MongoDB (`voteScore` field populated)
2. Bot user ID matches between User collection and GeneratedImage collection
3. Run `python3 bot-learner.py --stats` to see last learned timestamp

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Discord Autoposter Main Loop (every 12-25 minutes)          │
└────────┬──────────────────────────────────────────────────┘
         │
         ├─> Load bot accounts
         │
         ├─> Pick random bot (e.g., "Norma Stitz")
         │
         ├─> Call generate_prompt_for_bot("norma@adultai.bot")
         │   │
         │   ├─> Load bot-profiles.json
         │   ├─> Merge base personality weights + learned weights
         │   ├─> Pick setting, outfit, character archetype
         │   ├─> Build prompt with quality suffix
         │   └─> Return {prompt, cfg, steps, modelId, negativePrompt}
         │
         ├─> Send to GPU API with config
         │   └─> Image(s) generated + saved to Bunny CDN
         │
         ├─> Post to Discord
         │
         ├─> Increment generation counter
         │
         └─> If counter % 20 == 0:
             └─> Spawn bot-learner.py in background
                 │
                 ├─> Connect to MongoDB
                 ├─> Query images for each bot (last 60 days)
                 ├─> Classify by setting + outfit
                 ├─> Score by votes + comments
                 ├─> Update learnedWeights in bot-profiles.json
                 └─> Save updated profiles
```

## Next Steps

1. **Deploy to production** (follow Deployment section above)
2. **Monitor first 50 generations** — check logs and stats
3. **Tune learning parameters** if needed (CFG, steps per bot)
4. **Add new experimental bots** based on early engagement data
5. **Consider A/B testing** — run two bots with different learning boosts to see what works

---

**Questions?** Check logs, run `--stats`, or query MongoDB directly.
