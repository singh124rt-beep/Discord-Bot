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

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ================= CONFIG =================
const ADMIN_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ================= DB =================
mongoose.connect(process.env.MONGO_URI);

const TicketCounter = mongoose.model("TicketCounter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: [{ reason: String, by: String, time: Date }]
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
    ALLOWED_USERS.includes(member.user.id) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  // ANNOUNCEMENT
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("media1").setDescription("Media 1"))
    .addAttachmentOption(o => o.setName("media2").setDescription("Media 2"))
    .addAttachmentOption(o => o.setName("media3").setDescription("Media 3")),

  // TICKETS
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

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
    .setName("warnlist")
    .setDescription("Show all warns"),

  // UTIL
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Messages").setRequired(true)),

  // ROLES
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

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {
    if (!i.guild) return;

    // ================= PING =================
    if (i.commandName === "ping")
      return i.reply({ content: `🏓 ${client.ws.ping}ms`, ephemeral: true });

    // ================= SERVER INFO =================
    if (i.commandName === "serverinfo")
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(i.guild.name)
            .setDescription(`Members: ${i.guild.memberCount}`)
        ],
        ephemeral: true
      });

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i.member))
        return i.reply({ content: "No permission", ephemeral: true });

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["media1", "media2", "media3"].forEach(k => {
        const f = i.options.getAttachment(k);
        if (f) files.push(f.url);
      });

      await ch.send({ content: msg, files: files.length ? files : undefined });

      return i.reply({ content: "Sent 📤", ephemeral: true });
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i.member))
        return i.reply({ content: "No permission", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket System")
        .setDescription("To open a ticket 🎟️ Click below 👇");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      await i.channel.send({ embeds: [embed], components: [row] });
      return i.reply({ content: "Panel sent", ephemeral: true });
    }

    // ================= OPEN TICKET =================
    if (i.isButton() && i.customId === "open_ticket") {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment" }
        ]);

      return i.reply({
        content: "Select ticket type",
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

      const channel = await i.guild.channels.create({
        name: `ticket-${counter.count}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      const embed = new EmbedBuilder()
        .setDescription(
`Admin Role: <@&${ADMIN_ROLE}>
Name: <@${i.user.id}>
Type: ${i.values[0]}
Describe your issue:

Our Team Will Assist You Shortly`
        );

      await channel.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [embed]
      });

      return i.editReply(`Ticket created: ${channel}`);
    }

    // ================= CLOSE =================
    if (i.commandName === "close") {
      if (!isAllowed(i.member))
        return i.reply({ content: "No permission", ephemeral: true });

      const file = await transcripts.createTranscript(i.channel);

      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      await i.reply({ content: "Closing ticket..." });
      setTimeout(() => i.channel.delete(), 3000);
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) i.reply({ content: "Error occurred", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
