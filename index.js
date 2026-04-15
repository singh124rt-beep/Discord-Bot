const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField
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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== ONLY SELECTED USERS =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== WARN STORAGE =====
const warns = new Map();

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
    ),

  // ===== TIMEOUT =====
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user (selected only)")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to timeout")
        .setRequired(true)
    ),

  // ===== REMOVE TIMEOUT =====
  new SlashCommandBuilder()
    .setName("removetimeout")
    .setDescription("Remove timeout (selected only)")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to remove timeout")
        .setRequired(true)
    ),

  // ===== WARN =====
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (selected only)")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to warn")
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

    // ONLY SELECTED USERS CAN USE BOT
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

    // ===== ANNOUNCEMENT (NO 📢) =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");

      await interaction.reply({ content: "✅ Sent!", ephemeral: true });
      return interaction.channel.send(msg);
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
      return interaction.reply(`🧹 Deleted ${amount} messages`);
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      await member.timeout(10 * 60 * 1000); // 10 min
      return interaction.reply(`⏱️ Timeout applied to ${member.user.tag}`);
    }

    // ===== REMOVE TIMEOUT =====
    if (interaction.commandName === "removetimeout") {
      await member.timeout(null);
      return interaction.reply(`✅ Timeout removed from ${member.user.tag}`);
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      const id = member.id;
      warns.set(id, (warns.get(id) || 0) + 1);

      return interaction.reply(
        `⚠️ Warned ${member.user.tag} | Total: ${warns.get(id)}`
      );
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
