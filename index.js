// ===== IMPORTS =====
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
  StringSelectMenuBuilder,
  PermissionsBitField
} = require("discord.js");

// ===== CONFIG =====
const STAFF_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

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

// ===== HELPERS =====
const isAllowed = (i) => ALLOWED_USERS.includes(i.user.id);
const isStaff = (i) => i.member.roles.cache.has(STAFF_ROLE);

async function reply(i, msg) {
  if (i.deferred || i.replied) return i.editReply(msg);
  return i.reply({ content: msg, ephemeral: true });
}

// ===== WARN AUTO =====
async function checkWarn(member, userId, channel) {
  let data = await Warn.findOne({ userId });
  if (!data) return;

  if (data.warns >= 3) {
    data.warns = 0;
    await data.save();
    await member.timeout(86400000, "3 warns auto timeout");
    channel.send(`⛔ <@${userId}> auto timeout (24h)`);
  }
}

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder().setName("serverinfo")
    .setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o=>o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o=>o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o=>o.setName("media1").setDescription("Media 1"))
    .addAttachmentOption(o=>o.setName("media2").setDescription("Media 2"))
    .addAttachmentOption(o=>o.setName("media3").setDescription("Media 3")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Warn list")
    .addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)),

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
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o=>o.setName("amount").setDescription("Amount").setRequired(true)),

].map(c=>c.toJSON());

// ===== READY =====
client.once("clientReady", async ()=>{
  console.log("🟢 Logged in as " + client.user.tag);

  const rest = new REST({version:"10"}).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), {body:commands});

  console.log("✅ Commands loaded");
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (i)=>{
  try {

    if (i.isChatInputCommand()) await i.deferReply({ephemeral:true});

    if (["ticketpanel","close"].includes(i.commandName)) {
      if (!isStaff(i)) return reply(i,"❌ Staff only");
    } else {
      if (!isAllowed(i)) return reply(i,"❌ Not allowed");
    }

    const user = i.options?.getUser("user");
    const member = user ? await i.guild.members.fetch(user.id) : null;

    // ===== BASIC =====
    if(i.commandName==="ping") return reply(i,"🏓 Pong");

    if(i.commandName==="serverinfo"){
      return reply(i,`Server: ${i.guild.name}\nMembers: ${i.guild.memberCount}`);
    }

    // ===== ANNOUNCE =====
    if(i.commandName==="announce"){
      const msg=i.options.getString("message");
      const ch=i.options.getChannel("channel")||i.channel;

      await ch.send(msg);

      const medias=["media1","media2","media3"]
        .map(x=>i.options.getAttachment(x))
        .filter(Boolean);

      for(const m of medias){
        await ch.send({files:[m.url]});
      }

      return reply(i,"📤 Announcement sent");
    }

    // ===== WARN SYSTEM =====
    if(i.commandName==="warn"){
      let data=await Warn.findOne({userId:user.id})||new Warn({userId:user.id});
      data.warns++; await data.save();

      i.channel.send(`⚠️ ${user} warned (${data.warns}/3)`);

      try{await user.send(`⚠️ You were warned\nReason: ${i.options.getString("reason")}`);}catch{}

      await checkWarn(member,user.id,i.channel);
      return reply(i,"Warn issued");
    }

    if(i.commandName==="unwarn"){
      let data=await Warn.findOne({userId:user.id});
      if(data && data.warns>0){data.warns--; await data.save();}
      return reply(i,"Warn removed");
    }

    if(i.commandName==="clearwarn"){
      await Warn.deleteOne({userId:user.id});
      return reply(i,"Warns cleared");
    }

    if(i.commandName==="warnlist"){
      let data=await Warn.findOne({userId:user.id});
      return reply(i,`Warns: ${data?data.warns:0}`);
    }

    // ===== TIMEOUT =====
    if(i.commandName==="timeout"){
      await member.timeout(i.options.getInteger("time")*60000);
      return reply(i,"Timed out");
    }

    if(i.commandName==="untimeout"){
      await member.timeout(null);
      return reply(i,"Timeout removed");
    }

    // ===== PURGE =====
    if(i.commandName==="purge"){
      await i.channel.bulkDelete(i.options.getInteger("amount"),true);
      return reply(i,"Deleted");
    }

    // ===== TICKET PANEL (DROPDOWN) =====
    if(i.commandName==="ticketpanel"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select Ticket Type")
        .addOptions([
          { label:"General Support", value:"support" },
          { label:"Report Player", value:"report" },
          { label:"Payment Issue", value:"payment" }
        ]);

      const row = new ActionRowBuilder().addComponents(menu);

      await i.channel.send({content:"🎫 Create a Ticket",components:[row]});
      return reply(i,"Panel sent");
    }

    // ===== CLOSE COMMAND =====
    if(i.commandName==="close"){
      return i.channel.delete();
    }

    // ===== SELECT MENU =====
    if(i.isStringSelectMenu()){
      if(i.customId==="ticket_select"){

        const ch = await i.guild.channels.create({
          name:`ticket-${Math.floor(Math.random()*9999)}`,
          parent:TICKET_CATEGORY,
          permissionOverwrites:[
            {id:i.guild.id,deny:[PermissionsBitField.Flags.ViewChannel]},
            {id:i.user.id,allow:[PermissionsBitField.Flags.ViewChannel]},
            {id:STAFF_ROLE,allow:[PermissionsBitField.Flags.ViewChannel]}
          ]
        });

        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket Opened")
          .setDescription(`Type: ${i.values[0]}\nUser: <@${i.user.id}>`)
          .setColor(0x00ff99);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("claim").setLabel("Claim").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
        );

        await ch.send({content:`<@&${STAFF_ROLE}>`,embeds:[embed],components:[row]});

        return i.reply({content:"🎫 Ticket Created",ephemeral:true});
      }
    }

    // ===== BUTTONS =====
    if(i.isButton()){

      if(i.customId==="claim"){
        return i.reply({content:`Claimed by ${i.user}`,ephemeral:false});
      }

      if(i.customId==="close_ticket"){
        await i.deferReply({ephemeral:true});

        const file = await transcripts.createTranscript(i.channel);
        const log = i.guild.channels.cache.get(LOG_CHANNEL);
        if(log) await log.send({files:[file]});

        await i.editReply("Closing...");
        setTimeout(()=>i.channel.delete(),2000);
      }
    }

  } catch(err){
    console.error(err);
    reply(i,"Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
