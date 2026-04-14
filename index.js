const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== KEEP ALIVE SERVER =====
const app = express();

app.get("/", (req, res) => {
  res.send("Bot Alive ✅");
});

app.listen(3000, () => {
  console.log("🌐 Web server running");
});

// ===== TOKEN CHECK =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ DISCORD_BOT_TOKEN MISSING");
  process.exit(1);
}

console.log("TOKEN CHECK:", process.env.DISCORD_BOT_TOKEN ? "FOUND" : "MISSING");

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ONLY YOUR IDs =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("1-100")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.application.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Slash command error:", err);
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== ONLY ALLOWED USERS =====
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You are not allowed to use this bot",
        ephemeral: true
      });
    }

    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");

      if (amount < 1 || amount > 100) {
        return interaction.reply({ content: "❌ 1-100 only", ephemeral: true });
      }

      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Deleted ${amount}`, ephemeral: true });
    }

    const member = interaction.options.getMember("user");

    if (!member && interaction.commandName !== "ping") {
      return interaction.reply({ content: "❌ User not found", ephemeral: true });
    }

    if (interaction.commandName === "kick") {
      await member.kick();
      return interaction.reply("👢 Kicked user");
    }

    if (interaction.commandName === "ban") {
      await member.ban();
      return interaction.reply("🔨 Banned user");
    }

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Error occurred",
      ephemeral: true
    });
  }
});

// ===== LOGIN =====
try {
  client.login(process.env.DISCORD_TOKEN);
} catch (err) {
  console.error("LOGIN ERROR:", err);
  }
