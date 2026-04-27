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

// ================= DB =================
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
    m.reply(`👋 Greetings ${m.author.username} Welcome to CRP`);
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
    .addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o=>o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o=>o.setName("file1").setDescription("file"))
    .addAttachmentOption(o=>o.setName("file2").setDescription("file"))
    .addAttachmentOption(o=>o.setName("file3").setDescription("file"))
    .addAttachmentOption(o=>o.setName("file4").setDescription("file")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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
    .setDescription("Timeout user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o=>o.setName("time").setDescription("Minutes").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

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

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Warn list")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o=>o.setName("role3").setDescription("Role 3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o=>o.setName("role3").setDescription("Role 3"))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async ()=>{
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
      ["file1","file2","file3","file4"].forEach(f=>{
        const a = i.options.getAttachment(f);
        if (a) files.push(a.url);
      });

      await ch.send({ content: msg, files });

      sendLog(i.guild, `📢 Announcement by ${i.user.tag}`);
      return i.editReply("📤 Sent");
    }

    // ===== PING =====
    if (i.commandName === "ping") {
      i.channel.send("🏓 Pong");
      sendLog(i.guild, "Ping used");
      return i.editReply("Done");
    }

    // ===== SERVERINFO =====
    if (i.commandName === "serverinfo") {
      const g = i.guild;
      const embed = new EmbedBuilder()
        .setTitle(g.name)
        .addFields(
          { name: "Members", value: `${g.memberCount}`, inline: true },
          { name: "Owner", value: `<@${g.ownerId}>`, inline: true }
        );

      i.channel.send({ embeds: [embed] });
      return i.editReply("Done");
    }

    // ===== WARN =====
    if (i.commandName === "warn") {
      let data = await Warn.findOne({ userId: user.id }) || new Warn({ userId: user.id });

      data.warns++;
      await data.save();

      const reason = i.options.getString("reason");

      i.channel.send(`⚠️ ${user} warned (${data.warns}/3)\nReason: ${reason}`);
      sendLog(i.guild, `Warn: ${user.tag} | ${reason}`);

      try { await user.send(`⚠️ You were warned\nReason: ${reason}`); } catch {}

      await checkWarn(member, user.id, i.channel, i.guild);
      return i.editReply("Warn issued");
    }

    if (i.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: user.id });
      if (data && data.warns > 0) {
        data.warns--;
        await data.save();
      }
      return i.editReply("Warn removed");
    }

    if (i.commandName === "clearwarn") {
      await Warn.deleteOne({ userId: user.id });
      return i.editReply("All warns cleared");
    }

    if (i.commandName === "warnlist") {
      let data = await Warn.findOne({ userId: user.id });
      return i.editReply(`Warns: ${data ? data.warns : 0}/3`);
    }

    // ===== MODERATION =====
    if (i.commandName === "kick") {
      await member.kick(i.options.getString("reason"));
      i.channel.send(`👢 ${user} kicked`);
      sendLog(i.guild, `Kick: ${user.tag}`);
      return i.editReply("Done");
    }

    if (i.commandName === "ban") {
      await member.ban({ reason: i.options.getString("reason") });
      i.channel.send(`🔨 ${user} banned`);
      sendLog(i.guild, `Ban: ${user.tag}`);
      return i.editReply("Done");
    }

    if (i.commandName === "timeout") {
      const reason = i.options.getString("reason") || "No reason";
      await member.timeout(i.options.getInteger("time") * 60000, reason);
      return i.editReply("Timed out");
    }

    if (i.commandName === "untimeout") {
      await member.timeout(null);
      return i.editReply("Timeout removed");
    }

    // ===== PURGE =====
    if (i.commandName === "purge") {
      if (!isAllowed(i)) return i.editReply("❌ Not allowed");

      const amount = i.options.getInteger("amount");
      await i.channel.bulkDelete(amount, true);

      sendLog(i.guild, `🧹 Purged ${amount}`);
      return i.editReply("Deleted");
    }

    // ===== ROLES =====
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

    // ===== TICKET PANEL =====
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ Not allowed");

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Choose ticket type")
        .addOptions([
          { label: "Support", value: "support" },
          { label: "Report", value: "report" },
          { label: "Appeal", value: "appeal" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      await i.channel.send({ content: "🎫 Create Ticket", components: [row] });
      return i.editReply("Panel sent");
    }

    if (i.commandName === "close") {
      return i.channel.delete().catch(()=>{});
    }

    // ===== SELECT MENU =====
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      const exist = await Ticket.findOne({ userId: i.user.id });
      if (exist) return i.reply({ content: "❌ Already have ticket", ephemeral: true });

      const ch = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: i.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: STAFF_ROLE, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      await Ticket.create({ userId: i.user.id, channelId: ch.id });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ch.send({ content: `🎫 Ticket for ${i.user}`, components: [row] });

      return i.reply({ content: "Ticket created", ephemeral: true });
    }

    // ===== BUTTONS =====
    if (i.isButton()) {

      if (i.customId === "claim") {
        await Ticket.updateOne({ channelId: i.channel.id }, { claimedBy: i.user.id });
        i.channel.send(`👮 Claimed by ${i.user}`);
        sendLog(i.guild, `Ticket claimed by ${i.user.tag}`);
        return i.reply({ content: "Claimed", ephemeral: true });
      }

      if (i.customId === "close_ticket") {
        const file = await transcripts.createTranscript(i.channel);
        const logCh = i.guild.channels.cache.get(LOG_CHANNEL);
        if (logCh) logCh.send({ files: [file] });

        await Ticket.deleteOne({ channelId: i.channel.id });

        await i.reply({ content: "Closing...", ephemeral: true });
        setTimeout(() => i.channel.delete().catch(()=>{}), 2000);
      }
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) i.reply({ content: "Error", ephemeral: true }).catch(()=>{});
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
