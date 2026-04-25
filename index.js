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

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

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
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("🚀 Commands synced");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const publicCmds = ["serverinfo"];

  await interaction.deferReply({ ephemeral: !publicCmds.includes(cmd) });

  try {
    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id) : null;

    // ===== PING =====
    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

    // ===== SERVER INFO =====
    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setDescription(`👋 Welcome to City Role Play!

🎭 Pick your role and enjoy RP

📜 Follow rules

🚀 Start your journey`)
        ]
      });
    }

    // ===== ANNOUNCE =====
    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;

      await channel.send(msg);
      return interaction.editReply("📤 Announcement sent");
    }

    // ===== WARN =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });
      await data.save();

      await interaction.editReply("✅ Warned");

      await interaction.channel.send(`⚠️ <@${member.id}> has been warned (${data.warns}/3)\nReason: ${reason}`);

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        await interaction.channel.send(`🚫 <@${member.id}> timed out for 24 hours`);
        data.warns = 0;
        data.history = [];
        await data.save();
      }
    }

    // ===== KICK =====
    if (cmd === "kick") {
      const reason = interaction.options.getString("reason");

      await member.kick(reason);

      await interaction.editReply("✅ Kicked");
      await interaction.channel.send(`🦶 <@${member.id}> has been kicked\nReason: ${reason}`);
    }

    // ===== BAN =====
    if (cmd === "ban") {
      const reason = interaction.options.getString("reason");

      await member.ban({ reason });

      await interaction.editReply("✅ Banned");
      await interaction.channel.send(`🔨 <@${member.id}> has been banned\nReason: ${reason}`);
    }

    // ===== TIMEOUT =====
    if (cmd === "timeout") {
      const mins = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason");

      await member.timeout(mins * 60000, reason);

      await interaction.editReply("✅ Timed out");
      await interaction.channel.send(`⏳ <@${member.id}> timed out for ${mins} mins\nReason: ${reason}`);
    }

    // ===== UNTIMEOUT =====
    if (cmd === "untimeout") {
      await member.timeout(null);

      await interaction.editReply("✅ Timeout removed");
      await interaction.channel.send(`✅ <@${member.id}> timeout removed`);
    }

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error occurred");
  }
});

// ===== GREETING =====
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;

  const text = msg.content.toLowerCase();

  if (["hi","hello","hey"].includes(text)) {
    msg.reply(`👋 Greetings, ${msg.author.username}! Welcome to CRP`);
  }
});

// ===== AI =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return message.reply("⚠️ AI not configured");
    }

    const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    message.reply(res.choices[0].message.content);

  } catch (err) {
    console.error(err);
    message.reply("⚠️ AI error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
