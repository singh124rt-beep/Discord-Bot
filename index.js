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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

// ===== WARN SCHEMA (ADVANCED) =====
const warnSchema = new mongoose.Schema({
  userId: String,
  warns: [
    {
      reason: String,
      moderator: String,
      date: { type: Date, default: Date.now }
    }
  ]
});
const Warn = mongoose.model("Warn", warnSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== ALLOWED USERS =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== ANTI-ABUSE =====
const actionTracker = new Map();
const ABUSE_LIMIT = 3;
const ABUSE_TIME = 10000;

function checkAbuse(userId) {
  const now = Date.now();

  if (!actionTracker.has(userId)) {
    actionTracker.set(userId, { count: 1, time: now });
    return false;
  }

  let data = actionTracker.get(userId);

  if (now - data.time < ABUSE_TIME) {
    data.count++;

    if (data.count >= ABUSE_LIMIT) {
      actionTracker.delete(userId);
      return true;
    }
  } else {
    actionTracker.set(userId, { count: 1, time: now });
  }

  return false;
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

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
    .setName("removetimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warns")
    .setDescription("Check warn history")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove last warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

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

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  try {

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.editReply("❌ Not allowed");
    }

    const member = interaction.options.getMember("user");

    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");

      await channel.send(msg);
      return interaction.editReply("✅ Sent!");
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    if (!member) return interaction.editReply("❌ User not found");

    // ===== ANTI-ABUSE =====
    if (["kick", "ban", "timeout"].includes(interaction.commandName)) {
      if (checkAbuse(interaction.user.id)) {
        await interaction.member.timeout(24 * 60 * 60 * 1000, "Abuse detected");
        return interaction.editReply("🚨 Abuse detected → 24h timeout");
      }
    }

    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.editReply(`👢 ${member} kicked\nReason: ${reason}`);
    }

    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.editReply(`🔨 ${member} banned\nReason: ${reason}`);
    }

    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      const reason = interaction.options.getString("reason");

      await member.timeout(time * 60 * 1000, reason);

      return interaction.editReply(
        `⏱️ ${member}\nTime: ${time} min\nReason: ${reason}`
      );
    }

    if (interaction.commandName === "removetimeout") {
      await member.timeout(null);
      return interaction.editReply("✅ Timeout removed");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: [] });

      data.warns.push({
        reason,
        moderator: interaction.user.tag
      });

      if (data.warns.length >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns reached");
        data.warns = [];
        await data.save();

        return interaction.editReply(`⚠️ ${member} → 3 warns → 24h timeout`);
      }

      await data.save();

      return interaction.editReply(
        `⚠️ ${member}\nReason: ${reason}\nWarns: ${data.warns.length}/3`
      );
    }

    // ===== WARNS =====
    if (interaction.commandName === "warns") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data || data.warns.length === 0) {
        return interaction.editReply("✅ No warns");
      }

      let text = data.warns
        .map((w, i) => `${i + 1}. ${w.reason} | ${w.moderator}`)
        .join("\n");

      return interaction.editReply(`⚠️ Warn History:\n${text}`);
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data || data.warns.length === 0) {
        return interaction.editReply("❌ No warns");
      }

      data.warns.pop();
      await data.save();

      return interaction.editReply(
        `✅ Removed warn (${data.warns.length}/3)`
      );
    }

    // ===== ROLE =====
    if (interaction.commandName === "role") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) {
        await member.roles.add(role);
      }

      return interaction.editReply(`✅ ${roles.length} roles added`);
    }

  } catch (err) {
    console.error("❌ ERROR:", err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ===== LOGIN =====
console.log("🔐 Attempting login...");
client.login(process.env.DISCORD_BOT_TOKEN);
