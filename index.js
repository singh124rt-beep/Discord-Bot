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

console.log("🔥 BOT STARTING...");

// ================= ENV CHECK =================
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing DISCORD_BOT_TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI");

// ================= EXPRESS =================
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(console.error);

// ================= AI =================
const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= WARN MODEL =================
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: [{ reason: String, date: String }]
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

// ================= CONFIG =================
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ================= ANTI SPAM =================
const spamMap = new Map();

function isSpam(id, msg) {
  const now = Date.now();
  const data = spamMap.get(id) || { count: 0, last: "", time: now };

  if (now - data.time > 4000) {
    spamMap.set(id, { count: 1, last: msg, time: now });
    return false;
  }

  data.count = (data.last === msg) ? data.count + 1 : 1;
  data.last = msg;
  data.time = now;

  spamMap.set(id, data);

  return data.count >= 5;
}

// ================= SAFE DESCRIPTION HELPER =================
const desc = (text) => typeof text === "string" ? text : "No description";

// ================= COMMANDS (FIXED ALL CRASHES) =================
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription(desc("Ping command")),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription(desc("Send announcement"))
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true))
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel")
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o =>
      o.setName("image")
        .setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription(desc("Show server info")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription(desc("Warn user"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription(desc("Remove warn"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription(desc("Clear warns"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription(desc("Show warned users")),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription(desc("Show warn history"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription(desc("Kick user"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription(desc("Ban user"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription(desc("Timeout user"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName("duration")
        .setDescription("Minutes")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription(desc("Remove timeout"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription(desc("Delete messages"))
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("Amount")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription(desc("Add role"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription(desc("Remove role"))
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Target user")
        .setRequired(true))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("🚀 Commands Registered");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  let replied = false;

  const safe = (msg) => {
    replied = true;
    return interaction.editReply(msg);
  };

  try {
    const cmd = interaction.commandName;

    await interaction.deferReply();

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // ================= SERVER INFO =================
    if (cmd === "serverinfo") {
      return safe({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setColor("Blue")
            .setDescription(`👋 Welcome to City Role Play!

Hey there! We're glad to have you join our city 🌆
This server is all about creating your own story and living your role.

🎭 Pick Your Role
Citizen, Police, Criminal, Business Owner

📜 Rules First
Follow RP rules

🚀 Get Started
Start your journey

💬 Need Help?
Staff is here`)
        ]
      });
    }

    // ================= WARN FIXED (24H AFTER 3) =================
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns = 24h timeout");
        data.warns = 0;
        data.history = [];
        await interaction.channel.send(`🚫 <@${member.id}> got 24h timeout`);
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)`);
      }

      await data.save();
      return safe("Warn added");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return safe(all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return safe("No history");

      return safe(data.history.map((h, i) => `${i + 1}. ${h.reason}`).join("\n"));
    }

  } catch (err) {
    console.error(err);

    if (!replied) {
      try {
        return interaction.editReply("❌ Error occurred");
      } catch {
        return interaction.followUp({ content: "❌ Error", ephemeral: true });
      }
    }
  }
});

// ================= GREETINGS + ANTI SPAM =================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (isSpam(msg.author.id, msg.content)) {
    msg.delete().catch(() => {});
    return msg.channel.send(`⚠️ Stop spamming ${msg.author}`);
  }

  const text = msg.content.toLowerCase();

  if (["hi", "hello", "hey"].includes(text)) {
    return msg.reply(`👋 Greetings, ${msg.author.username} Welcome to CRP 🌆`);
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
