const express = require("express");
const mongoose = require("mongoose");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ TOKEN MISSING");
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI MISSING");
  process.exit(1);
}

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(3000, () => console.log("🌐 Web server running"));

// ===== MONGODB =====
let dbReady = false;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    dbReady = true;
  })
  .catch(err => {
    console.log("❌ Mongo Error:", err.message);
  });

// ===== WARN MODEL =====
const warnSchema = new mongoose.Schema({
  userId: String,
  warns: Number
});
const Warn = mongoose.model("Warn", warnSchema);

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates // IMPORTANT
  ]
});

// ===== ALLOWED USERS =====
const allowedUsers = [
  "1448606724100456459",
  "1459503999786156208",
  "1361186641376575549",
  "1362716515614331102",
  "1373195250109120532",
  "1390273705606905929",
  "1393623467152375931",
  "1372228255251173496",
  "1366486815498043575",
  "1361196452415537194",
  "1390678438461046794",
  "1390703042667745421",
  "1390677954727645204",
  "1390702962837291028",
  "1390677707020570624"
];

// ===== BAD WORDS =====
const badWords = ["madarchod", "bhosdike", "chutiya", "gandu"];

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
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
    .addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true)),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Give roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role")),

  // 🎙️ JOIN (CRAIG STYLE BASIC)
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join your VC (recording system basic)")

].map(c => c.toJSON());

// ===== REGISTER =====
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

client.once("ready", async () => {
  console.log(`🟢 LOGGED IN AS ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ COMMANDS REGISTERED");
});

// ===== MESSAGE EVENTS =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.toLowerCase();

  // 🚫 Abuse
  if (badWords.some(word => content.includes(word))) {
    try {
      await msg.delete();
      await msg.member.timeout(24 * 60 * 60 * 1000, "Abuse");
      msg.channel.send(`🚫 ${msg.author} abused → Timeout`);
    } catch {}
  }

  // 🚫 Tag spam
  if (msg.mentions.users.size >= 5) {
    try {
      await msg.delete();
      await msg.member.timeout(24 * 60 * 60 * 1000, "Tag spam");
      msg.channel.send(`🚫 ${msg.author} tag spam → Timeout`);
    } catch {}
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // 🔐 PERMISSION
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: "❌ Not allowed", ephemeral: true });
    }

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== JOIN VC =====
    if (interaction.commandName === "join") {

      const vc = interaction.member.voice.channel;

      if (!vc) {
        return interaction.reply({ content: "❌ Join VC first", ephemeral: true });
      }

      return interaction.reply(`🎙️ Joined **${vc.name}** (Recording soon...)`);
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");

      await channel.send(msg);
      return interaction.reply({ content: "✅ Sent", ephemeral: true });
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {

      if (!dbReady) {
        return interaction.reply({ content: "⚠️ Database not connected", ephemeral: true });
      }

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns");
        data.warns = 0;
        await data.save();

        return interaction.reply({ content: "⚠️ 3 warns → Timeout", ephemeral: true });
      }

      await data.save();
      return interaction.reply({ content: `⚠️ Warned (${data.warns}/3)`, ephemeral: true });
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data) return interaction.reply({ content: "❌ No warns", ephemeral: true });

      data.warns = Math.max(data.warns - 1, 0);
      await data.save();

      return interaction.reply({ content: `✅ Warn removed (${data.warns})`, ephemeral: true });
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Deleted ${amount}`, ephemeral: true });
    }

    // ===== ROLE =====
    if (interaction.commandName === "role") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) {
        await member.roles.add(role);
      }

      return interaction.reply({ content: "✅ Roles added", ephemeral: true });
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.reply({ content: "👢 Kicked", ephemeral: true });
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.reply({ content: "🔨 Banned", ephemeral: true });
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      const reason = interaction.options.getString("reason");

      await member.timeout(time * 60 * 1000, reason);
      return interaction.reply({ content: `⏱️ Timeout ${time} min`, ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      return interaction.reply({ content: "❌ Error occurred", ephemeral: true });
    }
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
