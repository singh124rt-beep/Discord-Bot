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

// ================= MONGO =================
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

// ================= SAFE LOG =================
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

// ================= SPAM =================
const spam = new Map();

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const data = spam.get(msg.author.id) || { c: 0, t: Date.now() };

  if (Date.now() - data.t < 4000) {
    data.c++;
    if (data.c >= 5) {
      await msg.member.timeout(600000).catch(() => {});
      spam.delete(msg.author.id);
    }
  } else {
    spam.set(msg.author.id, { c: 1, t: Date.now() });
  }
});

// ================= COMMANDS =================
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

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show warns"),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

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

    if (i.isChatInputCommand() || i.isButton()) {
      if (!i.deferred && !i.replied) {
        await i.deferReply().catch(() => {});
      }
    }

    // ================= TICKET =================
    if (i.isChatInputCommand() && i.commandName === "ticketpanel") {

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Ticket System")
        .setDescription("Click button to create ticket")
        .setColor(0x2b2d31);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Success)
      );

      return i.editReply({ embeds: [embed], components: [row] });
    }

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
        .setDescription(`Hello <@${i.user.id}> describe your issue`)
        .setColor(0x00aaff);

      await channel.send({ embeds: [embed] });

      return i.editReply({
        content: "🎟️ Ticket Created Successfully"
      });
    }

    if (i.isButton() && i.customId === "close") {
      const file = await transcripts.createTranscript(i.channel);
      const logCh = i.guild.channels.cache.get(LOG_CHANNEL);
      if (logCh) logCh.send({ files: [file] });

      return i.channel.delete();
    }

    if (!i.isChatInputCommand()) return;

    const user = i.options.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(() => null) : null;

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
      log(i.guild, "Warn Cleared", `${user.tag}`);

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
    if (i.deferred) return i.editReply("Error occurred").catch(() => {});
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
