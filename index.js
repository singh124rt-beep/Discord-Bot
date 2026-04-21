const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
const prism = require("prism-media");
const archiver = require("archiver");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
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

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(err => console.log("❌ Mongo Error:", err.message));

// ===== WARN DB =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: Number
}));

// ===== CLIENT (FIXED INTENTS) =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates // ✅ IMPORTANT FIX
  ]
});

// ===== ALLOWED ROLES =====
const allowedRoles = [
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

// ===== DATA =====
const activeRecordings = new Map();
const badWords = ["madarchod", "bhosdike", "chutiya", "gandu"];

// ===== RECORD FUNCTION =====
function startRecording(connection, guildId) {
  const receiver = connection.receiver;

  if (!fs.existsSync("recordings")) fs.mkdirSync("recordings");

  activeRecordings.set(guildId, []);

  receiver.speaking.on("start", (userId) => {

    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
    });

    const pcmFile = `recordings/${userId}-${Date.now()}.pcm`;
    const wavFile = pcmFile.replace(".pcm", ".wav");

    const pcmStream = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000
    });

    const writeStream = fs.createWriteStream(pcmFile);

    opusStream.pipe(pcmStream).pipe(writeStream);

    writeStream.on("finish", () => {
      ffmpeg(pcmFile)
        .inputOptions(["-f s16le", "-ar 48000", "-ac 2"])
        .save(wavFile)
        .on("end", () => fs.unlinkSync(pcmFile));
    });

    activeRecordings.get(guildId).push(wavFile);
  });
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("join").setDescription("Start recording"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop recording"),

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
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true))

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`🟢 Logged in: ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Commands registered");
});

// ===== ANTI ABUSE =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.toLowerCase();

  if (badWords.some(w => content.includes(w))) {
    await msg.delete().catch(() => {});
    await msg.member.timeout(24 * 60 * 60 * 1000).catch(() => {});
    msg.channel.send(`🚫 ${msg.author} abused → Timeout`);
  }

  if (msg.mentions.users.size >= 5) {
    await msg.delete().catch(() => {});
    await msg.member.timeout(24 * 60 * 60 * 1000).catch(() => {});
    msg.channel.send(`🚫 ${msg.author} tag spam`);
  }
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {

  // ===== BUTTONS =====
  if (interaction.isButton()) {

    if (interaction.customId === "dismiss") {
      return interaction.update({ content: "❌ Closed", components: [] });
    }

    if (interaction.customId === "stop") {

      const hasRole = interaction.member.roles.cache.some(r => allowedRoles.includes(r.id));
      if (!hasRole) return interaction.reply("❌ Not allowed");

      const connection = getVoiceConnection(interaction.guild.id);
      if (!connection) return;

      connection.destroy();

      const files = activeRecordings.get(interaction.guild.id) || [];

      const zip = `recordings/session-${Date.now()}.zip`;
      const output = fs.createWriteStream(zip);
      const archive = archiver("zip");

      archive.pipe(output);

      files.forEach(f => {
        if (fs.existsSync(f)) {
          archive.file(f, { name: f.split("/").pop() });
        }
      });

      await archive.finalize();

      output.on("close", async () => {
        await interaction.channel.send({ files: [zip] });
      });

      return interaction.update({ content: "🛑 Recording stopped", components: [] });
    }
  }

  // ===== SLASH =====
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply();

  try {

    // ===== JOIN =====
    if (interaction.commandName === "join") {

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const vc = member.voice.channel;

      if (!vc) return interaction.editReply("❌ Join VC first");

      const hasRole = member.roles.cache.some(r => allowedRoles.includes(r.id));
      if (!hasRole) return interaction.editReply("❌ Not allowed");

      const connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      startRecording(connection, interaction.guild.id);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("stop").setLabel("🛑 Stop").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("dismiss").setLabel("❌ Close").setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        embeds: [{
          title: "🎙️ Recording Started",
          description: `Channel: <#${vc.id}>`,
          color: 0x00ff00
        }],
        components: [row]
      });
    }

    // ===== STOP =====
    if (interaction.commandName === "stop") {
      const connection = getVoiceConnection(interaction.guild.id);
      if (!connection) return interaction.editReply("❌ Not recording");

      connection.destroy();
      return interaction.editReply("🛑 Stopped");
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      const member = interaction.options.getMember("user");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;
      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000);
        data.warns = 0;
      }

      await data.save();
      return interaction.editReply(`⚠️ Warn ${data.warns}/3`);
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      const member = interaction.options.getMember("user");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("❌ No warns");

      data.warns = Math.max(data.warns - 1, 0);
      await data.save();

      return interaction.editReply(`✅ Warn ${data.warns}/3`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const ch = interaction.options.getChannel("channel");

      await ch.send(msg);
      return interaction.editReply("✅ Sent");
    }

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
