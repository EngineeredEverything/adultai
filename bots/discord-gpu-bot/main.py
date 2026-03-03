from utils.bot import CCBot
from config import DISCORD_TOKEN


from typing import Literal, Optional

import discord
from discord.ext import commands

bot = CCBot()

@bot.command()
@commands.guild_only()
@commands.is_owner()
async def sync(ctx: commands.Context, guilds: commands.Greedy[discord.Object], spec: Optional[Literal["~", "*", "^"]] = None) -> None:
    print("Syncing commands...")
    if not guilds:
        if spec == "~":
            synced = await ctx.bot.tree.sync(guild=ctx.guild)
        elif spec == "*":
            ctx.bot.tree.copy_global_to(guild=ctx.guild)
            synced = await ctx.bot.tree.sync(guild=ctx.guild)
        elif spec == "^":
            ctx.bot.tree.clear_commands(guild=ctx.guild)
            await ctx.bot.tree.sync(guild=ctx.guild)
            synced = []
        else:
            synced = await ctx.bot.tree.sync()

        await ctx.send(
            f"Synced {len(synced)} commands {'globally' if spec is None else 'to the current guild.'}"
        )
        return

    ret = 0
    for guild in guilds:
        try:
            await ctx.bot.tree.sync(guild=guild)
        except discord.HTTPException:
            pass
        else:
            ret += 1

    await ctx.send(f"Synced the tree to {ret}/{len(guilds)}.")
    

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error):
    """Global handler — silently drop expired interactions, log the rest."""
    if isinstance(error, discord.app_commands.errors.CommandInvokeError):
        error = error.original
    if isinstance(error, discord.errors.NotFound) and getattr(error, 'code', None) == 10062:
        # Unknown interaction — already expired, nothing we can do
        return
    print(f"[CMD ERROR] {type(error).__name__}: {error}")
    try:
        if not interaction.response.is_done():
            await interaction.response.send_message("❌ Something went wrong. Try again.", ephemeral=True)
        else:
            await interaction.followup.send("❌ Something went wrong. Try again.", ephemeral=True)
    except Exception:
        pass

bot.run(DISCORD_TOKEN)
