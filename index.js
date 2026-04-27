// ================= IMPORTS =================
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
  StringSelectMenuBuilder,
  ChannelType
} = require("discord.js");

// ================= ERROR SAFETY =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= CONFIG =================
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

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

const Ticket = mongoose.model("Ticket", new mongoose.Schema({
  userId: String,
  channelId: String,
  claimedBy: String
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

// ================= GREETINGS =================
client.on("messageCreate", (m) => {
  if (m.author.bot) return;
  if (["hi","hello","hey"].includes(m.content.toLowerCase())) {
    m.reply(`👋 Greetings ${m.author.username}, Welcome to CRP`);
  }
});

// ================= PERMISSION =================
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    i.member.roles.cache.has(STAFF_ROLE)
  );
}

// ================= LOG =================
function sendLog(guild, msg) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (ch) ch.send(msg).catch(()=>{});
}

// ================= WARN AUTO =================
async function checkWarn(member, userId, channel, guild) {
  let data = await Warn.findOne({ userId });
  if (!data) return;

  if (data.warns >= 3) {
    data.warns = 0;
    await data.save();

    await member.timeout(24 * 60 * 60 * 1000, "3 warns auto timeout");

    channel.send(`⛔ <@${userId}> auto timeout (24h)`);
    sendLog(guild, `⛔ ${userId} auto timeout (3 warns)`);
  }
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o=>o.setName("message").setRequired(true))
    .addChannelOption(o=>o.setName("channel"))
    .addAttachmentOption(o=>o.setName("image1"))
    .addAttachmentOption(o=>o.setName("image2"))
    .addAttachmentOption(o=>o.setName("image3"))
    .addAttachmentOption(o=>o.setName("video1"))
    .addAttachmentOption(o=>o.setName("video2")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("kick")
    .addUserOption(o=>o.setName("user").setRequired(true))
    .addStringOption(o=>o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .addUserOption(o=>o.setName("user").setRequired(true))
    .addStringOption(o=>o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .addUserOption(o=>o.setName("user").setRequired(true))
    .addIntegerOption(o=>o.setName("time").setRequired(true))
    .addStringOption(o=>o.setName("reason")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .addUserOption(o=>o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .addUserOption(o=>o.setName("user").setRequired(true))
    .addStringOption(o=>o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .addUserOption(o=>o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .addUserOption(o=>o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .addUserOption(o=>o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .addIntegerOption(o=>o.setName("amount").setRequired(true)),

].map(c=>c.toJSON());

// ================= READY =================
client.once("clientReady", async () => {
  console.log("🟢 Logged in as " + client.user.tag);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("✅ Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i)=>{
  try {

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(()=>null) : null;

    // ===== ANNOUNCE =====
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ Not allowed");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["image1","image2","image3","video1","video2"].forEach(n=>{
        const f = i.options.getAttachment(n);
        if (f) files.push(f.url);
      });

      await ch.send({ content: msg, files });

      sendLog(i.guild, `📢 Announcement`);
      return i.editReply("Sent");
    }

    // ===== WARN =====
    if (i.commandName === "warn") {
      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });
      data.warns++;
      await data.save();

      const reason = i.options.getString("reason");

      i.channel.send(`⚠️ ${user} warned (${data.warns}/3)\nReason: ${reason}`);
      sendLog(i.guild, `Warn: ${user.tag} | ${reason}`);

      await checkWarn(member, user.id, i.channel, i.guild);
      return i.editReply("Done");
    }

    if (i.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: user.id });
      if (data && data.warns > 0) {
        data.warns--;
        await data.save();
      }
      i.channel.send(`✅ ${user} unwarned`);
      return i.editReply("Done");
    }

    if (i.commandName === "clearwarn") {
      await Warn.deleteOne({ userId: user.id });
      i.channel.send(`🧹 ${user} warns cleared`);
      return i.editReply("Done");
    }

    if (i.commandName === "warnlist") {
      let data = await Warn.findOne({ userId: user.id });
      return i.editReply(`Warns: ${data ? data.warns : 0}/3`);
    }

    // ===== TIMEOUT =====
    if (i.commandName === "timeout") {
      const reason = i.options.getString("reason") || "No reason";
      await member.timeout(i.options.getInteger("time") * 60000, reason);
      return i.editReply("Timed out");
    }

    if (i.commandName === "untimeout") {
      await member.timeout(null);
      return i.editReply("Removed");
    }

    // ===== PURGE =====
    if (i.commandName === "purge") {
      if (!isAllowed(i)) return i.editReply("❌ Not allowed");

      const amount = i.options.getInteger("amount");
      await i.channel.bulkDelete(amount, true);

      sendLog(i.guild, `🧹 Purged ${amount}`);
      return i.editReply("Deleted");
    }

    // ===== TICKET PANEL =====
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ Not allowed");

      const ch = i.channel;

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select Ticket Type")
        .addOptions([
          { label: "Support", value: "support" },
          { label: "Report", value: "report" },
          { label: "Appeal", value: "appeal" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      await ch.send({
        content: "🎫 Select ticket type",
        components: [row]
      });

      return i.editReply("Panel sent");
    }

    if (i.commandName === "close") {
      return i.channel.delete().catch(()=>{});
    }

    // ===== SELECT MENU =====
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      const ch = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      await ch.send(`<@&${STAFF_ROLE}>

**🎫 New Ticket Opened**
Name : ${i.user.username}
Support : ${i.values[0]}
Describe Your issue :`);

      return i.reply({ content: "Ticket created", ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) i.reply({ content: "Error", ephemeral: true }).catch(()=>{});
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
