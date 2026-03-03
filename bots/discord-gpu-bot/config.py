import os

# Load from environment variable or .env file
# Never hardcode the token — set DISCORD_TOKEN in the environment
DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN", "")

if not DISCORD_TOKEN:
    raise ValueError("DISCORD_TOKEN environment variable is not set. See README.")
