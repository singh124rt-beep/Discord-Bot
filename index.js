const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 STARTING BOT...");

// ===== KEEP ALIVE SERVER =====
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

// ===== DISCORD CLIENT (FIXED CONNECTION) =====
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

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Replies Pong!"),
  new SlashCommandBuilder().setName("help").setDescription("Help menu"),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(option =>
      option.setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY EVENT =====
client.on("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("⚡ Commands registered");
  } catch (err) {
    console.error("❌ Command register error:", err);
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply("Pong! 🏓");
  }

  if (interaction.commandName === "help") {
    return interaction.reply("Commands: /ping /help /announce");
  }

  if (interaction.commandName === "announce") {
    const allowedUsers = [
      "1420063137838923868",
      "1378368132376297514",
      "1335285604476522529"
    ];

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Not allowed",
        ephemeral: true
      });
    }

    const msg = interaction.options.getString("message");

    await interaction.reply({
      content: "✅ Announcement sent!",
      ephemeral: true
    });

    await interaction.channel.send(msg);
  }
});

// ===== MESSAGE GREETING =====
client.on("messageCreate", message => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();
  if (["hi", "hello", "hey"].includes(msg)) {
    message.channel.send("👋 Hello! Welcome!");
  }
});

// ===== DEBUG EVENTS =====
client.on("debug", info => {
  console.log("🔍 DEBUG:", info);
});

client.on("error", err => {
  console.error("❌ CLIENT ERROR:", err);
});

process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

// ===== LOGIN =====
(async () => {
  try {
    console.log("🚀 Attempting login...");
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log("🔥 LOGIN SUCCESS");
  } catch (err) {
    console.error("❌ LOGIN FAILED:", err);
  }
})();
