const express = require("express");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== EXPRESS =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Mongo Connected"))
  .catch(console.error);

// ===== WARN MODEL =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 },
  history: [{ reason: String, date: String }]
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ===== ANTI-SPAM SYSTEM =====
const spamMap = new Map();

const LIMIT = 5;          // messages
const TIME = 5000;        // 5 sec
const MUTE_TIME = 600000; // 10 min

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const userId = msg.author.id;

  if (!spamMap.has(userId)) {
    spamMap.set(userId, { count: 1, last: Date.now() });
  } else {
    const data = spamMap.get(userId);

    if (Date.now() - data.last < TIME) {
      data.count++;
      data.last = Date.now();

      if (data.count >= LIMIT) {
        try {
          await msg.member.timeout(MUTE_TIME, "Spam detected");

          msg.channel.send(`🚫 <@${userId}> muted for spamming (10 min)`);

          // add warn also
          let warnData = await Warn.findOne({ userId }) || new Warn({ userId });
          warnData.warns++;
          warnData.history.push({ reason: "Spam", date: new Date().toLocaleString() });
          await warnData.save();

        } catch {}
        spamMap.delete(userId);
      }

    } else {
      spamMap.set(userId, { count: 1, last: Date.now() });
    }
  }
});

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn history")
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
    .addIntegerOption(o => o.setName("duration").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("🚀 Commands synced");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const isPublic = cmd === "serverinfo";

  await interaction.deferReply({ ephemeral: !isPublic });

  try {
    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(()=>null) : null;

    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🌆 City Role Play")
            .setImage("https://i.imgur.com/JeZR5OO.jpg")
            .setDescription(`👋 Welcome to City Role Play!

🎭 Police | Criminal | Business

📜 Follow rules & enjoy RP

🚀 Build your story`)
            .setColor("Blue")
        ]
      });
    }

    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;
      const image = interaction.options.getString("image");

      let finalMsg = msg;
      if (image) finalMsg += `\n${image}`;

      await channel.send(finalMsg);
      return interaction.editReply("📤 Announcement sent");
    }

    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000);
        await interaction.channel.send(`🚫 <@${member.id}> got 3 warns → 24h timeout`);
        data.warns = 0;
        data.history = [];
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)\nReason: ${reason}`);
      }

      data.history.push({ reason, date: new Date().toLocaleString() });
      await data.save();

      return interaction.editReply("✅ Warn added");
    }

    if (cmd === "warnlist") {
      const data = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(data.map(d => `<@${d.userId}> → ${d.warns}/3`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: user.id });
      if (!data) return interaction.editReply("No history");
      return interaction.editReply(data.history.map((h,i)=>`${i+1}. ${h.reason}`).join("\n"));
    }

    if (cmd === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data || data.warns === 0) return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      await interaction.channel.send(`✅ <@${member.id}> warning removed`);
      return interaction.editReply("Done");
    }

    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });
      await interaction.channel.send(`🧹 <@${member.id}> warnings cleared`);
      return interaction.editReply("Done");
    }

    if (cmd === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      await interaction.channel.send(`🦶 <@${member.id}> kicked\nReason: ${reason}`);
      return interaction.editReply("✅ Kicked");
    }

    if (cmd === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      await interaction.channel.send(`🔨 <@${member.id}> banned\nReason: ${reason}`);
      return interaction.editReply("✅ Banned");
    }

    if (cmd === "timeout") {
      const duration = interaction.options.getInteger("duration");
      await member.timeout(duration * 60000);
      return interaction.editReply("✅ Timeout applied");
    }

    if (cmd === "untimeout") {
      await member.timeout(null);
      return interaction.editReply("✅ Timeout removed");
    }

    if (cmd === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    if (cmd === "addrole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const role of roles) {
        await member.roles.add(role).catch(()=>{});
      }

      return interaction.editReply("✅ Roles added");
    }

    if (cmd === "removerole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const role of roles) {
        await member.roles.remove(role).catch(()=>{});
      }

      return interaction.editReply("✅ Roles removed");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== GREETING =====
client.on("messageCreate", msg => {
  if (msg.author.bot) return;

  if (["hi","hello","hey"].includes(msg.content.toLowerCase())) {
    msg.reply(`👋 Greetings, ${msg.author.username}! Welcome to CRP 🌆`);
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
