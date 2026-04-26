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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ================= SAFE REPLY =================
async function reply(i, msg, eph = true) {
  if (i.deferred || i.replied) {
    return i.followUp({ content: msg, ephemeral: eph });
  }
  return i.reply({ content: msg, ephemeral: eph });
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot status"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Target channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Open ticket panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
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
    .setDescription("Remove 1 warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

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

  console.log("🟢 Logged in as " + client.user.tag);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Commands loaded successfully");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  try {

    if (i.isChatInputCommand()) {
      await i.deferReply({ ephemeral: true });
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Success)
      );

      return reply(i, "🎟 Ticket panel opened", true);
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
        .setDescription("Staff will assist you soon")
        .setColor(0x00aaff);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });

      return i.reply({
        content: "🎟 Ticket Created 🎫 only you can view this",
        ephemeral: true
      });
    }

    // ================= CLOSE BUTTON =================
    if (i.isButton() && i.customId === "close_ticket") {

      const file = await transcripts.createTranscript(i.channel);

      const log = i.guild.channels.cache.get(LOG_CHANNEL);
      if (log) log.send({ files: [file] });

      return i.channel.delete();
    }

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;
      const img = i.options.getString("image");

      await ch.send(msg);
      if (img) await ch.send(img);

      return i.editReply("📤 Announcement sent (private)");
    }

    // ================= WARN =================
    if (i.commandName === "warn") {

      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

      data.warns++;
      await data.save();

      i.channel.send(`⚠️ ${user.tag} warned (${data.warns}/3)`);

      return i.editReply("Warn issued");
    }

    // ================= PURGE =================
    if (i.commandName === "purge") {
      const amount = i.options.getInteger("amount");
      await i.channel.bulkDelete(amount, true);
      return i.editReply(`Deleted ${amount} messages`);
    }

    // ================= TIMEOUT =================
    if (i.commandName === "timeout") {
      const time = i.options.getInteger("time");
      await member.timeout(time * 60000);
      return i.editReply("User timed out");
    }

    // ================= UNTIMEOUT =================
    if (i.commandName === "untimeout") {
      await member.timeout(null);
      return i.editReply("Timeout removed");
    }

    // ================= ROLES =================
    if (i.commandName === "addrole") {
      const roles = ["role1","role2","role3"]
        .map(r => i.options.getRole(r))
        .filter(Boolean);

      for (const r of roles) await member.roles.add(r);

      return i.editReply("Roles added");
    }

    if (i.commandName === "removerole") {
      const roles = ["role1","role2","role3"]
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
