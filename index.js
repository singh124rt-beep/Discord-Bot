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
const ai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

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
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true))
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
  const isPublic = cmd === "serverinfo";

  try {
    // reply immediately (NO STUCK)
    if (isPublic) {
      await interaction.reply({ content: "⏳ Loading...", ephemeral: false });
    } else {
      await interaction.reply({ content: "⏳ CRP Management is thinking...", ephemeral: true });
    }

    const allowed = allowedUsers.includes(interaction.user.id);
    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(()=>null) : null;

    if (!isPublic && !allowed) {
      return interaction.editReply("❌ No permission");
    }

    // ===== SERVER INFO =====
    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setDescription(`👋 Welcome to City Role Play!

🎭 Police | Criminal | Business

📜 Follow rules & enjoy RP

🚀 Build your story`)
            .setColor("Blue")
        ]
      });
    }

    if (cmd === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;

      await channel.send(msg); // PUBLIC
      return interaction.editReply("📤 Announcement sent"); // PRIVATE
    }

    // ===== WARN =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        await interaction.channel.send(`🚫 <@${member.id}> got 3 warns → 24h timeout`);
        data.warns = 0;
        data.history = [];
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)\nReason: ${reason}`);
      }

      await data.save();
      return interaction.editReply("✅ Warn added");
    }

    // ===== KICK =====
    if (cmd === "kick") {
      const reason = interaction.options.getString("reason");

      await member.kick(reason);
      await interaction.channel.send(`🦶 <@${member.id}> has been kicked\nReason: ${reason}`);

      return interaction.editReply("✅ Kicked");
    }

    // ===== BAN =====
    if (cmd === "ban") {
      const reason = interaction.options.getString("reason");

      await member.ban({ reason });
      await interaction.channel.send(`🔨 <@${member.id}> banned\nReason: ${reason}`);

      return interaction.editReply("✅ Banned");
    }

    // ===== PURGE =====
    if (cmd === "purge") {
      const amount = interaction.options.getInteger("amount");

      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount} messages`);
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }
});

// ===== GREETING =====
client.on("messageCreate", msg => {
  if (msg.author.bot) return;

  if (["hi","hello","hey"].includes(msg.content.toLowerCase())) {
    msg.reply(`👋 Greetings, ${msg.author.username}! Welcome to CRP 🌆`);
  }
});

// ===== AI =====
client.on("messageCreate", async (message) => {
  if (!ai) return;
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  try {
    const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    message.reply(res.choices[0].message.content.slice(0, 2000));
  } catch {
    message.reply("⚠️ AI error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
