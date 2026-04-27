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
  EmbedBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require("discord.js");

// ================= SAFETY =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= CONFIG =================
const ADMIN_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

const BLOCKED_USER = "1366502670788984902";

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

const Counter = mongoose.model("Counter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
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
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("image1"))
    .addAttachmentOption(o => o.setName("image2"))
    .addAttachmentOption(o => o.setName("image3"))
    .addAttachmentOption(o => o.setName("video1"))
    .addAttachmentOption(o => o.setName("video2")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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
    .setDescription("Warn list of all users"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Messages").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true))

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

    if (i.user.id === BLOCKED_USER)
      return i.reply({ content: "❌ Blocked user", ephemeral: true });

    if (i.isChatInputCommand())
      await i.deferReply({ ephemeral: true });

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      for (let x = 1; x <= 3; x++) {
        const img = i.options.getAttachment(`image${x}`);
        if (img) files.push(img);
      }
      for (let x = 1; x <= 2; x++) {
        const vid = i.options.getAttachment(`video${x}`);
        if (vid) files.push(vid);
      }

      await ch.send({ content: msg, files });
      return i.editReply("📤 Sent");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      await i.channel.send({
        content: "🎟️ To open a ticket click below 👇",
        components: [btn]
      });

      return i.editReply("📤 Panel Sent");
    }

    // ================= OPEN TICKET =================
    if (i.isButton() && i.customId === "open_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_type")
        .setPlaceholder("Select Type")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment Issue" }
        ]);

      return i.reply({
        content: "Select ticket type",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= CREATE TICKET =================
    if (i.isStringSelectMenu() && i.customId === "ticket_type") {

      const counter = await Counter.findOneAndUpdate(
        { guildId: i.guild.id },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );

      const id = counter.count;

      const channel = await i.guild.channels.create({
        name: `ticket-${id}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎫 Ticket #${id}`)
            .addFields(
              { name: "👤 Player", value: `<@${i.user.id}>` },
              { name: "🎫 Type", value: i.values[0] },
              { name: "📄 Issue", value: "Describe your issue" }
            )
            .setFooter({ text: "Our team will assist you shortly" })
        ],
        components: [closeBtn]
      });

      return i.editReply("✅ Ticket Created");
    }

    // ================= CLOSE BUTTON =================
    if (i.isButton() && i.customId === "close_ticket") {
      if (!isAllowed(i))
        return i.reply({ content: "❌ No permission", ephemeral: true });

      await i.reply({ content: "🔒 Closing..." });

      const file = await transcripts.createTranscript(i.channel);

      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) {
        await log.send({
          files: [file],
          content: `📁 Ticket closed: ${i.channel.name}`
        });
      }

      setTimeout(() => i.channel.delete(), 1500);
    }

    // ================= CLOSE COMMAND =================
    if (i.commandName === "close") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      await i.editReply("🔒 Closing...");

      const file = await transcripts.createTranscript(i.channel);

      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) {
        await log.send({
          files: [file],
          content: `📁 Ticket closed: ${i.channel.name}`
        });
      }

      setTimeout(() => i.channel.delete(), 1500);
    }

  } catch (err) {
    console.error(err);
    if (i.replied || i.deferred)
      i.editReply("❌ Error occurred");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
