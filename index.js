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

  if (msg.content.toLowerCase() === "hi") {
    return msg.reply("hi 👋");
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
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

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
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  // WARN SYSTEM
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Show all warns"),

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
    .setDescription("Clear all warns")
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

  // ===== TICKET PANEL =====
  if (i.isChatInputCommand() && i.commandName === "ticketpanel") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Choose ticket type")
      .addOptions([
        { label: "Support", value: "support" },
        { label: "Report", value: "report" },
        { label: "Help", value: "help" }
      ]);

    return i.reply({
      content: "🎟️ Create a ticket",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // CREATE TICKET
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
      new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("close_btn").setLabel("Close").setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `🎟️ Ticket created by <@${i.user.id}>`,
      components: [row]
    });

    return i.reply({ content: `Ticket: ${channel}`, ephemeral: true });
  }

  // BUTTONS
  if (i.isButton()) {

    if (i.customId === "claim") {
      if (!i.member.roles.cache.has(STAFF_ROLE))
        return i.reply({ content: "No permission", ephemeral: true });

      return i.reply({ content: "Ticket claimed", ephemeral: true });
    }

    if (i.customId === "close_btn") {
      const file = await transcripts.createTranscript(i.channel);
      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      await i.channel.delete();
    }
  }

  if (!i.isChatInputCommand()) return;

  const user = i.options.getUser("user");
  const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

  // ===== ANNOUNCE =====
  if (i.commandName === "announce") {
    const msg = i.options.getString("message");
    const ch = i.options.getChannel("channel") || i.channel;
    const img = i.options.getString("image");

    await ch.send(img ? `${msg}\n${img}` : msg);
    return i.reply({ content: "Sent", ephemeral: true });
  }

  // ===== CLOSE COMMAND =====
  if (i.commandName === "close") {
    const file = await transcripts.createTranscript(i.channel);
    const log = i.guild.channels.cache.get(LOG_CHANNEL);
    if (log) log.send({ files: [file] });

    await i.channel.delete();
  }

  // ===== KICK =====
  if (i.commandName === "kick") {
    const reason = i.options.getString("reason");
    await member.kick();
    i.channel.send(`👢 ${user.tag} kicked\n📄 ${reason}`);
    return i.reply({ content: "Kicked", ephemeral: true });
  }

  // ===== BAN =====
  if (i.commandName === "ban") {
    const reason = i.options.getString("reason");
    await member.ban();
    i.channel.send(`🔨 ${user.tag} banned\n📄 ${reason}`);
    return i.reply({ content: "Banned", ephemeral: true });
  }

  // ===== TIMEOUT =====
  if (i.commandName === "timeout") {
    const time = i.options.getInteger("time");
    await member.timeout(time * 60000);
    i.channel.send(`⏱️ ${user.tag} timed out (${time}m)`);
    return i.reply({ content: "Done", ephemeral: true });
  }

  // ===== UNTIMEOUT =====
  if (i.commandName === "untimeout") {
    await member.timeout(null);
    i.channel.send(`✅ ${user.tag} timeout removed`);
    return i.reply({ content: "Done", ephemeral: true });
  }

  // ===== PURGE =====
  if (i.commandName === "purge") {
    const amt = i.options.getInteger("amount");
    await i.channel.bulkDelete(amt);
    return i.reply({ content: "Deleted", ephemeral: true });
  }

  // ===== WARN =====
  if (i.commandName === "warn") {
    const reason = i.options.getString("reason");

    let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

    data.warns++;
    data.history.push(reason);
    await data.save();

    i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)\n📄 ${reason}`);

    if (data.warns >= 3) {
      await member.timeout(86400000);
      data.warns = 0;
      await data.save();
      i.channel.send(`🚫 ${user.tag} got 24h timeout`);
    }

    return i.reply({ content: "Warned", ephemeral: true });
  }

  // ===== WARN LIST =====
  if (i.commandName === "warnlist") {
    const all = await Warn.find();
    return i.reply({
      content: all.map(w => `<@${w.userId}> : ${w.warns}`).join("\n") || "No warns",
      ephemeral: true
    });
  }

  // ===== WARN INFO =====
  if (i.commandName === "warninfo") {
    const data = await Warn.findOne({ userId: user.id });
    return i.reply({
      content: data ? `${user.tag} : ${data.warns} warns` : "No warns",
      ephemeral: true
    });
  }

  // ===== UNWARN =====
  if (i.commandName === "unwarn") {
    let data = await Warn.findOne({ userId: user.id });
    if (!data) return i.reply({ content: "No warns", ephemeral: true });

    data.warns = Math.max(0, data.warns - 1);
    await data.save();

    return i.reply({ content: "Removed one warn", ephemeral: true });
  }

  // ===== CLEAR WARN =====
  if (i.commandName === "clearwarn") {
    await Warn.findOneAndDelete({ userId: user.id });
    return i.reply({ content: "Cleared", ephemeral: true });
  }

  // ===== ADD ROLE =====
  if (i.commandName === "addrole") {
    const roles = ["role1","role2","role3"].map(r=>i.options.getRole(r)).filter(Boolean);
    for (const r of roles) await member.roles.add(r);
    return i.reply({ content: "Roles added", ephemeral: true });
  }

  // ===== REMOVE ROLE =====
  if (i.commandName === "removerole") {
    const roles = ["role1","role2","role3"].map(r=>i.options.getRole(r)).filter(Boolean);
    for (const r of roles) await member.roles.remove(r);
    return i.reply({ content: "Roles removed", ephemeral: true });
  }

});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
