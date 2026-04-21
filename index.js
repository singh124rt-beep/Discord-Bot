const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const prism = require("prism-media");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  EndBehaviorType
} = require("@discordjs/voice");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) process.exit(1);
if (!process.env.MONGO_URI) process.exit(1);

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DATABASE =====
let dbReady = false;
mongoose.connect(process.env.MONGO_URI)
  .then(() => { console.log("Mongo Connected"); dbReady = true; })
  .catch(err => console.log("Mongo Error:", err.message));

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
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ===== PERMISSIONS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459"
];

const ADM_ROLE = "adm";

// ===== CRAIG SYSTEM STORAGE =====
const recordings = new Map();
const activeUsers = new Set();

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("time").setRequired(true)),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Give roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3")),

  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Start recording")
    .addChannelOption(o =>
      o.setName("channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop recording"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true))

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in: ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    const member = interaction.member;
    const userId = interaction.user.id;

    const isAdm = member.roles.cache.some(r => r.name.toLowerCase() === ADM_ROLE);
    const isAllowed = allowedUsers.includes(userId);

    if (["join", "stop", "purge"].includes(interaction.commandName)) {
      if (!isAdm) return interaction.reply("❌ Only ADM");
    }

    if (["kick","ban","warn","role","announce"].includes(interaction.commandName)) {
      if (!isAllowed) return interaction.reply("❌ No permission");
    }

    // ===== JOIN (FIXED CRAIG SYSTEM) =====
    if (interaction.commandName === "join") {

      const channel = interaction.options.getChannel("channel");

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      const receiver = connection.receiver;

      recordings.set(channel.guild.id, {
        connection,
        receiver,
        files: []
      });

      receiver.speaking.on("start", (userId) => {

        if (activeUsers.has(userId)) return;
        activeUsers.add(userId);

        const data = recordings.get(channel.guild.id);
        if (!data) return;

        const opus = receiver.subscribe(userId);

        const decoder = new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960
        });

        const pcm = `rec-${userId}-${Date.now()}.pcm`;
        const wav = pcm.replace(".pcm", ".wav");

        const out = fs.createWriteStream(pcm);

        opus.pipe(decoder).pipe(out);

        out.on("finish", () => {

          ffmpeg(pcm)
            .inputFormat("s16le")
            .audioFrequency(48000)
            .audioChannels(2)
            .save(wav)
            .on("end", () => {

              if (fs.existsSync(pcm)) fs.unlinkSync(pcm);

              const rec = recordings.get(channel.guild.id);
              if (rec) rec.files.push(wav);

              activeUsers.delete(userId);

            });

        });

      });

      return interaction.reply(`🎙️ Recording started in ${channel.name}`);
    }

    // ===== STOP (MERGE CRAIG STYLE) =====
    if (interaction.commandName === "stop") {

      const data = recordings.get(interaction.guild.id);
      if (!data) return interaction.reply("❌ No recording");

      data.connection.destroy();
      recordings.delete(interaction.guild.id);

      const files = fs.readdirSync(".")
        .filter(f => f.startsWith("rec-") && f.endsWith(".wav"));

      if (!files.length) return interaction.reply("⚠️ No audio");

      const output = `merged-${Date.now()}.wav`;

      const ff = ffmpeg();

      files.forEach(f => ff.input(f));

      ff
        .complexFilter([`amix=inputs=${files.length}:duration=longest`])
        .audioFrequency(48000)
        .audioChannels(2)
        .save(output)
        .on("end", () => {

          files.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));

          interaction.followUp({
            content: "📁 CRAIG OUTPUT:",
            files: [output]
          });

        });

      return interaction.reply("⏹ Stopping...");
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply(`🧹 Deleted ${amount}`);
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      await channel.send(msg);
      return interaction.reply("✅ Sent");
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
