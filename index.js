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
const TICKET_CATEGORY = "1404779584829";
const LOG_CHANNEL = "1375845745596305408";

// ================= SERVER =================
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

// ================= AUTO GREETINGS =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const msg = message.content.toLowerCase();

  if (["hi", "hello", "hey"].includes(msg)) {
    return message.reply(`👋 Greetings ${message.author.username} Welcome to CRP`);
  }
});

// ================= WARN AUTO CHECK =================
async function checkWarn(member, userId, channel) {
  let data = await Warn.findOne({ userId });

  if (!data) return;

  if (data.warns >= 3) {
    data.warns = 0;
    await data.save();

    await member.timeout(24 * 60 * 60 * 1000, "Auto 3 Warns Timeout");

    channel.send(`⛔ <@${userId}> auto timed out for 24 hours (3 warns)`);
  }
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Optional channel")
    ),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("time")
        .setDescription("Minutes")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Check warn history")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role1")
        .setDescription("Role 1")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role2")
        .setDescription("Role 2")
    )
    .addRoleOption(o =>
      o.setName("role3")
        .setDescription("Role 3")
    ),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role1")
        .setDescription("Role 1")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role2")
        .setDescription("Role 2")
    )
    .addRoleOption(o =>
      o.setName("role3")
        .setDescription("Role 3")
    )

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {

  console.log("🟢 Logged in as " + client.user.tag);

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

    if (i.isChatInputCommand()) {
      await i.deferReply({ ephemeral: true }).catch(() => {});
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      await ch.send(msg);
      return i.editReply("📤 Announcement sent");
    }

    // ================= WARN =================
    if (i.commandName === "warn") {

      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

      data.warns++;
      await data.save();

      try {
        await user.send(`⚠️ Warn Issued\nReason: ${i.options.getString("reason")}\nWarns: ${data.warns}/3`);
      } catch {}

      await checkWarn(member, user.id, i.channel);

      return i.editReply("Warn issued");
    }

    // ================= WARNLIST =================
    if (i.commandName === "warnlist") {

      let data = await Warn.findOne({ userId: user.id });

      const count = data ? data.warns : 0;

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Warn History")
        .setColor(0xffcc00)
        .setDescription(`👤 User: ${user}\n⚠️ Warns: ${count}/3`);

      return i.editReply({ embeds: [embed] });
    }

    // ================= KICK =================
    if (i.commandName === "kick") {
      const reason = i.options.getString("reason");

      try {
        await user.send(`👢 Kicked\nReason: ${reason}`);
      } catch {}

      await member.kick(reason);
      return i.editReply("Kicked");
    }

    // ================= BAN =================
    if (i.commandName === "ban") {
      const reason = i.options.getString("reason");

      try {
        await user.send(`🔨 Banned\nReason: ${reason}`);
      } catch {}

      await member.ban({ reason });
      return i.editReply("Banned");
    }

    // ================= TIMEOUT =================
    if (i.commandName === "timeout") {
      await member.timeout(i.options.getInteger("time") * 60000);
      return i.editReply("Timed out");
    }

    if (i.commandName === "untimeout") {
      await member.timeout(null);
      return i.editReply("Timeout removed");
    }

    // ================= PURGE =================
    if (i.commandName === "purge") {
      const amount = i.options.getInteger("amount");
      await i.channel.bulkDelete(amount, true);
      return i.editReply("Deleted messages");
    }

    // ================= ROLES =================
    if (i.commandName === "addrole") {
      const roles = ["role1","role2","role3"].map(r => i.options.getRole(r)).filter(Boolean);
      for (const r of roles) await member.roles.add(r);
      return i.editReply("Roles added");
    }

    if (i.commandName === "removerole") {
      const roles = ["role1","role2","role3"].map(r => i.options.getRole(r)).filter(Boolean);
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

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
