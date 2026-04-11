const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 STARTING BOT...");

// ================= ENV CHECK =================
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN NOT FOUND IN ENV");
  process.exit(1);
}

console.log("✅ TOKEN FOUND");

// ================= EXPRESS (Render keeps alive) =================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🤖 Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Replies Pong!"),
  new SlashCommandBuilder().setName("help").setDescription("Shows help menu"),
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

// ================= READY EVENT =================
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("⚡ Slash commands registered successfully");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
});

// ================= SLASH COMMAND HANDLER =================
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
        content: "❌ You are not allowed to use this command",
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

// ================= MESSAGE COMMAND =================
client.on("messageCreate", message => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();

  if (msg === "hi" || msg === "hello" || msg === "hey") {
    message.channel.send("👋 Hello! Welcome to the server!");
  }
});

// ================= ERROR HANDLERS =================
process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
});

// ================= LOGIN =================
console.log("🚀 Attempting login...");

client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log("🔥 LOGIN SUCCESS"))
  .catch(err => {
    console.error("❌ LOGIN FAILED:");
    console.error(err);
  });
