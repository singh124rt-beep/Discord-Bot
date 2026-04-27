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

// ================= SAFETY =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= CONFIG =================
const ADMIN_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";
const BLOCKED_USER = "1366502670788984902";

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
  warns: Number,
  reason: String,
  date: { type: Date, default: Date.now }
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

// ================= PERMISSIONS =================
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

function isAdmin(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Bot ping"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setRequired(true)),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove 1 warn")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns"),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warn history"),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("time").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setRequired(true))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("✅ Commands loaded");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.user.id === BLOCKED_USER)
      return i.reply({ content: "❌ Blocked", ephemeral: true });

    // ALWAYS SAFE DEFER FOR SLASH COMMANDS
    if (i.isChatInputCommand()) {
      await i.deferReply({ ephemeral: true });

      // ================= PING =================
      if (i.commandName === "ping")
        return i.editReply(`🏓 ${client.ws.ping}ms`);

      // ================= SERVER INFO =================
      if (i.commandName === "serverinfo")
        return i.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(i.guild.name)
              .setDescription(`Members: ${i.guild.memberCount}`)
              .setColor("Blue")
          ]
        });

      // ================= ANNOUNCE =================
      if (i.commandName === "announce") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const msg = i.options.getString("message");
        await i.channel.send({ content: msg });

        return i.editReply("📤 Sent");
      }

      // ================= TICKET PANEL =================
      if (i.commandName === "ticketpanel") {
        if (!isAdmin(i)) return i.editReply("❌ No permission");

        const embed = new EmbedBuilder()
          .setTitle("🎟️ Ticket System")
          .setDescription("To open a ticket 🎟️ Click below 👇")
          .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_ticket")
            .setLabel("Create Ticket")
            .setStyle(ButtonStyle.Primary)
        );

        await i.channel.send({ embeds: [embed], components: [row] });

        return i.editReply("📤 Sent");
      }

      // ================= CLOSE =================
      if (i.commandName === "close") {
        if (!isAdmin(i)) return i.editReply("❌ No permission");

        const file = await transcripts.createTranscript(i.channel);

        const ch = i.guild.channels.cache.get(LOG_CHANNEL);
        if (ch) ch.send({ files: [file] });

        await i.editReply("🔒 Closing...");
        setTimeout(() => i.channel.delete(), 2000);
      }

      // ================= WARN =================
      if (i.commandName === "warn") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const user = i.options.getUser("user");
        const reason = i.options.getString("reason");

        await Warn.create({ userId: user.id, warns: 1, reason });

        return i.editReply(`⚠️ Warned ${user.tag}`);
      }

      // ================= UNWARN =================
      if (i.commandName === "unwarn") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const user = i.options.getUser("user");

        await Warn.findOneAndDelete({ userId: user.id });

        return i.editReply("✅ Warn removed");
      }

      // ================= CLEARWARN =================
      if (i.commandName === "clearwarn") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        await Warn.deleteMany({});

        return i.editReply("🧹 All warns cleared");
      }

      // ================= WARNLIST (GLOBAL HISTORY) =================
      if (i.commandName === "warnlist") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const data = await Warn.find();

        if (!data.length) return i.editReply("No warns found");

        const list = data.map(w =>
          `User: <@${w.userId}> | Reason: ${w.reason}`
        ).join("\n");

        return i.editReply("📋 WARN HISTORY:\n" + list);
      }

      // ================= TIMEOUT =================
      if (i.commandName === "timeout") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const user = i.options.getUser("user");
        const time = i.options.getInteger("time");

        const m = await i.guild.members.fetch(user.id);
        await m.timeout(time * 60000);

        return i.editReply("⏳ Timed out");
      }

      // ================= UNTIMEOUT =================
      if (i.commandName === "untimeout") {
        if (!isAllowed(i)) return i.editReply("❌ No permission");

        const user = i.options.getUser("user");

        const m = await i.guild.members.fetch(user.id);
        await m.timeout(null);

        return i.editReply("✅ Timeout removed");
      }
    }

    // ================= BUTTON =================
    if (i.isButton() && i.customId === "open_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment Issue" }
        ]);

      return i.reply({
        content: "Select type:",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= TICKET CREATE (FIXED FORMAT) =================
    if (i.isStringSelectMenu() && i.customId === "ticket_select") {

      await i.deferReply({ ephemeral: true });

      const ch = await i.guild.channels.create({
        name: `ticket-${Date.now()}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      // ADMIN TAG FIRST
      await ch.send(`<@&${ADMIN_ROLE}>`);

      // CLEAN FORMAT
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setDescription(
`Name: ${i.user}

Type: ${i.values[0]}

Describe your issue:

Our team Will assist you shortly`
            )
        ]
      });

      return i.editReply("✅ Ticket created");
    }

  } catch (e) {
    console.error(e);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
