const express = require("express");
const mongoose = require("mongoose");
const transcripts = require("discord-html-transcripts");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require("discord.js");

// ===== CONFIG =====
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ===== EXPRESS =====
const app = express();
app.get("/", (_, res) => res.send("Alive"));
app.listen(3000);

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI);

// ===== WARN DB =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: Array
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ===== GREETING =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase() === "hi") {
    const embed = new EmbedBuilder()
      .setDescription("hi 👋")
      .setImage("https://i.imgur.com/8Km9tLL.png")
      .setColor(0x00ffcc);

    msg.reply({ embeds: [embed] });
  }
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot ping"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server information"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Announcement message")
        .setRequired(true))
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Target channel (optional)"))
    .addStringOption(o =>
      o.setName("image")
        .setDescription("Image URL (optional)")),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send ticket panel"),

  // ===== MOD =====
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to kick")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to timeout")
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName("time")
        .setDescription("Time in minutes")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Number of messages")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log("Bot Ready");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_menu")
      .setPlaceholder("Select Ticket Type")
      .addOptions([
        { label: "Support", value: "support" },
        { label: "Report", value: "report" },
        { label: "Help", value: "help" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    return i.reply({ content: "🎟️ Create a ticket", components: [row] });
  }

  // ===== CREATE TICKET =====
  if (i.isStringSelectMenu()) {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: `🎟️ Ticket by <@${i.user.id}>`, components: [buttons] });

    return i.reply({ content: `Created: ${channel}`, ephemeral: true });
  }

  // ===== BUTTONS =====
  if (i.isButton()) {

    if (i.customId === "claim") {
      if (!i.member.roles.cache.has(STAFF_ROLE))
        return i.reply({ content: "No permission", ephemeral: true });

      return i.reply({ content: "✅ Claimed", ephemeral: true });
    }

    if (i.customId === "close") {
      const file = await transcripts.createTranscript(i.channel);
      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      await i.channel.delete();
      return;
    }
  }

  if (!i.isChatInputCommand()) return;

  await i.deferReply({ ephemeral: true });

  const user = i.options.getUser("user");
  const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

  // ===== ANNOUNCE =====
  if (i.commandName === "announce") {
    const msg = i.options.getString("message");
    const ch = i.options.getChannel("channel") || i.channel;
    const img = i.options.getString("image");

    const embed = new EmbedBuilder()
      .setDescription(msg)
      .setColor(0x00ffcc);

    if (img) embed.setImage(img);

    await ch.send({ embeds: [embed] });

    return i.editReply("✅ Announcement sent");
  }

  // ===== TIMEOUT =====
  if (i.commandName === "timeout") {
    const time = i.options.getInteger("time");
    const reason = i.options.getString("reason") || "No reason";

    await member.timeout(time * 60000);

    i.channel.send(`⏱️ ${user.tag} timed out (${time}m)\n📄 ${reason}`);

    return i.editReply("Timed out");
  }

  // ===== UNTIMEOUT =====
  if (i.commandName === "untimeout") {
    await member.timeout(null);
    i.channel.send(`✅ ${user.tag} timeout removed`);
    return i.editReply("Removed");
  }

  // ===== WARN =====
  if (i.commandName === "warn") {
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    await data.save();

    i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)\n📄 ${reason}`);

    if (data.warns >= 3) {
      await member.timeout(86400000);
      i.channel.send(`🚫 ${user.tag} got 24h timeout`);
      data.warns = 0;
      await data.save();
    }

    return i.editReply("Warned");
  }

});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
