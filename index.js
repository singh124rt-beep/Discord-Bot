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

// ================= DATABASE =================
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

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("file1").setDescription("File1"))
    .addAttachmentOption(o => o.setName("file2").setDescription("File2"))
    .addAttachmentOption(o => o.setName("file3").setDescription("File3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("All warns"),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove last warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
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

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    // ================= PING =================
    if (i.commandName === "ping")
      return i.editReply(`🏓 ${client.ws.ping}ms`);

    // ================= SERVER =================
    if (i.commandName === "serverinfo")
      return i.editReply(`Members: ${i.guild.memberCount}`);

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i.member)) return i.editReply("No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["file1","file2","file3"].forEach(f=>{
        const file = i.options.getAttachment(f);
        if(file) files.push(file.url);
      });

      await ch.send({ content: msg, files });
      return i.editReply("Sent 📤");
    }

    // ================= MOD COMMANDS =================
    if (["kick","ban","timeout","untimeout","purge","addrole","removerole","warn","unwarn","clearwarn","warnlist"].includes(i.commandName)) {
      if (!isAllowed(i.member)) return i.editReply("No permission");
    }

    // ===== KICK =====
    if (i.commandName === "kick") {
      const user = i.options.getUser("user");
      const reason = i.options.getString("reason");
      await i.guild.members.kick(user.id, reason);
      return i.editReply(`Kicked ${user.tag}`);
    }

    // ===== BAN =====
    if (i.commandName === "ban") {
      const user = i.options.getUser("user");
      const reason = i.options.getString("reason");
      await i.guild.members.ban(user.id, { reason });
      return i.editReply(`Banned ${user.tag}`);
    }

    // ===== TIMEOUT =====
    if (i.commandName === "timeout") {
      const user = i.options.getUser("user");
      const time = i.options.getInteger("time");
      const member = await i.guild.members.fetch(user.id);
      await member.timeout(time * 60000);
      return i.editReply(`Timed out ${user.tag}`);
    }

    // ===== UNTIMEOUT =====
    if (i.commandName === "untimeout") {
      const user = i.options.getUser("user");
      const member = await i.guild.members.fetch(user.id);
      await member.timeout(null);
      return i.editReply(`Timeout removed`);
    }

    // ===== WARN =====
    if (i.commandName === "warn") {
      const user = i.options.getUser("user");
      const reason = i.options.getString("reason");

      let data = await Warn.findOne({ userId: user.id });
      if (!data) data = await Warn.create({ userId: user.id, warns: [] });

      data.warns.push({ reason, by: i.user.id, time: new Date() });
      await data.save();

      return i.editReply(`Warned ${user.tag}`);
    }

    // ===== WARNLIST =====
    if (i.commandName === "warnlist") {
      const all = await Warn.find();
      if (!all.length) return i.editReply("No warns");

      let txt = all.map(x => `<@${x.userId}> - ${x.warns.length} warns`).join("\n");
      return i.editReply(txt);
    }

    // ===== UNWARN =====
    if (i.commandName === "unwarn") {
      const user = i.options.getUser("user");
      const data = await Warn.findOne({ userId: user.id });
      if (!data || !data.warns.length) return i.editReply("No warns");

      data.warns.pop();
      await data.save();

      return i.editReply("Removed last warn");
    }

    // ===== CLEAR WARN =====
    if (i.commandName === "clearwarn") {
      const user = i.options.getUser("user");
      await Warn.deleteOne({ userId: user.id });
      return i.editReply("Cleared warns");
    }

    // ===== PURGE =====
    if (i.commandName === "purge") {
      const amt = i.options.getInteger("amount");
      await i.channel.bulkDelete(amt);
      return i.editReply("Deleted");
    }

    // ===== ROLE =====
    if (i.commandName === "addrole") {
      const user = i.options.getUser("user");
      const role = i.options.getRole("role");
      const member = await i.guild.members.fetch(user.id);
      await member.roles.add(role);
      return i.editReply("Role added");
    }

    if (i.commandName === "removerole") {
      const user = i.options.getUser("user");
      const role = i.options.getRole("role");
      const member = await i.guild.members.fetch(user.id);
      await member.roles.remove(role);
      return i.editReply("Role removed");
    }

  } catch (e) {
    console.error(e);
    if (!i.replied) i.reply({ content: "Error", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
