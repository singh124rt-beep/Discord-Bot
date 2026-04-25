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
  PermissionsBitField,
  AttachmentBuilder
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
  history: { type: Array, default: [] }
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
async function log(guild, title, desc) {
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

// ===== GREETINGS + ANTISPAM =====
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const text = msg.content.toLowerCase();

  if (["hi", "hello", "hey"].includes(text)) {
    msg.reply(`👋 Greetings, ${msg.author.username} Welcome to CRP`);
  }

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 5000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(600000).catch(()=>{});
      msg.channel.send(`🚫 ${msg.author.tag} muted for spam`);
      spam.delete(msg.author.id);
    }
  } else {
    spam.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping bot"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

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
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),

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
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))

].map(c => c.toJSON());

// ===== READY =====
client.once("ready", async () => {
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

  if (!i.isChatInputCommand()) return;

  const user = i.options.getUser("user");
  const member = user ? await i.guild.members.fetch(user.id).catch(()=>null) : null;

  // ===== PING =====
  if (i.commandName === "ping")
    return i.reply("🏓 Pong");

  // ===== SERVER INFO =====
  if (i.commandName === "serverinfo")
    return i.reply(`👥 Members: ${i.guild.memberCount}`);

  // ===== ANNOUNCE (FIXED) =====
  if (i.commandName === "announce") {
    const msg = i.options.getString("message");
    const ch = i.options.getChannel("channel") || i.channel;
    const img = i.options.getString("image");

    const embed = new EmbedBuilder()
      .setDescription(msg)
      .setColor(0x00aaff);

    if (img) embed.setImage(img);

    await ch.send({ embeds: [embed] });

    return i.reply({ content: "Announcement sent", ephemeral: true });
  }

  // ===== KICK =====
  if (i.commandName === "kick") {
    const reason = i.options.getString("reason");
    await member.kick();

    await i.channel.send(`👢 ${user.tag} kicked\nReason: ${reason}`);
    await user.send(`You were kicked. Reason: ${reason}`).catch(()=>{});

    await log(i.guild, "Kick", `${user.tag} kicked\nReason: ${reason}`);

    return i.reply({ content: "Done", ephemeral: true });
  }

  // ===== BAN =====
  if (i.commandName === "ban") {
    const reason = i.options.getString("reason");
    await member.ban();

    await i.channel.send(`🔨 ${user.tag} banned\nReason: ${reason}`);
    await user.send(`You were banned. Reason: ${reason}`).catch(()=>{});

    await log(i.guild, "Ban", `${user.tag} banned\nReason: ${reason}`);

    return i.reply({ content: "Done", ephemeral: true });
  }

  // ===== TIMEOUT =====
  if (i.commandName === "timeout") {
    const t = i.options.getInteger("time");
    await member.timeout(t * 60000);

    await i.channel.send(`⏱️ ${user.tag} timed out (${t}m)`);

    return i.reply({ content: "Done", ephemeral: true });
  }

  // ===== UNTIMEOUT =====
  if (i.commandName === "untimeout") {
    await member.timeout(null);
    return i.reply("Removed timeout");
  }

  // ===== PURGE =====
  if (i.commandName === "purge") {
    const a = i.options.getInteger("amount");
    await i.channel.bulkDelete(a);
    return i.reply({ content: "Deleted", ephemeral: true });
  }

  // ===== WARN SYSTEM =====
  if (i.commandName === "warn") {
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    data.history.push({ reason, date: new Date().toISOString() });

    await data.save();

    await user.send(`⚠️ Warned in ${i.guild.name}\nReason: ${reason}`).catch(()=>{});

    await i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)\nReason: ${reason}`);

    if (data.warns >= 3) {
      await member.timeout(86400000);
      await i.channel.send(`🚫 ${user.tag} auto 24h timeout`);
      data.warns = 0;
      await data.save();
    }

    return i.reply({ content: "Warned", ephemeral: true });
  }

  if (i.commandName === "warnlist") {
    const all = await Warn.find();
    return i.reply(all.map(w => `<@${w.userId}> ${w.warns}/3`).join("\n") || "No warns");
  }

  if (i.commandName === "warninfo") {
    const data = await Warn.findOne({ userId: user.id });
    return i.reply(data ? `${user.tag} ${data.warns}/3` : "No warns");
  }

  if (i.commandName === "unwarn") {
    let data = await Warn.findOne({ userId: user.id });
    if (!data) return i.reply("No warns");

    data.warns = Math.max(0, data.warns - 1);
    await data.save();

    return i.reply("Removed warn");
  }

  if (i.commandName === "clearwarn") {
    await Warn.findOneAndDelete({ userId: user.id });
    return i.reply("Cleared warns");
  }

  // ===== ROLES =====
  if (i.commandName === "addrole") {
    const roles = ["role1","role2","role3"]
      .map(r => i.options.getRole(r))
      .filter(Boolean);

    for (const r of roles) await member.roles.add(r);

    return i.reply("Roles added");
  }

  if (i.commandName === "removerole") {
    const roles = ["role1","role2","role3"]
      .map(r => i.options.getRole(r))
      .filter(Boolean);

    for (const r of roles) await member.roles.remove(r);

    return i.reply("Roles removed");
  }

});

// ===== LOGIN (FIXED) =====
client.login(process.env.DISCORD_BOT_TOKEN);
