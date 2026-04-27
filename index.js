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
  EmbedBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField
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
  reason: String,
  date: { type: Date, default: Date.now }
}));

const Counter = mongoose.model("Counter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
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

// ================= PERMISSION =================
function isAllowed(i) {
  return (
    ALLOWED_USERS.includes(i.user.id) ||
    i.member.roles.cache.has(ADMIN_ROLE)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel to send message")
    )
    .addAttachmentOption(o =>
      o.setName("image1").setDescription("Image 1")
    )
    .addAttachmentOption(o =>
      o.setName("image2").setDescription("Image 2")
    )
    .addAttachmentOption(o =>
      o.setName("image3").setDescription("Image 3")
    ),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Create ticket panel"),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warn")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show warn history of all users"),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("time").setDescription("Minutes").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add role")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role").setDescription("Role").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role").setDescription("Role").setRequired(true)
    )

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands
  });

  console.log("✅ All commands loaded successfully");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {
  try {

    if (i.user.id === BLOCKED_USER)
      return i.reply({ content: "❌ Blocked user", ephemeral: true });

    if (i.isChatInputCommand()) await i.deferReply({ ephemeral: true });

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      for (let x = 1; x <= 3; x++) {
        const img = i.options.getAttachment(`image${x}`);
        if (img) files.push(img.url);
      }

      await ch.send({ content: msg, files });

      return i.editReply("📤 Sent");
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!isAllowed(i)) return i.editReply("❌ No permission");

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Create Ticket")
        .setDescription("To open a ticket 🎟️ Click below 👇");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("open_ticket")
          .setLabel("Create Ticket")
          .setStyle(ButtonStyle.Primary)
      );

      return i.channel.send({ embeds: [embed], components: [row] });
    }

    // ================= OPEN TICKET =================
    if (i.isButton() && i.customId === "open_ticket") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_type")
        .setPlaceholder("Select Ticket Type")
        .addOptions([
          { label: "Support", value: "Support" },
          { label: "Report", value: "Report" },
          { label: "Payment Issue", value: "Payment Issue" }
        ]);

      return i.reply({
        content: "Select ticket type",
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    // ================= CREATE TICKET =================
    if (i.isStringSelectMenu() && i.customId === "ticket_type") {

      const counter = await Counter.findOneAndUpdate(
        { guildId: i.guild.id },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );

      const id = counter.count;

      const channel = await i.guild.channels.create({
        name: `ticket-${id}`,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel", "SendMessages"] }
        ]
      });

      await channel.send({
        content: `<@&${ADMIN_ROLE}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle(`🎫 Ticket #${id}`)
            .addFields(
              { name: "Name", value: `<@${i.user.id}>` },
              { name: "Type", value: i.values[0] },
              { name: "Describe your issue", value: "Write your issue here" }
            )
            .setFooter({ text: "Our team will assist you shortly" })
        ]
      });

      return i.editReply("✅ Ticket Created");
    }

  } catch (err) {
    console.error(err);
    if (i.deferred || i.replied)
      i.editReply("❌ Error occurred");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
