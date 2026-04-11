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

// ===== DISCORD CLIENT (FINAL FIXED) =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  ws: {
    properties: {
      browser: "Discord iOS" // 🔥 forces connection fix
    }
  }
});

// ===== READY =====
client.on("ready", () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

// ===== DEBUG =====
client.on("debug", msg => console.log("🔍 DEBUG:", msg));
client.on("error", err => console.error("❌ ERROR:", err));

// ===== HEARTBEAT =====
setInterval(() => {
  console.log("💓 Bot still running...");
}, 30000);

// ===== GREETINGS + ANNOUNCE =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();

  // greetings
  if (["hi", "hello", "hey"].includes(msg)) {
    return message.reply(`👋 Hi, ${message.author.username}! Welcome to CRP.`);
  }

  // announce
  if (msg.startsWith(".announce")) {

    const allowedUsers = ["YOUR_ID_HERE"]; // replace with your ID

    if (!allowedUsers.includes(message.author.id)) {
      return message.reply("❌ Not allowed");
    }

    const text = message.content.slice(10).trim();

    if (!text) {
      return message.reply("❌ Give a message");
    }

    await message.reply("✅ Announcement sent!");
    message.channel.send(`📢 **ANNOUNCEMENT** 📢\n\n${text}`);
  }
});

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
