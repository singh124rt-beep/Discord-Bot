const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 STARTING BOT...");

// ===== KEEP ALIVE SERVER (IMPORTANT FOR RENDER FREE) =====
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is alive ✅");
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

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

// ===== READY EVENT =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ===== ERROR HANDLING =====
process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

// ===== LOGIN (IMPORTANT POSITION) =====
(async () => {
  try {
    console.log("🚀 Attempting login...");
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log("🔥 LOGIN SUCCESS");
  } catch (err) {
    console.error("❌ LOGIN FAILED:");
    console.error(err);
  }
})();
