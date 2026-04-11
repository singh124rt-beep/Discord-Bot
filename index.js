const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

console.log("🔥 STARTING BOT...");

// ===== EXPRESS SERVER =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// ===== TOKEN =====
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ TOKEN NOT FOUND");
  process.exit(1);
}

console.log("✅ TOKEN FOUND");

// ===== CLIENT (FORCE FIX) =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  makeCache: () => null // 🔥 important fix
});

// ===== READY =====
client.on("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ===== DEBUG =====
client.on("debug", msg => console.log("DEBUG:", msg));
client.on("error", err => console.error("ERROR:", err));

// ===== LOGIN =====
(async () => {
  try {
    console.log("🚀 Attempting login...");
    await client.login(token);
    console.log("🔥 LOGIN SUCCESS");
  } catch (err) {
    console.error("❌ LOGIN FAILED:", err);
  }
})();
