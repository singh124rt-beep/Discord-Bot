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

// ===== LOG =====
async function sendLog(guild, title, desc) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;
  ch.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0xff0000)] });
}

// ===== GREETING + ANTISPAM =====
const spam = new Map();
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase() === "hi") return msg.reply("hi 👋");

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 5000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(600000).catch(() => {});
      msg.channel.send(`🚫 ${msg.author.tag} muted for spam`);
      spam.delete(msg.author.id);
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
    .setDescription("Remove one warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  // MULTI ROLE
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("🚀 Commands synced");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    const user = i.options.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // PING
    if (i.commandName === "ping")
      return i.reply({ content: "🏓 Pong!", ephemeral: true });

    // ANNOUNCE (NO LINK SHOWN)
    if (i.commandName === "announce") {
      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;
      const img = i.options.getString("image");

      if (img) {
        const file = new AttachmentBuilder(img);
        await ch.send({ content: msg, files: [file] });
      } else {
        await ch.send({ content: msg });
      }

      return i.reply({ content: "Sent", ephemeral: true });
    }

    // KICK
    if (i.commandName === "kick") {
      const reason = i.options.getString("reason");
      await member.kick();
      i.channel.send(`👢 ${user.tag} has been kicked\n📄 Reason: ${reason}`);
      return i.reply({ content: "Kicked", ephemeral: true });
    }

    // BAN
    if (i.commandName === "ban") {
      const reason = i.options.getString("reason");
      await member.ban();
      i.channel.send(`🔨 ${user.tag} has been banned\n📄 Reason: ${reason}`);
      return i.reply({ content: "Banned", ephemeral: true });
    }

    // TIMEOUT
    if (i.commandName === "timeout") {
      const time = i.options.getInteger("time");
      await member.timeout(time * 60000);
      i.channel.send(`⏱️ ${user.tag} timed out (${time}m)`);
      return i.reply({ content: "Done", ephemeral: true });
    }

    // UNTIMEOUT
    if (i.commandName === "untimeout") {
      await member.timeout(null);
      i.channel.send(`✅ ${user.tag} timeout removed`);
      return i.reply({ content: "Done", ephemeral: true });
    }

    // WARN
    if (i.commandName === "warn") {
      const reason = i.options.getString("reason");

      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

      data.warns++;
      await data.save();

      user.send(`⚠️ You were warned in ${i.guild.name}\nReason: ${reason}`).catch(()=>{});

      i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)`);

      if (data.warns >= 3) {
        await member.timeout(86400000);
        i.channel.send(`🚫 ${user.tag} reached 3/3 → 24h timeout`);
        data.warns = 0;
        await data.save();
      }

      return i.reply({ content: "Warned", ephemeral: true });
    }

    // CLEAR WARN
    if (i.commandName === "clearwarn") {
      await Warn.findOneAndDelete({ userId: user.id });
      i.channel.send(`🧹 ${user.tag} warnings removed (0/3)`);
      return i.reply({ content: "Cleared", ephemeral: true });
    }

    // WARNLIST
    if (i.commandName === "warnlist") {
      const all = await Warn.find();
      return i.reply({
        content: all.map(w => `<@${w.userId}> : ${w.warns}`).join("\n") || "No warns",
        ephemeral: true
      });
    }

    // WARNINFO
    if (i.commandName === "warninfo") {
      const data = await Warn.findOne({ userId: user.id });
      return i.reply({
        content: data ? `${user.tag} : ${data.warns}/3` : "No warns",
        ephemeral: true
      });
    }

    // UNWARN
    if (i.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: user.id });
      if (!data) return i.reply({ content: "No warns", ephemeral: true });

      data.warns = Math.max(0, data.warns - 1);
      await data.save();

      i.channel.send(`⚠️ ${user.tag} warn removed (${data.warns}/3)`);
      return i.reply({ content: "Removed", ephemeral: true });
    }

  }

});
client.login(process.env.DISCORD_BOT_TOKEN);
