const express = require("express");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(console.error);

// ===== WARN MODEL =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: Number,
  history: [{ reason: String, date: String }]
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===== CONFIG =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

const PURGE_ROLE_ID = "1390273593040048220"; // role id

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send message with optional image")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("See all warned users"),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("See warn history")
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
    .addIntegerOption(o => o.setName("duration").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))
    .addRoleOption(o => o.setName("role4").setDescription("Role"))
    .addRoleOption(o => o.setName("role5").setDescription("Role")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))
    .addRoleOption(o => o.setName("role4").setDescription("Role"))
    .addRoleOption(o => o.setName("role5").setDescription("Role"))

].map(c => c.toJSON());

// ===== REGISTER =====
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands registered");
});

// ===== HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const member = interaction.options.getMember("user");

    const isAllowed = allowedUsers.includes(userId);
    const hasPurgeRole = interaction.member.roles.cache.has(PURGE_ROLE_ID);

    // ===== PERMISSION LOGIC =====
    if (interaction.commandName === "purge") {
      if (!isAllowed && !hasPurgeRole)
        return interaction.editReply("❌ No permission");
    } else if (!["ping", "warnlist", "warninfo"].includes(interaction.commandName)) {
      if (!isAllowed)
        return interaction.editReply("❌ No permission");
    }

    // ===== WARNLIST (PUBLIC) =====
    if (interaction.commandName === "warnlist") {
      const users = await Warn.find({ warns: { $gt: 0 } });

      if (!users.length)
        return interaction.editReply("✅ No warned users");

      const text = users.map(u => `<@${u.userId}> - ${u.warns}/3`).join("\n");

      return interaction.editReply(text);
    }

    // ===== WARNINFO (PUBLIC) =====
    if (interaction.commandName === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });

      if (!data || data.warns === 0)
        return interaction.editReply("✅ No warns");

      const history = data.history
        .map((h, i) => `${i + 1}. ${h.reason} | ${h.date}`)
        .join("\n");

      return interaction.editReply(
        `User: ${member.user.tag}\nWarns: ${data.warns}/3\n\n${history}`
      );
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amt = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amt, true);
      return interaction.editReply(`🧹 Deleted ${amt}`);
    }

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
