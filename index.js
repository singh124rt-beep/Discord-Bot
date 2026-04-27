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
const ADMIN_ROLE = "1390273593040048220";
const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

const BLOCKED_USER = "1366502670788984902";

const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
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
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  // ================= ANNOUNCEMENT =================
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setRequired(true))
    .addChannelOption(o => o.setName("channel"))
    .addAttachmentOption(o => o.setName("image1"))
    .addAttachmentOption(o => o.setName("image2"))
    .addAttachmentOption(o => o.setName("image3"))
    .addAttachmentOption(o => o.setName("video1"))
    .addAttachmentOption(o => o.setName("video2")),

  // ================= TICKET =================
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  // ================= MODERATION =================
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("time").setRequired(true))
    .addStringOption(o => o.setName("reason")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setRequired(true)),

  // ================= WARN =================
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warns"),

  // ================= ROLE =================
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  // ================= PURGE =================
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true))

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

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.user.id === BLOCKED_USER)
      return i.reply({ content: "❌ Blocked user", ephemeral: true });

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    // ================= ANNOUNCE FIX =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["image1","image2","image3","video1","video2"].forEach(k => {
        const f = i.options.getAttachment(k);
        if (f) files.push(f.url);
      });

      await ch.send({ content: msg, files });
      return i.editReply("📤 Sent");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket System")
        .setDescription("To open a ticket 🎟️ Click below 👇");

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      return i.channel.send({ embeds: [embed], components: [btn] });
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
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= CREATE TICKET =================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      await i.deferReply({ ephemeral: true });

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
          { id: ADMIN_ROLE, allow: ["ViewChannel"] }
        ]
      });

      await ch.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎫 Ticket #${id}`)
            .setDescription(
`Name: <@${i.user.id}>
Type: ${i.values[0]}

Describe your issue:

Our Team will assist you shortly`
            )
        ]
      });

      return i.editReply(`✅ Ticket created #${id}`);
    }

    // ================= CLOSE =================
    if (i.commandName === "close") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const file = await transcripts.createTranscript(i.channel);
      const log = i.guild.channels.cache.get(LOG_CHANNEL);

      if (log) log.send({ files: [file] });

      await i.editReply("Closing...");
      setTimeout(() => i.channel.delete(), 2000);
    }

  } catch (e) {
    console.error(e);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
