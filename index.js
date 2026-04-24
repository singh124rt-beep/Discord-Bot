// =====================================================
//                    CRP DISCORD BOT
// =====================================================

const express = require("express");
const mongoose = require("mongoose");
const OpenAI = require("openai");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder
} = require("discord.js");

// ===================== START LOG =====================
console.log("🔥 BOT STARTING...");

// ===================== ENV CHECK =====================
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// =====================================================
//                      EXPRESS SERVER
// =====================================================
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000, () => console.log("🌐 Web server running"));

// =====================================================
//                        DATABASE
// =====================================================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ Mongo Connected"))
.catch(err => console.log("❌ DB Error", err));

// =====================================================
//                         AI
// =====================================================
const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// =====================================================
//                      WARN SYSTEM
// =====================================================
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: [{ reason: String, date: String }]
}));

// =====================================================
//                      DISCORD CLIENT
// =====================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================================================
//                    CONFIGURATION
// =====================================================
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

const purgeRoleId = "1390273593040048220";

// =====================================================
//                   ANTI-SPAM SYSTEM
// =====================================================
const spamMap = new Map();

function isSpamming(userId, content) {
  const now = Date.now();

  if (!spamMap.has(userId)) {
    spamMap.set(userId, { count: 1, last: content, time: now });
    return false;
  }

  const data = spamMap.get(userId);

  if (now - data.time > 4000) {
    spamMap.set(userId, { count: 1, last: content, time: now });
    return false;
  }

  if (data.last === content) data.count++;
  else data.count = 1;

  data.last = content;
  data.time = now;

  spamMap.set(userId, data);

  return data.count >= 5;
}

// =====================================================
//                    SLASH COMMANDS
// =====================================================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping command"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info (PUBLIC)"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),
  new SlashCommandBuilder().setName("warninfo").setDescription("Warn history"),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warning")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warnings")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

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
    .addIntegerOption(o => o.setName("duration").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))

].map(c => c.toJSON());

// =====================================================
//                      READY EVENT
// =====================================================
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("🚀 Commands Registered");
});

// =====================================================
//                 INTERACTION HANDLER
// =====================================================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const publicCmds = ["serverinfo", "warnlist", "warninfo"];

  await interaction.deferReply({ ephemeral: !publicCmds.includes(cmd) });

  try {

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // ================= SERVER INFO =================
    if (cmd === "serverinfo") {
      const embed = new EmbedBuilder()
        .setTitle("🌆 City Role Play")
        .setColor("Blue")
        .setDescription(`👋 Welcome to City Role Play!

🎭 Create your RP story
📜 Follow rules
🚀 Enjoy the city life
💬 Be active and have fun`);

      return interaction.editReply({ embeds: [embed] });
    }

    // ================= WARN SYSTEM =================
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns = 24h timeout");
        data.warns = 0;
        data.history = [];

        await interaction.channel.send(`🚫 <@${member.id}> got 24h timeout (3 warns)`);
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)`);
      }

      await data.save();
      return interaction.editReply("Warn added");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(
        all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns"
      );
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(
        data.history.map((h, i) => `${i + 1}. ${h.reason} (${h.date})`).join("\n")
      );
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// =====================================================
//                 GREETING SYSTEM (ALL USERS)
// =====================================================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (isSpamming(msg.author.id, msg.content)) {
    msg.delete().catch(() => {});
    return msg.channel.send(`⚠️ Stop spamming ${msg.author}`);
  }

  const text = msg.content.toLowerCase();

  if (["hi", "hello", "hey"].includes(text)) {
    return msg.reply(`👋 Greetings, ${msg.author.username} Welcome to CRP 🌆`);
  }
});

// =====================================================
//                        LOGIN
// =====================================================
client.login(process.env.DISCORD_BOT_TOKEN);
