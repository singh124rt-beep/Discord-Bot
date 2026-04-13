const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
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

// ===== ALLOWED USERS =====
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

// ===== 🎉 AUTO WELCOME SYSTEM (WITH YOUR BANNER) =====
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get("1493306099317739590");
  const role = member.guild.roles.cache.get("1366502670788984902");

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🌆 Welcome to City Role Play!")
    .setDescription(`👋 Hey ${member}!

Welcome to **City Role Play** 🌆  
Start your journey and create your story!

📜 Follow the rules  
🎭 Choose your role  
🚀 Enjoy RP  

Have fun 🎉`)
    .setThumbnail(member.user.displayAvatarURL())

    // ✅ YOUR IMAGE ADDED
    .setImage("https://cdn.discordapp.com/attachments/1493306099317739590/1493309044956463224/file_00000000f47c72088b760408f4b93739.png")

    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  channel.send({ embeds: [embed] });

  if (role) {
    member.roles.add(role).catch(() => {});
  }
});

// ===== GREETING SYSTEM =====
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase().trim();

  if (msg === "hi" || msg === "hello" || msg === "hey") {
    return message.reply(`👋 Greetings, ${message.author.username} Welcome to CRP`);
  }
});

// ===== SLASH COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!allowedUsers.includes(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You are not allowed to use this command",
      ephemeral: true
    });
  }

  const member = interaction.options.getMember("user");

  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong!");
  }

  if (interaction.commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.kick();
    return interaction.reply(`👢 ${member.user.tag} was kicked`);
  }

  if (interaction.commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.ban();
    return interaction.reply(`🔨 ${member.user.tag} was banned`);
  }

  if (interaction.commandName === "timeout") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: "❌ No permission", ephemeral: true });
    }

    await member.timeout(10 * 60 * 1000, "Timeout command");
    return interaction.reply(`⏱️ ${member.user.tag} was timed out for 10 min`);
  }

  if (interaction.commandName === "warn") {
    const userId = member.id;

    if (!warns.has(userId)) warns.set(userId, 0);
    warns.set(userId, warns.get(userId) + 1);

    return interaction.reply(
      `⚠️ ${member.user.tag} warned. Total warns: ${warns.get(userId)}`
    );
  }

  if (interaction.commandName === "announce") {
    const message = interaction.options.getString("message");

    await interaction.reply({
      content: "✅ Announcement sent!",
      ephemeral: true
    });

    return interaction.channel.send(`📢 **Announcement**\n\n${message}`);
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
