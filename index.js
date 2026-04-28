const express = require("express");
const mongoose = require("mongoose");
const transcripts = require("discord-html-transcripts");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const MONGO = process.env.MONGO_URI;

const ADMIN_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ================= DB =================
mongoose.connect(MONGO);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: [{ reason: String, by: String, time: Date }]
}));

const TicketCounter = mongoose.model("TicketCounter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= PERMISSION =================
function isAllowed(member) {
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    ALLOWED_USERS.includes(member.id) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

function isStrict(member) {
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    ALLOWED_USERS.includes(member.id)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("file1").setDescription("Media 1"))
    .addAttachmentOption(o => o.setName("file2").setDescription("Media 2"))
    .addAttachmentOption(o => o.setName("file3").setDescription("Media 3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),

  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove last warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warns"),

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
    .setDescription("Add role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {
    if (!i.guild) return;

    if (i.isChatInputCommand()) {
      await i.deferReply({ ephemeral: true });
    }

    // ===== PING =====
    if (i.commandName === "ping")
      return i.editReply(`🏓 ${client.ws.ping}ms`);

    // ===== ANNOUNCE =====
    if (i.commandName === "announce") {
      if (!isAllowed(i.member)) return i.editReply("No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["file1", "file2", "file3"].forEach(f => {
        const file = i.options.getAttachment(f);
        if (file) files.push(file.url);
      });

      await ch.send({ content: msg, files });
      return i.editReply("Sent 📤");
    }

    // ===== WARN =====
    if (i.commandName === "warn") {
      if (!isAllowed(i.member)) return i.editReply("No permission");

      const user = i.options.getUser("user");
      const reason = i.options.getString("reason");

      let data = await Warn.findOne({ userId: user.id });
      if (!data) data = await Warn.create({ userId: user.id, warns: [] });

      data.warns.push({ reason, by: i.user.id, time: new Date() });
      await data.save();

      if (data.warns.length >= 3) {
        const member = await i.guild.members.fetch(user.id);
        await member.timeout(24 * 60 * 60 * 1000, "3 warns");
      }

      return i.editReply(`${user} warned (${data.warns.length}/3)`);
    }

    // ===== CLEAR WARN =====
    if (i.commandName === "clearwarn") {
      if (!isAllowed(i.member)) return i.editReply("No permission");

      const user = i.options.getUser("user");
      await Warn.deleteOne({ userId: user.id });

      return i.editReply(`${user} warns cleared (0/3)`);
    }

    // ===== UNWARN =====
    if (i.commandName === "unwarn") {
      if (!isAllowed(i.member)) return i.editReply("No permission");

      const user = i.options.getUser("user");
      const data = await Warn.findOne({ userId: user.id });

      if (!data || data.warns.length === 0)
        return i.editReply("No warns");

      data.warns.pop();
      await data.save();

      return i.editReply(`${user} unwarned (${data.warns.length}/3)`);
    }

    // ===== CLOSE BUTTON =====
    if (i.isButton() && i.customId === "close_ticket") {
      if (!isStrict(i.member)) return i.reply({ content: "No permission", ephemeral: true });

      await i.deferReply({ ephemeral: true });

      const file = await transcripts.createTranscript(i.channel);
      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      await i.editReply("Closing...");
      setTimeout(() => i.channel.delete(), 2000);
    }

  } catch (e) {
    console.error(e);
    if (!i.replied) i.reply({ content: "Error", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
