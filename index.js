const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const prism = require("prism-media");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  EndBehaviorType
} = require("@discordjs/voice");

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

// ===== DATABASE =====
let dbReady = false;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Mongo Connected");
    dbReady = true;
  })
  .catch(err => console.log("❌ Mongo Error:", err.message));

// ===== WARN SCHEMA =====
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
    GatewayIntentBits.GuildVoiceStates
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

// ===== RECORD STORAGE =====
const recordings = new Map();

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("record")
    .setDescription("Start recording VC"),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop recording")

].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Commands Registered");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // PERMISSION CHECK
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply("❌ Not allowed");
    }

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {

      if (!dbReady) return interaction.reply("⚠️ DB not connected");

      const member = interaction.options.getMember("user");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        data.warns = 0;
        await data.save();
        return interaction.reply("⚠️ 3 warns → Timeout");
      }

      await data.save();
      return interaction.reply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== RECORD =====
    if (interaction.commandName === "record") {

      const vc = interaction.member.voice.channel;

      if (!vc) return interaction.reply("❌ Join VC first");

      const connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      const receiver = connection.receiver;

      recordings.set(vc.guild.id, {
        connection,
        receiver,
        files: []
      });

      receiver.speaking.on("start", (userId) => {
        const opus = receiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000
          }
        });

        const decoder = new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960
        });

        const file = `rec-${userId}-${Date.now()}.pcm`;
        const out = fs.createWriteStream(file);

        opus.pipe(decoder).pipe(out);

        recordings.get(vc.guild.id).files.push(file);
      });

      return interaction.reply(`🎙️ Recording started in ${vc.name}`);
    }

    // ===== STOP =====
    if (interaction.commandName === "stop") {

      const data = recordings.get(interaction.guild.id);

      if (!data) return interaction.reply("❌ No recording running");

      data.connection.destroy();

      recordings.delete(interaction.guild.id);

      if (data.files.length === 0) {
        return interaction.reply("⚠️ No audio recorded");
      }

      return interaction.reply({
        content: "📁 Recording file:",
        files: [data.files[0]]
      });
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
