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

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= CONFIG =================
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";
const TRANSCRIPT_CHANNEL = LOG_CHANNEL;

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
mongoose.connect(process.env.MONGO_URI);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
}));

const Ticket = mongoose.model("Ticket", new mongoose.Schema({
  userId: String,
  channelId: String,
  claimedBy: String
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

// ================= ANTI SPAM =================
const spam = new Map();

function antiSpam(id) {
  const now = Date.now();
  const d = spam.get(id) || { count: 0, last: now };

  if (now - d.last < 3000) d.count++;
  else d.count = 1;

  d.last = now;
  spam.set(id, d);

  return d.count > 5;
}

// ================= HELPERS =================
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    i.member.roles.cache.has(STAFF_ROLE)
  );
}

function log(guild, msg) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (ch) ch.send(msg).catch(() => {});
}

// ================= COMMANDS =================
const commands = [

  // BASIC
  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  // ANNOUNCE
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("image1").setDescription("Image 1"))
    .addAttachmentOption(o => o.setName("image2").setDescription("Image 2"))
    .addAttachmentOption(o => o.setName("image3").setDescription("Image 3")),

  // MODERATION
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
    .addStringOption(o => o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  // WARN SYSTEM
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Check warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  // UTIL
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Count").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  // TICKET
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket")

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("✅ Commands loaded");
});

// ================= INTERACTION =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ================= PING =================
    if (i.commandName === "ping") {
      return i.editReply(`🏓 ${client.ws.ping}ms`);
    }

    // ================= SERVERINFO =================
    if (i.commandName === "serverinfo") {
      const e = new EmbedBuilder()
        .setTitle(i.guild.name)
        .setDescription(`Members: ${i.guild.memberCount}`)
        .setColor("Blue");

      return i.editReply({ embeds: [e] });
    }

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      await ch.send({ content: msg });
      log(i.guild, "Announcement sent");

      return i.editReply("Sent");
    }

    // ================= WARN =================
    if (i.commandName === "warn") {
      const reason = i.options.getString("reason");

      let d = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });
      d.warns++;
      await d.save();

      i.channel.send(`⚠️ ${user} warned | ${reason}`);

      if (d.warns >= 3) {
        d.warns = 0;
        await d.save();

        await member.timeout(86400000, "Auto 3 warns");
      }

      return i.editReply("Warned");
    }

    if (i.commandName === "unwarn") {
      let d = await Warn.findOne({ userId: user.id });
      if (d && d.warns > 0) d.warns--;
      await d.save();
      return i.editReply("Removed 1 warn");
    }

    if (i.commandName === "clearwarn") {
      await Warn.deleteOne({ userId: user.id });
      return i.editReply("Cleared");
    }

    if (i.commandName === "warnlist") {
      let d = await Warn.findOne({ userId: user.id });
      return i.editReply(`Warns: ${d ? d.warns : 0}`);
    }

    // ================= TIMEOUT =================
    if (i.commandName === "timeout") {
      await member.timeout(i.options.getInteger("time") * 60000, i.options.getString("reason"));
      return i.editReply("Timed out");
    }

    if (i.commandName === "untimeout") {
      await member.timeout(null);
      return i.editReply("Removed timeout");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "Support", value: "support" },
          { label: "Report", value: "report" }
        ]);

      return i.channel.send({
        content: "🎫 Open ticket",
        components: [new ActionRowBuilder().addComponents(menu)]
      });
    }

    // ================= CREATE TICKET =================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      const ch = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel"] },
          { id: STAFF_ROLE, allow: ["ViewChannel"] }
        ]
      });

      await Ticket.create({ userId: i.user.id, channelId: ch.id });

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success)
      );

      await ch.send({ content: "Ticket opened", components: [btn] });

      return i.reply({ content: "Created", ephemeral: true });
    }

    // ================= CLAIM =================
    if (i.isButton() && i.customId === "claim") {
      return i.update({
        content: `Claimed by ${i.user}`,
        components: []
      });
    }

    // ================= CLOSE =================
    if (i.commandName === "close") {

      const file = await transcripts.createTranscript(i.channel);

      const logCh = i.guild.channels.cache.get(TRANSCRIPT_CHANNEL);
      if (logCh) logCh.send({ files: [file] });

      await i.editReply("Closing...");
      setTimeout(() => i.channel.delete(), 2000);
    }

  } catch (e) {
    console.error(e);
  }
});

// ================= MESSAGE =================
client.on("messageCreate", (m) => {
  if (m.author.bot) return;

  if (antiSpam(m.author.id)) {
    m.delete().catch(() => {});
    m.channel.send(`⚠️ ${m.author} stop spam`);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
