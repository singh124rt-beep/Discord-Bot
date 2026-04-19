const express = require("express");
const mongoose = require("mongoose");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV CHECK =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ TOKEN MISSING");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI MISSING");
  process.exit(1);
}

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(3000, () => console.log("🌐 Web server running"));

// ===== MONGODB =====
let dbReady = false;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    dbReady = true;
  })
  .catch(err => {
    console.log("❌ Mongo Error:", err.message);
  });

// ===== WARN SCHEMA =====
const warnSchema = new mongoose.Schema({
  userId: String,
  warns: Number
});
const Warn = mongoose.model("Warn", warnSchema);

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
  "1378368132376297514",
  "1335285604476522529"
];

// ===== ABUSE WORDS =====
const badWords = ["madarchod", "bhosdike", "chutiya", "gandu"];

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true)),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Give multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 LOGGED IN AS ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ COMMANDS REGISTERED");
});

// ===== ANTI-ABUSE + ANTI-TAG =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // 🚫 Abuse detection
  const content = msg.content.toLowerCase();
  if (badWords.some(word => content.includes(word))) {
    try {
      await msg.delete();
      await msg.member.timeout(24 * 60 * 60 * 1000, "Abuse detected");
      msg.channel.send(`🚫 ${msg.author} abused → Timeout 24h`);
    } catch {}
  }

  // 🚫 Mass mention
  if (msg.mentions.users.size >= 5) {
    try {
      await msg.delete();
      await msg.member.timeout(24 * 60 * 60 * 1000, "Mass mention");
      msg.channel.send(`🚫 ${msg.author} tag spam → Timeout`);
    } catch {}
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.editReply("❌ Not allowed");
    }

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");

      await channel.send(msg);
      return interaction.editReply("✅ Sent!");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {

      if (!dbReady) {
        return interaction.editReply("⚠️ Database not connected");
      }

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns");
        data.warns = 0;
        await data.save();

        return interaction.editReply("⚠️ 3 warns → Timeout 24h");
      }

      await data.save();
      return interaction.editReply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data) return interaction.editReply("❌ No warns");

      data.warns = Math.max(data.warns - 1, 0);
      await data.save();

      return interaction.editReply(`✅ Warn removed (${data.warns}/3)`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    // ===== ROLE =====
    if (interaction.commandName === "role") {

      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) {
        if (interaction.guild.members.me.roles.highest.position <= role.position) {
          return interaction.editReply(`❌ Cannot give ${role.name}`);
        }
        await member.roles.add(role);
      }

      return interaction.editReply(`✅ Roles added`);
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.editReply("👢 User kicked");
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.editReply("🔨 User banned");
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      const reason = interaction.options.getString("reason");

      await member.timeout(time * 60 * 1000, reason);
      return interaction.editReply(`⏱️ Timeout ${time} min`);
    }

  } catch (err) {
    console.error("ERROR:", err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
