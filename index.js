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
  PermissionsBitField
} = require("discord.js");

// ================= CONFIG =================
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(3000);

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(console.error);

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

// ================= LOG SYSTEM =================
function sendLog(guild, title, desc) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;

  ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(0xff0000)
    ]
  });
}

// ================= GREETINGS =================
client.on("guildMemberAdd", (member) => {
  const ch = member.guild.systemChannel;
  if (ch) {
    ch.send(`👋 Greetings, ${member.user.username} Welcome to CRP`);
  }
});

// ================= ANTI SPAM =================
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 4000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(600000).catch(() => {});
      spam.delete(msg.author.id);
      return;
    }
  } else {
    spam.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ================= SLASH COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setRequired(true))
    .addChannelOption(o => o.setName("channel"))
    .addStringOption(o => o.setName("image")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),

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
    .addIntegerOption(o => o.setName("time").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),
  new SlashCommandBuilder().setName("warninfo").setDescription("Warn info"),
  new SlashCommandBuilder().setName("unwarn").setDescription("Remove warn"),
  new SlashCommandBuilder().setName("clearwarn").setDescription("Clear warns")

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Commands synced");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ================= TICKET PANEL =================
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const embed = new EmbedBuilder()
      .setTitle("🏙️ CRP SUPPORT CENTER")
      .setDescription("Click below to create a support ticket")
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("🎫 Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  // ================= CREATE TICKET =================
  if (i.isButton() && i.customId === "create_ticket") {

    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle("🎟️ SUPPORT TICKET")
      .setDescription(`Hello <@${i.user.id}> explain your issue`)
      .setColor(0x00aaff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  // ================= BUTTONS =================
  if (i.isButton()) {

    if (i.customId === "claim") {
      return i.reply({ content: `Claimed by ${i.user.tag}` });
    }

    if (i.customId === "close") {
      const file = await transcripts.createTranscript(i.channel);

      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      return i.channel.delete();
    }
  }

  // ================= SLASH COMMANDS =================
  if (!i.isChatInputCommand()) return;

  const user = i.options.getUser("user");
  const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

  // PING
  if (i.commandName === "ping")
    return i.reply("🏓 Pong!");

  // ANNOUNCE
  if (i.commandName === "announce") {
    const msg = i.options.getString("message");
    const ch = i.options.getChannel("channel") || i.channel;
    const img = i.options.getString("image");

    await ch.send({ content: msg });
    if (img) await ch.send({ content: img });

    return i.reply({ content: "Announcement sent", ephemeral: true });
  }

  // KICK
  if (i.commandName === "kick") {
    await member.kick();
    i.channel.send(`👢 ${user.tag} has been KICKED`);
    sendLog(i.guild, "Kick", user.tag);
    return i.reply({ content: "Done", ephemeral: true });
  }

  // BAN
  if (i.commandName === "ban") {
    await member.ban();
    i.channel.send(`🔨 ${user.tag} has been BANNED`);
    sendLog(i.guild, "Ban", user.tag);
    return i.reply({ content: "Done", ephemeral: true });
  }

  // WARN SYSTEM
  if (i.commandName === "warn") {
    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    await data.save();

    i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)`);

    if (data.warns >= 3) {
      await member.timeout(86400000);
      data.warns = 0;
      await data.save();
    }

    return i.reply({ content: "Warn issued", ephemeral: true });
  }

});

client.login(process.env.DISCORD_BOT_TOKEN);
