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

const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";
const TRANSCRIPT_CHANNEL = LOG_CHANNEL;

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

// ================= PERMISSIONS =================

// ONLY ADMIN PANEL (ticketpanel + close)
function isAdminCmd(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

// ONLY ALLOWED USERS (all other commands)
function isAllowedOnly(i) {
  return ALLOWED_USERS.includes(i.user.id);
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("image1").setDescription("Image 1"))
    .addAttachmentOption(o => o.setName("image2").setDescription("Image 2"))
    .addAttachmentOption(o => o.setName("image3").setDescription("Image 3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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
    .setDescription("Show warns")
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

  console.log("✅ Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.user.id === BLOCKED_USER) {
      return i.reply({ content: "❌ You are blocked", ephemeral: true });
    }

    // ================= SLASH COMMANDS =================
    if (i.isChatInputCommand()) {

      // ===== PUBLIC =====
      if (i.commandName === "ping")
        return i.reply({ content: `🏓 ${client.ws.ping}ms`, ephemeral: true });

      if (i.commandName === "serverinfo")
        return i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(i.guild.name)
              .setDescription(`Members: ${i.guild.memberCount}`)
              .setColor("Blue")
          ],
          ephemeral: true
        });

      // ===== ADMIN ONLY =====
      if (i.commandName === "announce") {
        if (!isAllowedOnly(i)) return i.reply({ content: "❌ No permission", ephemeral: true });

        const msg = i.options.getString("message");
        const ch = i.options.getChannel("channel") || i.channel;

        const files = [];
        ["image1", "image2", "image3"].forEach(n => {
          const f = i.options.getAttachment(n);
          if (f) files.push(f.url);
        });

        await ch.send({ content: msg, files });
        return i.reply({ content: "✅ Sent", ephemeral: true });
      }

      // ================= TICKET PANEL (ADMIN ONLY) =================
      if (i.commandName === "ticketpanel") {
        if (!isAdminCmd(i)) {
          return i.reply({ content: "❌ No permission", ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎟️ Ticket System")
          .setDescription("To open a ticket 🎟️ Click below 👇")
          .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_ticket")
            .setLabel("Create Ticket")
            .setStyle(ButtonStyle.Primary)
        );

        return i.reply({ embeds: [embed], components: [row] });
      }

      // ================= CLOSE (ADMIN ONLY) =================
      if (i.commandName === "close") {
        if (!isAdminCmd(i)) {
          return i.reply({ content: "❌ No permission", ephemeral: true });
        }

        if (!i.channel.name.startsWith("ticket-")) {
          return i.reply({ content: "❌ Not a ticket channel", ephemeral: true });
        }

        const file = await transcripts.createTranscript(i.channel);

        const logCh = i.guild.channels.cache.get(TRANSCRIPT_CHANNEL);
        if (logCh) logCh.send({ files: [file] });

        await i.reply("🔒 Closing ticket...");
        setTimeout(() => i.channel.delete(), 2000);
      }
    }

    // ================= BUTTON =================
    if (i.isButton() && i.customId === "open_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment Issue" }
        ]);

      return i.reply({
        content: "Select ticket type:",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= TICKET CREATE =================
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
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      await Ticket.create({
        userId: i.user.id,
        channelId: ch.id,
        ticketId: id
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${id}`)
        .setColor("Green")
        .setDescription(
`Name : ${i.user}  
Type : ${i.values[0]}  

Describe your issue:

Our Team will assist you shortly`
        );

      await ch.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [embed]
      });

      return i.editReply(`✅ Ticket created #${id}`);
    }

  } catch (err) {
    console.error(err);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
