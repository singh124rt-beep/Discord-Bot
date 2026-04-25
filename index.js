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

// ===== AI SAFE INIT =====
const ai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Show server info"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove last warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns")
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
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))

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

  await interaction.reply({
    content: isPublic ? "⏳ Loading..." : "⏳ CRP Management is thinking...",
    ephemeral: !isPublic
  });

  try {
    const allowed = allowedUsers.includes(interaction.user.id);
    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(()=>null) : null;

    if (!isPublic && !allowed) {
      return interaction.editReply("❌ No permission");
    }

    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle("🌆 City Role Play")
          .setImage("https://i.imgur.com/JeZR5OO.jpg")
          .setDescription(`👋 Welcome to City Role Play!

🎭 Police | Criminal | Business

📜 Follow rules & enjoy RP

🚀 Build your story`)
        ]
      });
    }

    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const ch = interaction.options.getChannel("channel") || interaction.channel;
      await ch.send(msg);
      return interaction.editReply("📤 Announcement sent");
    }

    // ===== WARN SYSTEM =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");
      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000);
        await interaction.channel.send(`🚫 <@${member.id}> got 3 warns → 24h timeout`);
        data.warns = 0;
        data.history = [];
      } else {
        await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)\nReason: ${reason}`);
      }

      await data.save();
      return interaction.editReply("✅ Warn added");
    }

    if (cmd === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data || data.warns === 0) return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      await interaction.channel.send(`✅ <@${member.id}> warn removed (${data.warns}/3)`);
      return interaction.editReply("Done");
    }

    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });
      await interaction.channel.send(`🧹 <@${member.id}> warns cleared`);
      return interaction.editReply("Done");
    }

    if (cmd === "timeout") {
      const mins = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason");

      await member.timeout(mins * 60000);
      await interaction.channel.send(`⏱️ <@${member.id}> timed out (${mins}m)\nReason: ${reason}`);

      return interaction.editReply("Done");
    }

    if (cmd === "untimeout") {
      await member.timeout(null);
      await interaction.channel.send(`✅ <@${member.id}> timeout removed`);
      return interaction.editReply("Done");
    }

    if (cmd === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      await interaction.channel.send(`🦶 <@${member.id}> kicked\nReason: ${reason}`);
      return interaction.editReply("Done");
    }

    if (cmd === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      await interaction.channel.send(`🔨 <@${member.id}> banned\nReason: ${reason}`);
      return interaction.editReply("Done");
    }

    if (cmd === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount);
      return interaction.editReply(`Deleted ${amount}`);
    }

    if (cmd === "addrole") {
      const roles = ["role1","role2","role3"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const role of roles) await member.roles.add(role);

      await interaction.channel.send(`➕ Roles added to <@${member.id}>`);
      return interaction.editReply("Done");
    }

    if (cmd === "removerole") {
      const roles = ["role1","role2","role3"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const role of roles) await member.roles.remove(role);

      await interaction.channel.send(`➖ Roles removed from <@${member.id}>`);
      return interaction.editReply("Done");
    }

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error");
  }
});

// ===== GREETING =====
client.on("messageCreate", msg => {
  if (msg.author.bot) return;
  if (["hi","hello","hey"].includes(msg.content.toLowerCase())) {
    msg.reply(`👋 Greetings, ${msg.author.username}! Welcome to CRP 🌆`);
  }
});

// ===== AI =====
client.on("messageCreate", async (message) => {
  if (!ai) return;
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;

  try {
    const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    if (!res?.choices?.[0]?.message?.content) return;

    message.reply(res.choices[0].message.content.slice(0, 2000));
  } catch (err) {
    console.error("AI ERROR:", err.message);
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
