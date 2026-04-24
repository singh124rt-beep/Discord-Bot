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

// ================= ENV =================
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

// ================= WARN DB =================
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

function antiSpam(id, content) {
  const now = Date.now();
  const data = spamMap.get(id) || { count: 0, last: "", time: now };

  if (now - data.time > 4000) {
    spamMap.set(id, { count: 1, last: content, time: now });
    return false;
  }

  data.count = data.last === content ? data.count + 1 : 1;
  data.last = content;
  data.time = now;

  spamMap.set(id, data);

  return data.count >= 5;
}

// ================= SAFE DESC =================
const d = (x) => typeof x === "string" ? x : "No description";

// ================= COMMANDS =================
const commands = [

new SlashCommandBuilder()
.setName("ping")
.setDescription(d("Ping command")),

new SlashCommandBuilder()
.setName("announce")
.setDescription(d("Send announcement"))
.addStringOption(o =>
  o.setName("message").setDescription("Message").setRequired(true))
.addChannelOption(o =>
  o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText))
.addStringOption(o =>
  o.setName("image").setDescription("Image URL")),

new SlashCommandBuilder()
.setName("serverinfo")
.setDescription(d("Show server info")),

new SlashCommandBuilder()
.setName("warn")
.setDescription(d("Warn user"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o =>
  o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("unwarn")
.setDescription(d("Remove warn"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("clearwarn")
.setDescription(d("Clear warns"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("warnlist")
.setDescription(d("Show warn list")),

new SlashCommandBuilder()
.setName("warninfo")
.setDescription(d("Warn history"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("kick")
.setDescription(d("Kick user"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o =>
  o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription(d("Ban user"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o =>
  o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("timeout")
.setDescription(d("Timeout user"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true))
.addIntegerOption(o =>
  o.setName("duration").setDescription("Minutes").setRequired(true))
.addStringOption(o =>
  o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("untimeout")
.setDescription(d("Remove timeout"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("purge")
.setDescription(d("Delete messages"))
.addIntegerOption(o =>
  o.setName("amount").setDescription("Amount").setRequired(true)),

new SlashCommandBuilder()
.setName("addrole")
.setDescription(d("Add role"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("removerole")
.setDescription(d("Remove role"))
.addUserOption(o =>
  o.setName("user").setDescription("User").setRequired(true))

].map(c => c.toJSON());

// ================= READY (FIXED SLASH REGISTRATION) =================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

    console.log("⏳ Syncing slash commands...");

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("🚀 Slash commands synced successfully");
  } catch (err) {
    console.error("❌ Slash command error:", err);
  }
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  try {
    const cmd = interaction.commandName;

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // ================= SERVER INFO =================
    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setColor("Blue")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setDescription(`👋 Welcome to City Role Play!

🎭 Choose roles like Police, Criminal, Business Owner

📜 Follow rules

🚀 Enjoy RP experience`)
        ]
      });
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
        await interaction.channel.send(`🚫 <@${member.id}> got 24h timeout`);
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)`);
      }

      await data.save();
      return interaction.editReply("Warn added");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(data.history.map((h, i) => `${i + 1}. ${h.reason}`).join("\n"));
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ================= GREETINGS + ANTI SPAM =================
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (antiSpam(msg.author.id, msg.content)) {
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
