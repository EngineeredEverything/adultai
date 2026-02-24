import discord
from discord.ext import commands

class CCBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=discord.Intents.all())

    async def setup_hook(self):
        await self.load_extension("cogs.aai")
        # Sync slash commands globally on startup
        synced = await self.tree.sync()
        print(f"Synced {len(synced)} slash command(s) globally.")

    async def on_ready(self):
        print(f"Logged in as {self.user}")
