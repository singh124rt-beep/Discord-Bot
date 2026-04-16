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

// ===== ENV CHECK =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ TOKEN MISSING");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI MISSING");
  process.exit(1);
}

// ===== MONGODB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const warnSchema = new mongoose.Schema({
  userId: String,
  warns: { type: Number, default: 0 }
});

const Warn = mongoose.model("Warn", warnSchema);

// ===== KEEP ALIVE =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(3000, () => console.log("🌐 Web server running"));

// ===== CLIENT =====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== ALLOWED USERS =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel to send")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Give multiple roles")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role1")
        .setDescription("Role 1")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role2")
        .setDescription("Role 2")
    )
    .addRoleOption(o =>
      o.setName("role3")
        .setDescription("Role 3")
    )
    .addRoleOption(o =>
      o.setName("role4")
        .setDescription("Role 4")
    )
    .addRoleOption(o =>
      o.setName("role5")
        .setDescription("Role 5")
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to kick")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to ban")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("time")
        .setDescription("Time in minutes")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removetimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("1-100")
        .setRequired(true)
    )

].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 LOGGED IN AS ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ COMMANDS REGISTERED");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.editReply("❌ Not allowed");
    }

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const channel = interaction.options.getChannel("channel");
      const msg = interaction.options.getString("message");

      await interaction.editReply(`✅ Sent in ${channel}`);
      return channel.send(msg);
    }

    // ===== ROLE =====
    if (interaction.commandName === "role") {
      const user = interaction.options.getMember("user");

      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      for (const role of roles) {
        await user.roles.add(role);
      }

      return interaction.editReply(`✅ ${roles.length} roles given to ${user}`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    if (!member) return interaction.editReply("❌ User not found");

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.editReply(`👢 ${member} kicked\nReason: ${reason}`);
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.editReply(`🔨 ${member} banned\nReason: ${reason}`);
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const time = interaction.options.getInteger("time");
      const reason = interaction.options.getString("reason");

      await member.timeout(time * 60 * 1000, reason);

      return interaction.editReply(
        `⏱️ ${member}\nTime: ${time} minutes\nReason: ${reason}`
      );
    }

    // ===== REMOVE TIMEOUT =====
    if (interaction.commandName === "removetimeout") {
      await member.timeout(null);
      return interaction.editReply(`✅ Timeout removed from ${member}`);
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data) data = new Warn({ userId: member.id });

      data.warns += 1;
      await data.save();

      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns reached");
        data.warns = 0;
        await data.save();

        return interaction.editReply(`⚠️ ${member} reached 3 warns → Timeout 1 day`);
      }

      return interaction.editReply(`⚠️ ${member} warned (${data.warns}/3)`);
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data) return interaction.editReply("❌ No warns");

      data.warns = Math.max(data.warns - 1, 0);
      await data.save();

      return interaction.editReply(`✅ Warn removed (${data.warns}/3)`);
    }

  } catch (err) {
    console.error("❌ ERROR:", err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ===== LOGIN =====
console.log("🔐 Attempting login...");
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log("✅ LOGIN SUCCESS"))
  .catch(err => console.error("❌ LOGIN FAILED:", err));
