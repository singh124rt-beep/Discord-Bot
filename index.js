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
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ================= DB =================
mongoose.connect(process.env.MONGO_URI);

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

// ================= LOG =================
function log(guild, title, desc) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;
  ch.send({
    embeds: [new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0xff0000)]
  }).catch(() => {});
}

// ================= GREETINGS =================
client.on("guildMemberAdd", (member) => {
  const ch = member.guild.systemChannel;
  if (ch) ch.send(`👋 Greetings, ${member.user.username} Welcome to CRP`);
});

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  // ================= ANNOUNCE =================
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  // ================= TICKET =================
  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  // ================= MODERATION =================
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

  // ================= WARN SYSTEM =================
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warns"),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  // ================= PURGE =================
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  // ================= MULTI ROLE =================
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role"))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  try {

    // always ACK fast → prevents "did not respond"
    if (!i.replied && !i.deferred) {
      await i.deferReply().catch(() => {});
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ================= TICKET PANEL =================
    if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket System")
        .setDescription("Click below to create ticket")
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Success)
      );

      return i.editReply({ embeds: [embed], components: [row] });
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
        .setTitle("🎫 Ticket Opened")
        .setDescription(`Hello <@${i.user.id}> explain your issue`)
        .setColor(0x00aaff);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });

      return i.editReply({
        content: `🎟️ Ticket Created: ${channel}`
      });
    }

    // ================= CLOSE BUTTON =================
    if (i.isButton() && i.customId === "close_ticket") {

      const file = await transcripts.createTranscript(i.channel);
      const logCh = i.guild.channels.cache.get(LOG_CHANNEL);
      if (logCh) logCh.send({ files: [file] });

      return i.channel.delete();
    }

    // ================= CLOSE COMMAND =================
    if (i.commandName === "close") {

      const file = await transcripts.createTranscript(i.channel);
      const logCh = i.guild.channels.cache.get(LOG_CHANNEL);
      if (logCh) logCh.send({ files: [file] });

      await i.editReply("Closing ticket...");
      return setTimeout(() => i.channel.delete(), 1500);
    }

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;
      const img = i.options.getString("image");

      await ch.send({ content: msg });
      if (img) await ch.send({ content: img });

      return i.editReply("Announcement sent");
    }

    // ================= WARN =================
    if (i.commandName === "warn") {

      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

      data.warns++;
      await data.save();

      i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)`);

      if (data.warns >= 3 && member) {
        await member.timeout(86400000);
        data.warns = 0;
        await data.save();
      }

      return i.editReply("Warn issued");
    }

    // ================= WARNLIST =================
    if (i.commandName === "warnlist") {

      const all = await Warn.find();

      return i.editReply(
        all.length
          ? all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n")
          : "No warns"
      );
    }

    // ================= CLEARWARN =================
    if (i.commandName === "clearwarn") {

      let data = await Warn.findOne({ userId: user.id });

      if (!data) return i.editReply("No warns");

      data.warns = 0;
      await data.save();

      i.channel.send(`🧹 ${user.tag} warns cleared`);

      return i.editReply("Cleared");
    }

    // ================= ADD ROLE =================
    if (i.commandName === "addrole") {
      const roles = ["role1", "role2", "role3"]
        .map(r => i.options.getRole(r))
        .filter(Boolean);

      for (const r of roles) await member.roles.add(r);

      return i.editReply("Roles added");
    }

    // ================= REMOVE ROLE =================
    if (i.commandName === "removerole") {
      const roles = ["role1", "role2", "role3"]
        .map(r => i.options.getRole(r))
        .filter(Boolean);

      for (const r of roles) await member.roles.remove(r);

      return i.editReply("Roles removed");
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) {
      i.reply({ content: "Error occurred", ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
