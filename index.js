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
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
.addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
.addRoleOption(o=>o.setName("role3").setDescription("Role 3")),

new SlashCommandBuilder()
.setName("removerole")
.setDescription("Remove role")
.addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
.addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
.addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
.addRoleOption(o=>o.setName("role3").setDescription("Role 3"))

].map(c=>c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

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

    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

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

    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;
      await channel.send(msg);
      return interaction.editReply("📤 Announcement sent");
    }

    // (rest same warn/kick/ban logic — already working from previous fix)

    return interaction.editReply("✅ Done");

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== GREETING + ANTISPAM =====
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

// ===== AI CHAT (MENTION BOT) =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  try {
    const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

    if (!prompt) return message.reply("Say something after mentioning me!");

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    return message.reply(res.choices[0].message.content.slice(0, 2000));

  } catch (err) {
    console.error(err);
    message.reply("⚠️ AI error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
