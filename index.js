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

// ===== ERROR SAFETY =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ===== CONFIG =====
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ✅ ALLOWED USERS
const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== EXPRESS =====
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== SAFE REPLY =====
async function reply(i, msg, eph = true) {
  if (i.deferred || i.replied) {
    return i.followUp({ content: msg, ephemeral: eph });
  }
  return i.reply({ content: msg, ephemeral: eph });
}

// ===== PERMISSION CHECK =====
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// ===== GREETINGS =====
client.on("messageCreate", (m) => {
  if (m.author.bot) return;

  const msg = m.content.toLowerCase();
  if (["hi","hello","hey"].includes(msg)) {
    m.reply(`👋 Greetings ${m.author.username}, Welcome to CRP`);
  }
});

// ===== WARN AUTO =====
async function checkWarn(member, userId, channel) {
  let data = await Warn.findOne({ userId });
  if (!data) return;

  if (data.warns >= 3) {
    data.warns = 0;
    await data.save();

    await member.timeout(24 * 60 * 60 * 1000, "3 warns auto timeout");
    channel.send(`⛔ <@${userId}> auto timeout (24h)`);
  }
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("media1").setDescription("Image/Video"))
    .addAttachmentOption(o => o.setName("media2").setDescription("Image/Video"))
    .addAttachmentOption(o => o.setName("media3").setDescription("Image/Video")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
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
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Warn list")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

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
  console.log("🟢 Logged in as " + client.user.tag);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("✅ Commands loaded");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {
  try {

    if (i.isChatInputCommand()) {
      await i.deferReply({ ephemeral: true });
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ===== ANNOUNCE =====
    if (i.commandName === "announce") {

      if (!isAllowed(i)) return reply(i, "❌ Not allowed");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const media = [
        i.options.getAttachment("media1"),
        i.options.getAttachment("media2"),
        i.options.getAttachment("media3")
      ].filter(Boolean);

      const embed = new EmbedBuilder()
        .setDescription(msg)
        .setColor(0x00ff99);

      if (media[0]) embed.setImage(media[0].url);

      await ch.send({ embeds: [embed] });

      return reply(i, "📤 Announcement sent");
    }

    // ===== TICKET PANEL =====
    if (i.commandName === "ticketpanel") {

      if (!isAllowed(i)) return reply(i, "❌ Not allowed");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Success)
      );

      await i.channel.send({ content: "🎫 Open Ticket", components: [row] });

      return reply(i, "Panel sent");
    }

    // ===== BUTTONS =====
    if (i.isButton()) {

      if (i.customId === "create_ticket") {

        const ch = await i.guild.channels.create({
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
            .setCustomId("close_ticket")
            .setLabel("Close Ticket")
            .setStyle(ButtonStyle.Danger)
        );

        await ch.send({ content: `🎫 Ticket created by <@${i.user.id}>`, components: [row] });

        return i.reply({ content: "🎫 Ticket Created", ephemeral: true });
      }

      if (i.customId === "close_ticket") {

        const file = await transcripts.createTranscript(i.channel);
        const log = i.guild.channels.cache.get(LOG_CHANNEL);

        if (log) log.send({ files: [file] });

        await i.reply({ content: "Closing ticket...", ephemeral: true });

        setTimeout(() => i.channel.delete().catch(() => {}), 2000);
      }
    }

    // ===== OTHER COMMANDS =====
    if (!isAllowed(i)) return reply(i, "❌ Not allowed");

    if (i.commandName === "ping") return reply(i, "🏓 Pong");

    if (i.commandName === "serverinfo") {
      return reply(i, `Server: ${i.guild.name}\nMembers: ${i.guild.memberCount}`);
    }

    if (i.commandName === "purge") {
      await i.channel.bulkDelete(i.options.getInteger("amount"), true);
      return reply(i, "Messages deleted");
    }

    if (i.commandName === "warn") {
      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });
      data.warns++; await data.save();

      await i.channel.send(`⚠️ ${user} warned (${data.warns}/3)`);

      try {
        await user.send(`⚠️ You got warned\nReason: ${i.options.getString("reason")}`);
      } catch {}

      await checkWarn(member, user.id, i.channel);

      return reply(i, "Warn issued");
    }

    if (i.commandName === "warnlist") {
      let data = await Warn.findOne({ userId: user.id });
      return reply(i, `Warns: ${data ? data.warns : 0}/3`);
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) {
      i.reply({ content: "Error occurred", ephemeral: true }).catch(() => {});
    }
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
