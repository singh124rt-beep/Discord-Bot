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

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== EXPRESS =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(console.error);

// ===== AI =====
const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===== WARN MODEL =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: [{ reason: String, date: String }]
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ===== ANTI SPAM =====
const spam = new Map();
function isSpam(id, msg) {
  const now = Date.now();
  const data = spam.get(id) || { count: 0, last: "", time: now };

  if (now - data.time > 4000) {
    spam.set(id, { count: 1, last: msg, time: now });
    return false;
  }

  data.count = data.last === msg ? data.count + 1 : 1;
  data.last = msg;
  data.time = now;

  spam.set(id, data);
  return data.count >= 5;
}

// ===== COMMANDS =====
const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Ping"),

new SlashCommandBuilder()
.setName("announce")
.setDescription("Announcement")
.addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true))
.addChannelOption(o=>o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText))
.addStringOption(o=>o.setName("image").setDescription("Image")),

new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("unwarn")
.setDescription("Unwarn")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("clearwarn")
.setDescription("Clear warn")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),

new SlashCommandBuilder()
.setName("warninfo")
.setDescription("Warn info")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("timeout")
.setDescription("Timeout")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addIntegerOption(o=>o.setName("duration").setDescription("Minutes").setRequired(true))
.addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

new SlashCommandBuilder()
.setName("untimeout")
.setDescription("Untimeout")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("purge")
.setDescription("Purge")
.addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

new SlashCommandBuilder()
.setName("addrole")
.setDescription("Add role")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

new SlashCommandBuilder()
.setName("removerole")
.setDescription("Remove role")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))

].map(c=>c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("🚀 Commands loaded");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const publicCmds = ["serverinfo"];

  await interaction.deferReply({
    ephemeral: !publicCmds.includes(interaction.commandName)
  });

  try {
    const cmd = interaction.commandName;
    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(()=>null) : null;

    // ===== SERVER INFO =====
    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setDescription(`👋 Welcome to City Role Play!

🎭 Pick your role  
📜 Follow rules  
🚀 Enjoy RP`)
            .setColor("Blue")
        ]
      });
    }

    // ===== PING =====
    if (cmd === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== WARN =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        data.warns = 0;
        data.history = [];
        await interaction.channel.send(`🚫 <@${member.id}> got 24h timeout`);
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)`);
      }

      await data.save();
      return interaction.editReply("Warn added");
    }

    // ===== WARN LIST =====
    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(all.map(w=>`<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns");
    }

    // ===== DEFAULT =====
    return interaction.editReply("✅ Command executed");

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== GREETING =====
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  if (isSpam(msg.author.id, msg.content)) {
    msg.delete().catch(()=>{});
    return msg.channel.send(`⚠️ Stop spamming ${msg.author}`);
  }

  if (["hi","hello","hey"].includes(msg.content.toLowerCase())) {
    msg.reply(`👋 Greetings, ${msg.author.username} Welcome to CRP 🌆`);
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
