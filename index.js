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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const {
  joinVoiceChannel,
  EndBehaviorType
} = require("@discordjs/voice");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing DISCORD_BOT_TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI");

// ===== EXPRESS =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(console.error);

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
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ===== ADMINS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ===== AUTOMOD =====
const badWords = ["madarchod", "bhosdike", "chutiya", "gandu"];

// ===== RECORD STORAGE =====
const recordings = new Map();

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

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
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3")),

  // 🎙️ RECORD
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Start recording VC")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Voice channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop recording")

].map(c => c.toJSON());

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const isAllowed = allowedUsers.includes(interaction.user.id);
  const member = interaction.options.getMember("user");

  if (interaction.commandName !== "ping" && !isAllowed)
    return interaction.reply({ content: "❌ No permission", ephemeral: true });

  // ===== ANNOUNCE =====
  if (interaction.commandName === "announce") {
    const msg = interaction.options.getString("message");
    const channel = interaction.options.getChannel("channel");
    const image = interaction.options.getString("image");

    const embed = new EmbedBuilder()
      .setDescription(msg)
      .setColor(0x2b2d31);

    if (image) embed.setImage(image);

    await channel.send({ embeds: [embed] });

    return interaction.reply({ content: "✅ Sent", ephemeral: true });
  }

  // ===== JOIN RECORD =====
  if (interaction.commandName === "join") {

    const channel = interaction.options.getChannel("channel");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    const receiver = connection.receiver;

    const data = { connection, receiver, files: [] };
    recordings.set(channel.guild.id, data);

    receiver.speaking.on("start", (userId) => {
      const opus = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
      });

      const decoder = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
      });

      const file = `rec-${userId}-${Date.now()}.pcm`;
      const out = fs.createWriteStream(file);

      opus.pipe(decoder).pipe(out);
      data.files.push(file);
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("stop_recording")
        .setLabel("Stop Recording")
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.reply({
      content: `🎙️ Recording in ${channel.name}`,
      components: [row]
    });
  }

  // ===== STOP =====
  if (interaction.commandName === "stop") {
    const data = recordings.get(interaction.guild.id);
    if (!data) return interaction.reply("❌ No recording");

    data.connection.destroy();
    recordings.delete(interaction.guild.id);

    return interaction.reply("🛑 Recording stopped");
  }

});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
