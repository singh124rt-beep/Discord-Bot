const express = require("express");
const {
  Client,
  GatewayIntentBits
} = require("discord.js");

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

// ===== TOKEN CHECK =====
if (!process.env.TOKEN) {
  console.error("❌ TOKEN NOT FOUND");
  process.exit(1);
}

console.log("✅ TOKEN FOUND");

// ===== DEBUG TOKEN =====
console.log("TOKEN LENGTH:", process.env.TOKEN?.length);
console.log("TOKEN START:", process.env.TOKEN?.slice(0, 10));

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  ws: {
    properties: {
      browser: "Discord iOS"
    }
  }
});

// ===== READY =====
client.on("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ===== ERRORS =====
client.on("error", err => {
  console.error("❌ CLIENT ERROR:", err);
});

process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ UNCAUGHT:", err);
});

// ===== LOGIN =====
(async () => {
  try {
    console.log("🚀 Attempting login...");
    await client.login(process.env.TOKEN);
    console.log("🔥 LOGIN SUCCESS");
  } catch (err) {
    console.error("❌ LOGIN FAILED:", err);
  }
})();
