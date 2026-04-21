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
  ChannelType
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

// 🛡️ ONLY THESE USERS CAN USE MOD COMMANDS
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459"
];

// 👮 ADM ROLE NAME
const ADM_ROLE = "adm";

// ===== RECORD STORAGE =====
const recordings = new Map();

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
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
    .setName("role")
    .setDescription("Give roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role"))
    .addRoleOption(o => o.setName("role3").setDescription("Role")),

  // 🎙️ JOIN
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join and record VC")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Select voice channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildVoice)
    ),

  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop recording"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true))

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
    const userId = interaction.user.id;

    const isAdm = interaction.member.roles.cache.some(r =>
      r.name.toLowerCase() === ADM_ROLE
    );

    const isAllowedUser = allowedUsers.includes(userId);

    // 🎙️ ONLY ADM
    if (["join", "stop", "purge"].includes(interaction.commandName)) {
      if (!isAdm) return interaction.reply("❌ Only ADM can use this");
    }

    // 🔧 ONLY SELECTED USERS
    if (["kick", "ban", "warn", "unwarn", "role", "timeout", "announce"].includes(interaction.commandName)) {
      if (!isAllowedUser) return interaction.reply("❌ Only management can use this");
    }

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      await channel.send(msg);
      return interaction.reply("✅ Sent!");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      if (!dbReady) return interaction.reply("⚠️ DB not ready");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000);
        data.warns = 0;
        await data.save();
        return interaction.reply("⚠️ 3 warns → Timeout");
      }

      await data.save();
      return interaction.reply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== JOIN =====
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

        recordings.get(channel.guild.id).files.push(file);
      });

      return interaction.reply(`🎙️ Recording in ${channel.name}`);
    }

    // ===== STOP =====
    if (interaction.commandName === "stop") {
      const data = recordings.get(interaction.guild.id);
      if (!data) return interaction.reply("❌ No recording");

      data.connection.destroy();
      recordings.delete(interaction.guild.id);

      if (!data.files.length) return interaction.reply("⚠️ No audio");

      return interaction.reply({
        content: "📁 Recording:",
        files: [data.files[0]]
      });
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

      for (const role of roles) {
        await member.roles.add(role);
      }

      return interaction.reply("✅ Roles added");
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.reply("👢 User kicked");
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.reply("🔨 User banned");
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      await member.timeout(time * 60000);
      return interaction.reply(`⏱️ Timeout ${time} min`);
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
