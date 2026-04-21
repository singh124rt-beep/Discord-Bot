const express = require("express");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) process.exit(1);
if (!process.env.MONGO_URI) process.exit(1);

// ===== EXPRESS KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
let dbReady = false;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Mongo Connected");
    dbReady = true;
  })
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
    GatewayIntentBits.GuildMembers
  ]
});

// ===== PERMISSIONS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459"
];

const ADM_ROLE = "adm";

// ===== COMMANDS =====
const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

new SlashCommandBuilder()
.setName("announce")
.setDescription("Send announcement")
.addStringOption(o =>
  o.setName("message").setDescription("Message").setRequired(true)
)
.addChannelOption(o =>
  o.setName("channel").setDescription("Channel").setRequired(true)
),

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

    const member = interaction.member;
    const userId = interaction.user.id;

    const isAdm = member.roles.cache.some(r =>
      r.name.toLowerCase() === ADM_ROLE
    );

    const isAllowed = allowedUsers.includes(userId);

    if (["purge"].includes(interaction.commandName)) {
      if (!isAdm) return interaction.reply("❌ Only ADM");
    }

    if (["kick","ban","warn","unwarn","role","timeout","announce"].includes(interaction.commandName)) {
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
      if (!dbReady) return interaction.reply("⚠️ DB not ready");

      let data = await Warn.findOne({ userId });
      if (!data) data = new Warn({ userId, warns: 0 });

      data.warns++;
      await data.save();

      if (data.warns >= 3) {
        await member.timeout(86400000);
        data.warns = 0;
        await data.save();
        return interaction.reply("⚠️ 3 warns → Timeout");
      }

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

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
