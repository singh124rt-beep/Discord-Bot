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
app.listen(3000, () => console.log("🌐 Web running"));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== ALLOWED USERS =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514"
];

// ===== COMMANDS =====
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
      opt.setName("message").setDescription("Message").setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("⚡ Slash commands registered");
  } catch (err) {
    console.error(err);
  }
});

// ===== WARN STORAGE =====
const warns = new Map();

// ===== SLASH HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // 🔐 PERMISSION CHECK
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
    return interaction.reply(`⏱️ ${member.user.tag} timed out for 10 min`);
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

    interaction.channel.send({
      embeds: [{
        title: "📢 Announcement",
        description: message,
        color: 0xff0000
      }]
    });
  }
});

// ===== AUTO WELCOME =====
client.on("guildMemberAdd", (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === "welcome");
  if (!channel) return;

  channel.send(`👋 Welcome ${member}, to CRP! 🚀`);
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
