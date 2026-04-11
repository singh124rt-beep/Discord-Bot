const express = require("express");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

console.log("🔥 STARTING BOT...");

// ===== TOKEN CHECK =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ TOKEN NOT FOUND");
  process.exit(1);
}

console.log("✅ TOKEN FOUND");

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== READY =====
client.once("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ===== LOGIN FIRST (CRITICAL FIX) =====
(async () => {
  try {
    console.log("🚀 Attempting login...");
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log("🔥 LOGIN SUCCESS");
  } catch (err) {
    console.error("❌ LOGIN FAILED:", err);
  }
})();

// ===== EXPRESS AFTER LOGIN =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
