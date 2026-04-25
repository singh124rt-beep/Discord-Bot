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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"));

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

// ===== LOG SYSTEM =====
async function sendLog(guild, title, desc, color = 0xff0000) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp();

  ch.send({ embeds: [embed] }).catch(() => {});
}

// ===== ANTI SPAM =====
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 5000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(10 * 60 * 1000).catch(() => {});
      msg.channel.send(`🚫 ${msg.author.tag} muted for spam`);
      spam.delete(msg.author.id);
      return;
    }
  } else {
    spam.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message").setDescription("Message").setRequired(true)
    ),

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
    .addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Count").setRequired(true)),

  // WARN SYSTEM
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Show warns"),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn info")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Commands synced");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {

  // ===== TICKET SYSTEM =====
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

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: `Ticket created by <@${i.user.id}>`,
      components: [row]
    });

    await sendLog(i.guild, "🎟️ Ticket Created", `User: <@${i.user.id}>`, 0x00ff99);

    return i.reply({ content: `Ticket: ${channel}`, ephemeral: true });
  }

  // ===== CLAIM =====
  if (i.isButton() && i.customId === "claim") {
    if (!i.member.roles.cache.has(STAFF_ROLE))
      return i.reply({ content: "No permission", ephemeral: true });

    return i.reply({ content: "Ticket claimed", ephemeral: true });
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

    await sendLog(i.guild, "👢 Kick", `User: <@${member.id}>`, 0xffa500);
    return i.editReply("Kicked");
  }

  if (cmd === "ban") {
    await member.ban();

    await sendLog(i.guild, "🔨 Ban", `User: <@${member.id}>`, 0xff0000);
    return i.editReply("Banned");
  }

  if (cmd === "timeout") {
    await member.timeout(i.options.getInteger("time") * 60000);

    await sendLog(i.guild, "⏱️ Timeout", `User: <@${member.id}>`, 0xffff00);
    return i.editReply("Timed out");
  }

  if (cmd === "untimeout") {
    await member.timeout(null);
    return i.editReply("Removed");
  }

  if (cmd === "purge") {
    const amt = i.options.getInteger("amount");
    await i.channel.bulkDelete(amt);

    await sendLog(i.guild, "🧹 Purge", `Deleted: ${amt}`, 0x00bfff);
    return i.editReply("Deleted");
  }

  // ===== WARN =====
  if (cmd === "warn") {
    const user = i.options.getUser("user");
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    data.history.push({ reason, date: new Date() });

    await data.save();

    await sendLog(i.guild, "⚠️ Warn", `User: <@${user.id}>\nReason: ${reason}`, 0xffff00);

    return i.editReply(`Warned ${user.tag}`);
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
