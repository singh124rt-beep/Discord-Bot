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
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const MONGO = process.env.MONGO_URI;

const ADMIN_ROLE = "1390273593040048220";
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
mongoose.connect(MONGO);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: [{ reason: String, time: Date }]
}));

const TicketData = mongoose.model("TicketData", new mongoose.Schema({
  channelId: String,
  ownerId: String,
  claimedBy: String
}));

const TicketCounter = mongoose.model("TicketCounter", new mongoose.Schema({
  guildId: String,
  count: Number
}));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ================= PERMISSION =================
function isAllowed(member) {
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    ALLOWED_USERS.includes(member.id) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// ================= COOLDOWN =================
const cooldown = new Map();
function checkCooldown(id) {
  const now = Date.now();
  const last = cooldown.get(id) || 0;
  if (now - last < 2000) return true;
  cooldown.set(id, now);
  return false;
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o=>o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o=>o.setName("file1").setDescription("File1"))
    .addAttachmentOption(o=>o.setName("file2").setDescription("File2"))
    .addAttachmentOption(o=>o.setName("file3").setDescription("File3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn history"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o=>o.setName("duration").setDescription("Minutes").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))

].map(c=>c.toJSON());

// ================= READY =================
client.on("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    if (checkCooldown(i.user.id))
      return i.reply({ content:"Slow down", ephemeral:true });

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i.member)) return i.reply({ content:"No permission", ephemeral:true });

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files=[];
      ["file1","file2","file3"].forEach(f=>{
        const file=i.options.getAttachment(f);
        if(file) files.push(file.url);
      });

      await ch.send({ content:msg, files });
      return i.reply({ content:"Sent 📤", ephemeral:true });
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i.member)) return i.reply({ content:"No permission", ephemeral:true });

      const btn = new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary);

      return i.channel.send({
        embeds:[new EmbedBuilder().setTitle("🎟️ Ticket System")],
        components:[new ActionRowBuilder().addComponents(btn)]
      });
    }

    // ================= CREATE =================
    if (i.isButton() && i.customId === "create_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_type")
        .addOptions([
          { label:"Support", value:"Support" },
          { label:"Report", value:"Report" }
        ]);

      return i.reply({
        content:"Select type",
        components:[new ActionRowBuilder().addComponents(menu)],
        ephemeral:true
      });
    }

    if (i.isStringSelectMenu()) {

      let data = await TicketCounter.findOne({ guildId:i.guild.id });
      if(!data) data = await TicketCounter.create({ guildId:i.guild.id, count:0 });

      data.count++;
      await data.save();

      const ch = await i.guild.channels.create({
        name:`ticket-${data.count}`,
        parent:TICKET_CATEGORY
      });

      await TicketData.create({
        channelId: ch.id,
        ownerId: i.user.id
      });

      const embed = new EmbedBuilder().setDescription(
`<@&${ADMIN_ROLE}>

Name: <@${i.user.id}>
Type: ${i.values[0]}
Describe your issue:

Our team will assist you shortly`
      );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("close").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ch.send({ embeds:[embed], components:[row] });

      return i.reply({ content:"Ticket created", ephemeral:true });
    }

    // ================= CLAIM =================
    if (i.isButton() && i.customId === "claim") {
      if (!isAllowed(i.member)) return i.reply({ content:"No permission", ephemeral:true });

      await TicketData.updateOne({ channelId:i.channel.id }, { claimedBy:i.user.id });

      return i.reply({ content:`Claimed by <@${i.user.id}>`, ephemeral:false });
    }

    // ================= CLOSE =================
    if (i.isButton() && i.customId === "close") {
      if (!isAllowed(i.member)) return i.reply({ content:"No permission", ephemeral:true });

      const file = await transcripts.createTranscript(i.channel);
      const log = i.guild.channels.cache.get(LOG_CHANNEL);

      if (log) log.send({ files:[file] });

      await i.reply({ content:"Closing...", ephemeral:true });
      setTimeout(()=>i.channel.delete(),2000);
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) i.reply({ content:"Error", ephemeral:true });
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
