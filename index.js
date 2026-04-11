const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Web running"));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== ALLOWED USERS (SLASH COMMANDS ONLY) =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514"
];

// ===== WARN STORAGE =====
const warns = new Map();

// ===== SLASH COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(opt =>
      opt.setName("message")
        .setDescription("Message")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ===== REGISTER COMMANDS =====
async function registerCommands(clientId) {
  try {
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log("⚡ Slash commands registered");
  } catch (err) {
    console.error("❌ Command error:", err);
  }
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
  await registerCommands(client.user.id);
});

// ===== GREETING SYSTEM (EVERYONE CAN USE) =====
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase().trim();

  if (msg === "hi" || msg === "hello" || msg === "hey") {
    return message.reply(`👋 Greetings, ${message.author.username} Welcome to CRP`);
  }
});

// ===== SLASH COMMAND HANDLER (ONLY SELECTED USERS) =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // 🔐 ONLY ALLOWED USERS CAN USE COMMANDS
  if (!allowedUsers.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You are not allowed to use this command",
      ephemeral: true
    });
  }

  const member = interaction.options.getMember("user");

  // ===== PING =====
  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong!");
  }

  // ===== KICK =====
  if (interaction.commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.kick();
    return interaction.reply(`👢 ${member.user.tag} was kicked`);
  }

  // ===== BAN =====
  if (interaction.commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.ban();
    return interaction.reply(`🔨 ${member.user.tag} was banned`);
  }

  // ===== TIMEOUT =====
  if (interaction.commandName === "timeout") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.timeout(10 * 60 * 1000, "Timeout command");
    return interaction.reply(`⏱️ ${member.user.tag} was timed out for 10 min`);
  }

  // ===== WARN =====
  if (interaction.commandName === "warn") {
    const userId = member.id;

    if (!warns.has(userId)) warns.set(userId, 0);
    warns.set(userId, warns.get(userId) + 1);

    return interaction.reply(
      `⚠️ ${member.user.tag} warned. Total warns: ${warns.get(userId)}`
    );
  }

  // ===== ANNOUNCE =====
  if (interaction.commandName === "announce") {
    const message = interaction.options.getString("message");

    await interaction.reply({
      content: "✅ Announcement sent!",
      ephemeral: true
    });

    return interaction.channel.send(
      `\n\n${message}`
    );
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
