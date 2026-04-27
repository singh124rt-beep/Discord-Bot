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

// ================= CRASH GUARDS =================
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
app.get("/", (_, res) => res.send("Bot Running OK"));
app.listen(3000);

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  reason: String,
  date: { type: Date, default: Date.now }
}));

const Counter = mongoose.model("Counter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

const Ticket = mongoose.model("Ticket", new mongoose.Schema({
  userId: String,
  channelId: String,
  ticketId: Number,
  type: String
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

// ================= PERMISSION CHECK =================
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
    .addChannelOption(o => o.setName("channel"))
    .addAttachmentOption(o => o.setName("image1"))
    .addAttachmentOption(o => o.setName("image2"))
    .addAttachmentOption(o => o.setName("image3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder().setName("unwarn").setDescription("Remove warn"),
  new SlashCommandBuilder().setName("clearwarn").setDescription("Clear warns"),
  new SlashCommandBuilder().setName("warnlist").setDescription("Show warns"),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("time").setRequired(true)),

  new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout"),

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

  console.log("✅ Commands registered");
});

// ================= INTERACTION SYSTEM =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.user.id === BLOCKED_USER)
      return i.reply({ content: "❌ Blocked user", ephemeral: true });

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    // ================= ANNOUNCEMENT FIX =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      for (let x = 1; x <= 3; x++) {
        const img = i.options.getAttachment(`image${x}`);
        if (img) files.push(img.url);
      }

      await ch.send({ content: msg, files });
      return i.editReply("📤 Sent");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Support Tickets")
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
        .setCustomId("ticket_type")
        .setPlaceholder("Select Ticket Type")
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

      await Ticket.create({
        userId: i.user.id,
        channelId: channel.id,
        ticketId: id,
        type: i.values[0]
      });

      await channel.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎫 Ticket #${id}`)
            .addFields(
              { name: "Name", value: `<@${i.user.id}>` },
              { name: "Type", value: i.values[0] },
              { name: "Describe your issue", value: "Write here..." }
            )
            .setFooter({ text: "Our team will assist you shortly" })
        ]
      });

      return i.editReply("✅ Ticket Created");
    }

    // ================= CLOSE TICKET =================
    if (i.commandName === "close") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const file = await transcripts.createTranscript(i.channel);
      await i.channel.delete();

      return;
    }

  } catch (err) {
    console.error(err);
    if (i.replied || i.deferred)
      i.editReply("❌ Error occurred");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
