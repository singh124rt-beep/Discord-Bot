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

// ================= MONGO =================
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

function antiSpam(id, content) {
  const now = Date.now();

  if (!spamMap.has(id)) {
    spamMap.set(id, { count: 1, last: content, time: now });
    return false;
  }

  const data = spamMap.get(id);

  if (now - data.time > 4000) {
    spamMap.set(id, { count: 1, last: content, time: now });
    return false;
  }

  if (data.last === content) data.count++;
  else data.count = 1;

  data.last = content;
  data.time = now;

  return data.count >= 5;
}

// ================= COMMANDS =================
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
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),
  new SlashCommandBuilder().setName("warninfo").setDescription("Warn history"),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
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

  try {
    const cmd = interaction.commandName;
    const publicCmds = ["serverinfo", "warnlist", "warninfo"];

    await interaction.deferReply({ ephemeral: !publicCmds.includes(cmd) });

    const safeReply = (data) => {
      replied = true;
      return interaction.editReply(data);
    };

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // ================= SERVER INFO (YOUR ORIGINAL) =================
    if (cmd === "serverinfo") {
      return safeReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setColor("Blue")
            .setDescription(`👋 Welcome to City Role Play!

Hey there! We're glad to have you join our city 🌆
This server is all about creating your own story and living your role.

🎭 Pick Your Role
Choose a role that fits your character—citizen, police, criminal, business owner, or anything in between!

📜 Rules First
Before you start, make sure to read the rules carefully.

🚀 Get Started
Head over to role selection channel.

💬 Need Help?
We’re here to help.

Enjoy Playing City Role Play 🎉`)
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
      return safeReply("Warn added");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return safeReply(all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return safeReply("No history");

      return safeReply(data.history.map((h, i) => `${i + 1}. ${h.reason}`).join("\n"));
    }

  } catch (err) {
    console.error("ERROR:", err);

    if (!replied) {
      try {
        return interaction.editReply("❌ Error occurred");
      } catch {
        return interaction.followUp({ content: "❌ Critical error", ephemeral: true });
      }
    }
  }
});

// ================= GREETING + ANTI SPAM =================
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

// ================= LOGIN (FIXED SAFE) =================
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log("🤖 Logged in successfully"))
  .catch(err => console.error("❌ LOGIN FAILED:", err));
