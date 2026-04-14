const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");
console.log("TOKEN EXISTS:", !!process.env.DISCORD_BOT_TOKEN);

if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ DISCORD_BOT_TOKEN MISSING");
  process.exit(1);
}

// ===== KEEP ALIVE SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(3000, () => console.log("🌐 Web server running"));

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ===== ONLY YOUR IDS =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to kick")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages (1-100)")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Number of messages")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send server announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
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

    // ONLY ALLOWED USERS
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You are not allowed to use this bot",
        ephemeral: true
      });
    }

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ANNOUNCEMENT (NO 📢 PREFIX) =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");

      await interaction.reply({
        content: "✅ Sent!",
        ephemeral: true
      });

      // ❗ NO 📢 HERE (as you requested)
      return interaction.channel.send(`${msg}`);
    }

    const member = interaction.options.getMember("user");

    if (interaction.commandName !== "purge" && !member) {
      return interaction.reply({
        content: "❌ User not found",
        ephemeral: true
      });
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      await member.kick();
      return interaction.reply(`👢 Kicked ${member.user.tag}`);
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      await member.ban();
      return interaction.reply(`🔨 Banned ${member.user.tag}`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");

      if (amount < 1 || amount > 100) {
        return interaction.reply({
          content: "❌ 1-100 only",
          ephemeral: true
        });
      }

      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        content: `🧹 Deleted ${amount} messages`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error("❌ ERROR:", err);
    return interaction.reply({
      content: "❌ Error occurred",
      ephemeral: true
    });
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log("LOGIN SUCCESS"))
  .catch(err => console.error("LOGIN FAILED:", err));
