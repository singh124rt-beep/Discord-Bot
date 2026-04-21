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

// ===== SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
let dbReady = false;
mongoose.connect(process.env.MONGO_URI)
.then(()=>{ dbReady = true; console.log("Mongo Connected"); })
.catch(err=>console.log("Mongo Error:", err.message));

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: Number
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
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

const ALLOWED_ROLES = [
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

const badWords = ["madarchod","bhosdike","chutiya","gandu"];
const activeRecordings = new Map();

// ===== RECORD =====
function startRecording(connection, interaction) {
  const receiver = connection.receiver;
  const guildId = interaction.guild.id;

  if (!fs.existsSync("recordings")) fs.mkdirSync("recordings");
  activeRecordings.set(guildId, []);

  receiver.speaking.on("start", (userId) => {

    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 }
    });

    const pcm = `recordings/${userId}-${Date.now()}.pcm`;
    const wav = pcm.replace(".pcm",".wav");

    const pcmStream = new prism.opus.Decoder({
      frameSize:960,
      channels:2,
      rate:48000
    });

    const write = fs.createWriteStream(pcm);

    opusStream.pipe(pcmStream).pipe(write);

    write.on("finish", () => {
      ffmpeg(pcm)
        .inputOptions(["-f s16le","-ar 48000","-ac 2"])
        .save(wav)
        .on("end", ()=> fs.unlinkSync(pcm));
    });

    activeRecordings.get(guildId).push(wav);
  });
}

// ===== COMMANDS =====
const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Check"),

new SlashCommandBuilder()
.setName("announce")
.setDescription("Send")
.addStringOption(o=>o.setName("message").setDescription("msg").setRequired(true))
.addChannelOption(o=>o.setName("channel").setDescription("channel").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn")
.addUserOption(o=>o.setName("user").setDescription("user").setRequired(true)),

new SlashCommandBuilder()
.setName("join").setDescription("Start recording"),

new SlashCommandBuilder()
.setName("stop").setDescription("Stop recording")

].map(c=>c.toJSON());

const rest = new REST({version:"10"}).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async ()=>{
  console.log("Logged in:", client.user.tag);
  await rest.put(Routes.applicationCommands(client.user.id),{body:commands});
});

// ===== ABUSE =====
client.on("messageCreate", async msg=>{
  if(msg.author.bot) return;

  if(badWords.some(w=>msg.content.toLowerCase().includes(w))){
    await msg.delete().catch(()=>{});
    await msg.member.timeout(86400000).catch(()=>{});
    msg.channel.send(`🚫 ${msg.author} abuse → timeout`);
  }

  if(msg.mentions.users.size>=5){
    await msg.delete().catch(()=>{});
    await msg.member.timeout(86400000).catch(()=>{});
    msg.channel.send(`🚫 ${msg.author} tag spam`);
  }
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async interaction=>{

if(interaction.isChatInputCommand()){

await interaction.deferReply({ephemeral:true});

if(!allowedUsers.includes(interaction.user.id)){
  return interaction.editReply("❌ Not allowed");
}

const member = interaction.options.getMember("user");

if(interaction.commandName==="ping"){
  return interaction.editReply("🏓 Pong");
}

if(interaction.commandName==="announce"){
  const msg = interaction.options.getString("message");
  const ch = interaction.options.getChannel("channel");
  await ch.send(msg);
  return interaction.editReply("✅ Sent");
}

// ===== JOIN =====
if(interaction.commandName==="join"){

if(!interaction.member.roles.cache.some(r=>ALLOWED_ROLES.includes(r.id))){
  return interaction.editReply("❌ No permission");
}

const vc = interaction.member.voice.channel;
if(!vc) return interaction.editReply("❌ Join VC");

const connection = joinVoiceChannel({
  channelId:vc.id,
  guildId:interaction.guild.id,
  adapterCreator:interaction.guild.voiceAdapterCreator,
  selfDeaf:false
});

startRecording(connection,interaction);

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("stop").setLabel("🛑 Stop").setStyle(ButtonStyle.Danger),
new ButtonBuilder().setCustomId("dismiss").setLabel("❌ Dismiss").setStyle(ButtonStyle.Secondary)
);

return interaction.editReply({
embeds:[{title:"🎙️ Recording Started",description:`<#${vc.id}>`,color:0x00ff00}],
components:[row]
});
}

// ===== STOP =====
if(interaction.commandName==="stop"){
const connection = getVoiceConnection(interaction.guild.id);
if(!connection) return interaction.editReply("❌ Not recording");

connection.destroy();

const files = activeRecordings.get(interaction.guild.id)||[];

const zipPath = `recordings/session-${Date.now()}.zip`;
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip");

archive.pipe(output);
files.forEach(f=>fs.existsSync(f)&&archive.file(f,{name:f.split("/").pop()}));
await archive.finalize();

output.on("close", async ()=>{
await interaction.followUp({files:[zipPath]});
});

return interaction.editReply("🛑 Stopping...");
}

}

// ===== BUTTONS =====
if(interaction.isButton()){

if(interaction.customId==="dismiss"){
return interaction.update({content:"❌ Dismissed",embeds:[],components:[]});
}

if(interaction.customId==="stop"){

const connection = getVoiceConnection(interaction.guild.id);
if(!connection) return interaction.reply({content:"❌ Not recording",ephemeral:true});

connection.destroy();

const files = activeRecordings.get(interaction.guild.id)||[];

const zipPath = `recordings/session-${Date.now()}.zip`;
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip");

archive.pipe(output);
files.forEach(f=>fs.existsSync(f)&&archive.file(f,{name:f.split("/").pop()}));
await archive.finalize();

output.on("close", async ()=>{
await interaction.channel.send({files:[zipPath]});
});

return interaction.update({content:"🛑 Stopped",components:[]});
}

}

});

client.login(process.env.DISCORD_BOT_TOKEN);
