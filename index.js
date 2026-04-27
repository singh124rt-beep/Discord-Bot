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

// ================= SAFETY =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= CONFIG =================
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";
const TRANSCRIPT_CHANNEL = LOG_CHANNEL;

const BLOCKED_USER = "1366502670788984902";

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

const TicketCounter = mongoose.model("TicketCounter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

const Ticket = mongoose.model("Ticket", new mongoose.Schema({
  userId: String,
  channelId: String,
  ticketId: Number
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

// ================= COMMAND CHECK =================
function isAllowed(i) {
  return i.member.permissions.has(PermissionsBitField.Flags.Administrator)
    || i.member.roles.cache.has(STAFF_ROLE);
}

// ================= LOG =================
function log(guild, msg) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (ch) ch.send(msg).catch(() => {});
}

// ================= COMMANDS (FIXED SAFE BUILD) =================
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("image1").setDescription("Image 1"))
    .addAttachmentOption(o => o.setName("image2").setDescription("Image 2"))
    .addAttachmentOption(o => o.setName("image3").setDescription("Image 3")),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close ticket"),

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

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Messages").setRequired(true)),

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
  console.log(`🟢 Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("✅ Commands registered");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    // 🚫 BLOCKED USER
    if (i.user.id === BLOCKED_USER) {
      return i.reply({ content: "❌ You are blocked.", ephemeral: true });
    }

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    const user = i.options?.getUser("user");

    // ================= PING =================
    if (i.commandName === "ping") {
      return i.editReply(`🏓 ${client.ws.ping}ms`);
    }

    // ================= SERVER INFO =================
    if (i.commandName === "serverinfo") {
      return i.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(i.guild.name)
            .setDescription(`Members: ${i.guild.memberCount}`)
            .setColor("Blue")
        ]
      });
    }

    // ================= ANNOUNCE (FIXED) =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["image1", "image2", "image3"].forEach(n => {
        const f = i.options.getAttachment(n);
        if (f) files.push(f.url);
      });

      await ch.send({ content: msg, files: files.length ? files : undefined });

      return i.editReply("✅ Sent");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Tickets")
        .setDescription("To open a ticket 🎟️ Click below 👇")
        .setColor("Blue");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      return i.channel.send({ embeds: [embed], components: [row] });
    }

    // ================= OPEN TICKET =================
    if (i.isButton() && i.customId === "open_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment Issue" }
        ]);

      return i.reply({
        content: "Select type:",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= CREATE TICKET =================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      let counter = await TicketCounter.findOne({ guildId: i.guild.id });
      if (!counter) counter = await TicketCounter.create({ guildId: i.guild.id, count: 0 });

      counter.count++;
      await counter.save();

      const id = counter.count;

      const ch = await i.guild.channels.create({
        name: `ticket-${id}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel"] },
          { id: STAFF_ROLE, allow: ["ViewChannel"] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${id}`)
        .setColor("Green")
        .addFields(
          { name: "User", value: `<@${i.user.id}>` },
          { name: "Type", value: i.values[0] }
        );

      await ch.send({
        content: `<@&${STAFF_ROLE}>`,
        embeds: [embed]
      });

      return i.reply({ content: `Ticket #${id} created`, ephemeral: true });
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

// ================= ANTI SPAM =================
client.on("messageCreate", (m) => {
  if (m.author.bot) return;
  if (antiSpam(m.author.id)) {
    m.delete().catch(() => {});
    m.channel.send(`⚠️ Spam detected`);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
