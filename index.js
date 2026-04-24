const express = require("express");
const mongoose = require("mongoose");
const OpenAI = require("openai");

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

// ===== AI =====
const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

const purgeRoleId = "1390273593040048220";

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Optional channel")
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Show warns"),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn history")
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
    .addIntegerOption(o => o.setName("duration").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))
    .addRoleOption(o => o.setName("role4"))
    .addRoleOption(o => o.setName("role5")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))
    .addRoleOption(o => o.setName("role4"))
    .addRoleOption(o => o.setName("role5"))

].map(c => c.toJSON());

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("✅ Commands registered");
});

// ===== BUTTON (DISMISS) =====
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "dismiss") {
    return i.update({ content: "✅ Closed", components: [] });
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;

  const publicCmds = ["serverinfo","warnlist","warninfo"];

  await interaction.deferReply({ ephemeral: !publicCmds.includes(cmd) });

  try {
    const allowed = allowedUsers.includes(interaction.user.id);
    const hasRole = interaction.member.roles.cache.has(purgeRoleId);

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(()=>null)
      : null;

    // ===== PERMISSION =====
    if (!["ping","serverinfo","warnlist","warninfo"].includes(cmd)) {
      if (cmd === "purge") {
        if (!allowed && !hasRole) return interaction.editReply("❌ No permission");
      } else if (!allowed) {
        return interaction.editReply("❌ No permission");
      }
    }

    // ===== PING =====
    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

    // ===== SERVER INFO =====
    if (cmd === "serverinfo") {
      const embed = new EmbedBuilder()
        .setTitle("🌆 City Role Play")
        .setImage("https://i.imgur.com/JeZR5OO.jpg")
        .setDescription(`👋 Welcome to City Role Play!

🎭 Choose roles like Police, Airforce, Criminal, Business Owner.

📜 Follow rules and enjoy realistic RP.

🚀 Build your story and grow.`)
        .setColor("Blue");

      return interaction.editReply({ embeds: [embed] });
    }

    // ===== ANNOUNCE =====
    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;
      const image = interaction.options.getString("image");

      if (image)
        await channel.send({ content: msg, embeds: [{ image: { url: image } }] });
      else
        await channel.send(msg);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("dismiss").setLabel("Dismiss").setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: "📤 Sent", components: [row] });
    }

    // ===== WARN =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        await interaction.channel.send(`🚫 <@${member.id}> timed out (3/3)`);
        data.warns = 0;
        data.history = [];
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)\nReason: ${reason}`);
      }

      await data.save();

      await member.send(`⚠️ Warn\nReason: ${reason}`).catch(()=>{});
      return interaction.editReply("Warn added");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(
        data.history.map((h,i)=>`${i+1}. ${h.reason} (${h.date})`).join("\n")
      );
    }

    if (cmd === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data || data.warns === 0) return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      await interaction.channel.send(`✅ <@${member.id}> warning removed (${data.warns}/3)`);
      return interaction.editReply("Warning removed");
    }

    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });
      await interaction.channel.send(`🧹 <@${member.id}> all warnings cleared`);
      return interaction.editReply("All warnings removed");
    }

    // ===== MODERATION =====
    if (cmd === "kick") {
      await member.kick();
      await interaction.channel.send(`👢 <@${member.id}> kicked`);
      return interaction.editReply("Done");
    }

    if (cmd === "ban") {
      await member.ban();
      await interaction.channel.send(`🔨 <@${member.id}> banned`);
      return interaction.editReply("Done");
    }

    if (cmd === "timeout") {
      const d = interaction.options.getInteger("duration");
      await member.timeout(d * 60000);
      await interaction.channel.send(`⏱️ <@${member.id}> timeout ${d} min`);
      return interaction.editReply("Done");
    }

    if (cmd === "untimeout") {
      await member.timeout(null);
      return interaction.editReply("Removed");
    }

    if (cmd === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`Deleted ${amount}`);
    }

    if (cmd === "addrole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r=>interaction.options.getRole(r)).filter(Boolean);

      for (const r of roles) await member.roles.add(r);
      return interaction.editReply("Roles added");
    }

    if (cmd === "removerole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r=>interaction.options.getRole(r)).filter(Boolean);

      for (const r of roles) await member.roles.remove(r);
      return interaction.editReply("Roles removed");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== GREETING =====
client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  const t = msg.content.toLowerCase();
  if (["hi","hello","hey"].includes(t)) {
    msg.reply(`👋 Greetings, ${msg.author.username}! Welcome to CRP 🌆`);
  }
});

// ===== AI =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  try {
    const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    message.reply(res.choices[0].message.content.substring(0,2000));
  } catch {
    message.reply("⚠️ AI error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
