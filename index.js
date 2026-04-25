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
async function log(guild, title, desc, color = 0xff0000) {
  const ch = guild.channels.cache.get(LOG_CHANNEL);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setTimestamp();

  ch.send({ embeds: [embed] }).catch(() => {});
}

// ===== GREETINGS + ANTISPAM =====
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const text = msg.content.toLowerCase();

  // greetings command (everyone use)
  if (text === "hi" || text === "hello" || text === "hey") {
    return msg.reply(`👋 Greetings ${msg.author.username}, Welcome to CRP`);
  }

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
    .addChannelOption(o => o.setName("channel").setDescription("Channel (optional)"))
    .addStringOption(o => o.setName("image").setDescription("Image URL (optional)")),

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

// ===== READY =====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("🚀 Commands synced");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand() && !i.isStringSelectMenu() && !i.isButton()) return;

  try {

    // ===== TICKET PANEL =====
    if (i.commandName === "ticketpanel") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select ticket type")
        .addOptions([
          { label: "Support", value: "support" },
          { label: "Report", value: "report" },
          { label: "Help", value: "help" }
        ]);

      return i.reply({
        content: "🎟️ Select ticket type",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ===== CREATE TICKET =====
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

      await log(i.guild, "Ticket Created", `${i.user.tag} created ticket`);

      return i.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
    }

    // ===== CLOSE =====
    if (i.commandName === "close") {
      const file = await transcripts.createTranscript(i.channel);

      await log(i.guild, "Ticket Closed", `${i.user.tag} closed ticket`);

      await i.channel.send({ files: [file] });
      return i.channel.delete();
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ===== ANNOUNCE (FIXED - NO PUBLIC TITLE) =====
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

    // ===== WARN =====
    if (i.commandName === "warn") {
      const reason = i.options.getString("reason");

      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });
      data.warns++;
      data.history.push({ reason, date: new Date().toISOString() });
      await data.save();

      await user.send(`⚠️ Warned in ${i.guild.name}\nReason: ${reason}`).catch(() => {});

      await log(i.guild, "Warn Issued", `${user.tag} (${data.warns}/3)\nReason: ${reason}`);

      i.channel.send(`⚠️ ${user.tag} received warning (${data.warns}/3)\nReason: ${reason}`);

      if (data.warns >= 3) {
        await member.timeout(86400000);
        data.warns = 0;
        await data.save();
      }

      return i.reply({ content: "Warn issued", ephemeral: true });
    }

    // ===== KICK / BAN / TIMEOUT LOG FIXED =====
    if (i.commandName === "kick") {
      const reason = i.options.getString("reason");
      await member.kick();

      await log(i.guild, "User Kicked", `${user.tag}\nReason: ${reason}`);
      i.channel.send(`👢 ${user.tag} kicked\nReason: ${reason}`);

      return i.reply({ content: "Done", ephemeral: true });
    }

    if (i.commandName === "ban") {
      const reason = i.options.getString("reason");
      await member.ban();

      await log(i.guild, "User Banned", `${user.tag}\nReason: ${reason}`);
      i.channel.send(`🔨 ${user.tag} banned\nReason: ${reason}`);

      return i.reply({ content: "Done", ephemeral: true });
    }

    if (i.commandName === "timeout") {
      const time = i.options.getInteger("time");
      await member.timeout(time * 60000);

      await log(i.guild, "Timeout", `${user.tag} for ${time}m`);

      return i.reply({ content: "Done", ephemeral: true });
    }

    if (i.commandName === "untimeout") {
      await member.timeout(null);

      await log(i.guild, "Timeout Removed", `${user.tag}`);

      return i.reply({ content: "Removed", ephemeral: true });
    }

    // ===== PURGE =====
    if (i.commandName === "purge") {
      const amt = i.options.getInteger("amount");
      await i.channel.bulkDelete(amt);

      return i.reply({ content: "Deleted", ephemeral: true });
    }

    // ===== ROLE =====
    if (i.commandName === "addrole") {
      const roles = ["role1","role2","role3"].map(r => i.options.getRole(r)).filter(Boolean);
      for (const r of roles) await member.roles.add(r);

      return i.reply({ content: "Roles added", ephemeral: true });
    }

    if (i.commandName === "removerole") {
      const roles = ["role1","role2","role3"].map(r => i.options.getRole(r)).filter(Boolean);
      for (const r of roles) await member.roles.remove(r);

      return i.reply({ content: "Roles removed", ephemeral: true });
    }

  } catch (e) {
    console.log(e);
    if (i.replied || i.deferred) return;
    i.reply({ content: "Error occurred", ephemeral: true });
  }
});

// ===== LOGIN (FIXED TOKEN ISSUE) =====
client.login(process.env.DISCORD_BOT_TOKEN);
