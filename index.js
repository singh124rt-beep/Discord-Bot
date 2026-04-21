const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const prism = require("prism-media");

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

const { joinVoiceChannel } = require("@discordjs/voice");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) process.exit(1);
if (!process.env.MONGO_URI) process.exit(1);

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
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ===== PERMISSIONS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459"
];

// ===== RECORD STATE =====
const recordings = new Map();

// ===== SLASH COMMANDS =====
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
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("record")
    .setDescription("Start Craig-style recording")
    .addChannelOption(o =>
      o.setName("channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  new SlashCommandBuilder()
    .setName("stoprecord")
    .setDescription("Stop recording")

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`Logged in: ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ===== BUTTON HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const state = recordings.get(interaction.guild.id);

  if (interaction.customId === "stop_record") {
    if (state) {
      state.connection.destroy();
      recordings.delete(interaction.guild.id);
    }
    return interaction.reply("⏹ Recording stopped");
  }

  if (interaction.customId === "download_record") {
    if (!state || !state.files.length) {
      return interaction.reply({ content: "❌ No recordings yet", ephemeral: true });
    }

    return interaction.reply({
      content: "📁 Recordings:",
      files: state.files.slice(0, 5)
    });
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    const member = interaction.member;
    const userId = interaction.user.id;

    const isAllowed = allowedUsers.includes(userId);

    // ===== MODERATION =====
    if (["kick", "ban", "warn", "timeout", "role", "announce"].includes(interaction.commandName)) {
      if (!isAllowed) return interaction.reply("❌ No permission");
    }

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      await channel.send(msg);
      return interaction.reply("✅ Sent");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      let data = await Warn.findOne({ userId });
      if (!data) data = new Warn({ userId, warns: 0 });

      data.warns++;
      await data.save();

      return interaction.reply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply("🧹 Deleted");
    }

    // ===== ROLE =====
    if (interaction.commandName === "role") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const r of roles) await member.roles.add(r);

      return interaction.reply("✅ Roles added");
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      await member.kick(interaction.options.getString("reason"));
      return interaction.reply("👢 Kicked");
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      await member.ban({ reason: interaction.options.getString("reason") });
      return interaction.reply("🔨 Banned");
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      await member.timeout(time * 60000);
      return interaction.reply("⏱️ Timed out");
    }

    // ===== RECORD =====
    if (interaction.commandName === "record") {

      const channel = interaction.options.getChannel("channel");

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      const receiver = connection.receiver;

      const state = {
        connection,
        receiver,
        files: [],
        speaking: new Set(),
        startTime: Date.now(),
        message: null
      };

      recordings.set(interaction.guild.id, state);

      receiver.speaking.on("start", (userId) => {

        const opus = receiver.subscribe(userId);

        const decoder = new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960
        });

        const file = `rec-${userId}-${Date.now()}.pcm`;
        const out = fs.createWriteStream(file);

        opus.pipe(decoder).pipe(out);

        state.files.push(file);
        state.speaking.add(userId);
      });

      receiver.speaking.on("end", (userId) => {
        state.speaking.delete(userId);
      });

      const embed = new EmbedBuilder()
        .setTitle("🎙️ CRAIG ULTRA RECORDING")
        .setColor(0x57F287)
        .setDescription(`🟢 Recording started\n📡 ${channel.name}\n👥 Users: 0`)
        .setThumbnail("https://i.imgur.com/zFAITHB.jpeg");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("stop_record")
          .setLabel("⏹ Stop")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("download_record")
          .setLabel("📥 Download")
          .setStyle(ButtonStyle.Success)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      state.message = msg;

      // LIVE UPDATE
      setInterval(async () => {

        const s = recordings.get(interaction.guild.id);
        if (!s) return;

        const updated = new EmbedBuilder()
          .setTitle("🎙️ CRAIG ULTRA RECORDING")
          .setColor(0x57F287)
          .setDescription(
            `🟢 Live Recording\n📡 ${channel.name}\n👥 Speaking: ${s.speaking.size}\n📁 Files: ${s.files.length}`
          );

        try {
          await s.message.edit({ embeds: [updated] });
        } catch {}

      }, 5000);
    }

    // ===== STOP =====
    if (interaction.commandName === "stoprecord") {
      const state = recordings.get(interaction.guild.id);
      if (!state) return interaction.reply("❌ Not recording");

      state.connection.destroy();
      recordings.delete(interaction.guild.id);

      return interaction.reply("⏹ Stopped");
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
