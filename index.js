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
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const MONGO = process.env.MONGO_URI;

const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ===== EXPRESS (KEEP ALIVE) =====
const app = express();
app.get("/", (_, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(MONGO).then(() => console.log("Mongo Connected"));

// ===== WARN MODEL =====
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

// ===== ANTI SPAM =====
const spamMap = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = spamMap.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 5000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(10 * 60 * 1000).catch(() => {});
      msg.channel.send(`🚫 ${msg.author.tag} muted for spam`);
      spamMap.delete(msg.author.id);
      return;
    }
  } else {
    spamMap.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ===== COMMANDS (FIXED SAFE VERSION) =====
const commands = [

  // BASIC
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server information"),

  // ANNOUNCE
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    ),

  // TICKET
  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send ticket panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close current ticket"),

  // MODERATION
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to kick")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("time")
        .setDescription("Minutes")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Number of messages")
        .setRequired(true)
    ),

  // WARN SYSTEM
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warnings"),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Check user warnings")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warning")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warnings")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Commands synced");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {

  // ===== TICKET DROPDOWN =====
  if (i.isStringSelectMenu() && i.customId === "ticket_select") {

    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    return i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  if (!i.isChatInputCommand()) return;

  const cmd = i.commandName;
  await i.deferReply({ ephemeral: true });

  const member = i.options.getMember("user");

  // ===== BASIC =====
  if (cmd === "ping") return i.editReply("🏓 Pong");

  if (cmd === "serverinfo") {
    return i.editReply({
      embeds: [new EmbedBuilder().setTitle("City RP Server")]
    });
  }

  // ===== ANNOUNCE =====
  if (cmd === "announce") {
    i.channel.send(i.options.getString("message"));
    return i.editReply("Sent");
  }

  // ===== MODERATION =====
  if (cmd === "kick") {
    await member.kick();
    return i.editReply("Kicked");
  }

  if (cmd === "ban") {
    await member.ban();
    return i.editReply("Banned");
  }

  if (cmd === "timeout") {
    await member.timeout(i.options.getInteger("time") * 60000);
    return i.editReply("Timed out");
  }

  if (cmd === "untimeout") {
    await member.timeout(null);
    return i.editReply("Timeout removed");
  }

  if (cmd === "purge") {
    await i.channel.bulkDelete(i.options.getInteger("amount"));
    return i.editReply("Deleted messages");
  }

  // ===== WARN =====
  if (cmd === "warn") {
    const user = i.options.getUser("user");
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    data.history.push({ reason, date: new Date() });

    await data.save();

    return i.editReply(`Warned ${user.tag}`);
  }
});

// ===== LOGIN (FIXED) =====
client.login(TOKEN);
