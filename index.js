const express = require("express");
const mongoose = require("mongoose");
const transcripts = require("discord-html-transcripts");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

// ===== ERROR SAFETY =====
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ===== CONFIG =====
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

// ✅ YOUR IDS
const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== EXPRESS =====
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI);

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
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

// ===== GREETINGS =====
client.on("messageCreate", (m) => {
  if (m.author.bot) return;
  if (["hi","hello","hey"].includes(m.content.toLowerCase())) {
    m.reply(`👋 Greetings ${m.author.username}, Welcome to CRP`);
  }
});

// ===== SAFE REPLY =====
async function safeReply(i, msg) {
  try {
    if (i.replied || i.deferred) {
      return i.followUp({ content: msg, ephemeral: true });
    } else {
      return i.reply({ content: msg, ephemeral: true });
    }
  } catch {}
}

// ===== PERMISSION SYSTEM =====
function isAllowedUser(i) {
  return ALLOWED_USERS.includes(i.user.id);
}

function isAdmin(i) {
  return i.member.permissions.has(PermissionsBitField.Flags.Administrator);
}

// ===== WARN AUTO =====
async function checkWarn(member, userId, channel) {
  if (!member) return;

  let data = await Warn.findOne({ userId });
  if (!data) return;

  if (data.warns >= 3) {
    data.warns = 0;
    await data.save();

    try {
      await member.timeout(24 * 60 * 60 * 1000, "3 warns auto timeout");
      channel.send(`⛔ <@${userId}> auto timeout (24h)`);
    } catch {}
  }
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o=>o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o=>o.setName("image").setDescription("Image")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Open ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o=>o.setName("time").setDescription("Minutes").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove 1 warn")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Warn list")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o=>o.setName("role3").setDescription("Role 3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o=>o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o=>o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o=>o.setName("role3").setDescription("Role 3"))

].map(c=>c.toJSON());

// ===== READY =====
client.once("ready", async ()=>{
  console.log("🟢 Logged in as " + client.user.tag);

  const rest = new REST({version:"10"}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {body:commands});

  console.log("✅ Commands loaded");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i)=>{
  try {

    if (i.isChatInputCommand()) {
      try { await i.deferReply({ephemeral:true}); } catch {}
    }

    // ===== PERMISSION LOGIC =====
    if (i.isChatInputCommand()) {

      const name = i.commandName;

      // ticketpanel + purge → allowed OR admin
      if (["ticketpanel","purge"].includes(name)) {
        if (!isAllowedUser(i) && !isAdmin(i)) {
          return safeReply(i,"❌ Not allowed");
        }
      }

      // ALL OTHER COMMANDS → ONLY allowed users
      else {
        if (!isAllowedUser(i)) {
          return safeReply(i,"❌ Only allowed users can use this");
        }
      }
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id).catch(()=>null) : null;

    // ===== ANNOUNCE =====
    if(i.commandName==="announce"){
      const msg=i.options.getString("message");
      const ch=i.options.getChannel("channel")||i.channel;
      const img=i.options.getAttachment("image");

      const embed=new EmbedBuilder().setDescription(msg);
      if(img) embed.setImage(img.url);

      await ch.send({embeds:[embed]});
      return safeReply(i,"📤 Announcement sent");
    }

    // ===== PURGE =====
    if(i.commandName==="purge"){
      await i.channel.bulkDelete(i.options.getInteger("amount"),true);
      return safeReply(i,"Messages deleted");
    }

    // ===== TICKET PANEL =====
    if(i.commandName==="ticketpanel"){
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("create_ticket").setLabel("Create Ticket").setStyle(ButtonStyle.Success)
      );
      await i.channel.send({content:"🎫 Open a ticket",components:[row]});
      return safeReply(i,"Panel sent");
    }

    // ===== BUTTON =====
    if(i.isButton() && i.customId==="create_ticket"){
      const ch=await i.guild.channels.create({
        name:`ticket-${i.user.username}`,
        parent:TICKET_CATEGORY,
        permissionOverwrites:[
          {id:i.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
          {id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel]},
          {id:STAFF_ROLE,allow:[PermissionsBitField.Flags.ViewChannel]}
        ]
      });

      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await ch.send({content:`🎫 Ticket created by <@${i.user.id}>`,components:[row]});
      return safeReply(i,"🎫 Ticket Created");
    }

  } catch(err){
    console.error(err);
    safeReply(i,"Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
