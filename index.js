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

// ================= CONFIG =================
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Alive"));
app.listen(3000);

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI);

// ================= WARN DB =================
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: { type: Array, default: [] }
}));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ================= LOG SYSTEM =================
async function log(guild, title, desc, color = 0xff0000) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;

  ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(color)
        .setTimestamp()
    ]
  }).catch(() => {});
}

// ================= ANTI SPAM =================
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 5000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(600000).catch(()=>{});
      msg.channel.send(`🚫 ${msg.author.tag} muted for spam`);
      spam.delete(msg.author.id);
      return;
    }
  } else {
    spam.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setRequired(true))
    .addChannelOption(o => o.setName("channel"))
    .addStringOption(o => o.setName("image")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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

  // WARN SYSTEM
  new SlashCommandBuilder().setName("warn").setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),

  new SlashCommandBuilder().setName("warninfo").setDescription("Warn history")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder().setName("clearwarn").setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setRequired(true)),

  // ROLE SYSTEM
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("Commands synced");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  // ================= TICKET PANEL =================
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select ticket type")
      .addOptions([
        { label: "Support", value: "support" },
        { label: "Report", value: "report" },
        { label: "Help", value: "help" }
      ]);

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Ticket System")
      .setDescription("Select type to create ticket")
      .setColor(0x2b2d31);

    return i.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ================= CREATE TICKET =================
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

    const embed = new EmbedBuilder()
      .setTitle("🎟️ Ticket Opened")
      .setDescription(`User: <@${i.user.id}>`)
      .setColor(0x00aaff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
  }

  // ================= BUTTONS =================
  if (i.isButton()) {

    if (i.customId === "claim") {
      if (!i.member.roles.cache.has(STAFF_ROLE))
        return i.reply({ content: "No permission", ephemeral: true });

      return i.reply(`Claimed by ${i.user.tag}`);
    }

    if (i.customId === "close_ticket") {
      const file = await transcripts.createTranscript(i.channel);
      const logCh = i.guild.channels.cache.get(LOG_CHANNEL);

      if (logCh) logCh.send({ files: [file] });

      await i.channel.delete();
    }
  }

  // ================= COMMANDS =================
  if (!i.isChatInputCommand()) return;

  const user = i.options.getUser("user");
  const member = user ? await i.guild.members.fetch(user.id).catch(()=>null) : null;

  await i.deferReply({ ephemeral: true });

  // ================= PING =================
  if (i.commandName === "ping")
    return i.editReply("🏓 Pong!");

  // ================= ANNOUNCE =================
  if (i.commandName === "announce") {
    const msg = i.options.getString("message");
    const ch = i.options.getChannel("channel") || i.channel;
    const img = i.options.getString("image");

    const embed = new EmbedBuilder()
      .setDescription(msg)
      .setColor(0x00aaff);

    if (img) embed.setImage(img);

    await ch.send({ embeds: [embed] });

    return i.editReply("Announcement sent");
  }

  // ================= KICK =================
  if (i.commandName === "kick") {
    const reason = i.options.getString("reason");

    await member.kick();

    await i.channel.send(`👢 ${user.tag} has been kicked\nReason: ${reason}`);

    await user.send(`⚠️ Warning Issued\nYou have been KICKED\nReason: ${reason}`).catch(()=>{});

    return i.editReply("Kicked");
  }

  // ================= BAN =================
  if (i.commandName === "ban") {
    const reason = i.options.getString("reason");

    await member.ban();

    await i.channel.send(`🔨 ${user.tag} has been banned\nReason: ${reason}`);

    await user.send(`⚠️ Warning Issued\nYou have been BANNED\nReason: ${reason}`).catch(()=>{});

    return i.editReply("Banned");
  }

  // ================= TIMEOUT =================
  if (i.commandName === "timeout") {
    const time = i.options.getInteger("time");

    await member.timeout(time * 60000);

    await i.channel.send(`⏱️ ${user.tag} timed out (${time}m)`);

    await user.send(`⚠️ Warning Issued\nYou have been TIMEOUT\nReason: Manual`).catch(()=>{});

    return i.editReply("Timeout done");
  }

  if (i.commandName === "untimeout") {
    await member.timeout(null);

    return i.editReply("Timeout removed");
  }

  // ================= PURGE =================
  if (i.commandName === "purge") {
    const amt = i.options.getInteger("amount");

    await i.channel.bulkDelete(amt);

    return i.editReply("Messages deleted");
  }

  // ================= WARN SYSTEM =================
  if (i.commandName === "warn") {
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    data.history.push({ reason, date: new Date() });

    await data.save();

    await user.send(`⚠️ Warning Issued\nYou have been warned (${data.warns}/3)\nReason: ${reason}`).catch(()=>{});

    await i.channel.send(`⚠️ ${user.tag} has been warned (${data.warns}/3)\nReason: ${reason}`);

    if (data.warns >= 3) {
      await member.timeout(86400000);
      await i.channel.send(`🚫 ${user.tag} got 24h timeout (3/3 warns)`);
      data.warns = 0;
      await data.save();
    }

    return i.editReply("Warn issued");
  }

  if (i.commandName === "warnlist") {
    const all = await Warn.find();

    return i.editReply(all.map(w => `<@${w.userId}> - ${w.warns}/3`).join("\n") || "No warns");
  }

  if (i.commandName === "warninfo") {
    const data = await Warn.findOne({ userId: user.id });

    return i.editReply(data ? `${user.tag} - ${data.warns}/3` : "No warns");
  }

  if (i.commandName === "clearwarn") {
    await Warn.findOneAndDelete({ userId: user.id });

    await i.channel.send(`🧹 ${user.tag} warnings cleared (0/3)`);

    return i.editReply("Cleared");
  }

  // ================= ROLE =================
  if (i.commandName === "addrole") {
    const roles = ["role1","role2","role3"].map(r=>i.options.getRole(r)).filter(Boolean);

    for (const r of roles) await member.roles.add(r);

    return i.editReply("Roles added");
  }

  if (i.commandName === "removerole") {
    const roles = ["role1","role2","role3"].map(r=>i.options.getRole(r)).filter(Boolean);

    for (const r of roles) await member.roles.remove(r);

    return i.editReply("Roles removed");
  }

});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
