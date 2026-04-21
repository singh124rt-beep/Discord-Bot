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

const {
  joinVoiceChannel,
  EndBehaviorType
} = require("@discordjs/voice");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) process.exit(1);
if (!process.env.MONGO_URI) process.exit(1);

// ===== EXPRESS KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(err => console.log(err));

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

const recordings = new Map();
const activeUsers = new Set();

// ===== COMMANDS =====
const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

new SlashCommandBuilder()
.setName("announce")
.setDescription("Send announcement")
.addStringOption(o =>
  o.setName("message").setDescription("Message").setRequired(true))
.addChannelOption(o =>
  o.setName("channel").setDescription("Channel").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn user")
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
.addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true)),

new SlashCommandBuilder()
.setName("role")
.setDescription("Give roles")
.addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
.addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
.addRoleOption(o => o.setName("role2").setDescription("Role"))
.addRoleOption(o => o.setName("role3").setDescription("Role")),

new SlashCommandBuilder()
.setName("purge")
.setDescription("Delete messages")
.addIntegerOption(o =>
  o.setName("amount").setDescription("1-100").setRequired(true)),

// 🎙️ RECORD
new SlashCommandBuilder()
.setName("record")
.setDescription("Start voice recording")
.addChannelOption(o =>
  o.setName("channel")
  .setDescription("Voice channel")
  .setRequired(true)
  .addChannelTypes(ChannelType.GuildVoice)
),

// ⏹ STOP
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

  const data = recordings.get(interaction.guild.id);

  if (interaction.customId === "stop_record") {
    if (data) {
      data.connection.destroy();
      recordings.delete(interaction.guild.id);
    }
    return interaction.reply("⏹ Recording stopped");
  }

  if (interaction.customId === "download_record") {
    if (!data || !data.files.length) {
      return interaction.reply({ content: "⚠️ No files", ephemeral: true });
    }

    return interaction.reply({
      content: "📁 Recordings:",
      files: data.files.slice(0, 3)
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
      return interaction.reply(`🧹 Deleted ${amount}`);
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
      return interaction.reply(`⏱️ Timeout ${time} min`);
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

        const file = `rec-${userId}-${Date.now()}.pcm`;
        const out = fs.createWriteStream(file);

        opus.pipe(decoder).pipe(out);

        out.on("finish", () => {
          activeUsers.delete(userId);
          data.files.push(file);
        });

      });

      const embed = new EmbedBuilder()
        .setTitle("🎙️ Recording Active")
        .setDescription(`Channel: ${channel.name}`)
        .setColor(0x00ff99);

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

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // ===== STOP =====
    if (interaction.commandName === "stoprecord") {

      const data = recordings.get(interaction.guild.id);
      if (!data) return interaction.reply("❌ Nothing recording");

      data.connection.destroy();
      recordings.delete(interaction.guild.id);

      return interaction.reply("⏹ Recording stopped");
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
