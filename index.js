const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");
console.log("TOKEN EXISTS:", !!process.env.DISCORD_BOT_TOKEN);

if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ TOKEN MISSING");
  process.exit(1);
}

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

// ===== WARN STORAGE =====
const warns = new Map();

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

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
    .setName("removetimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("1-100").setRequired(true)),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
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

  // 🚨 FIX FOR "APPLICATION DID NOT RESPOND"
  await interaction.deferReply({ ephemeral: false });

  try {

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.editReply("❌ Not allowed");
    }

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE (NO 📢) =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      await interaction.editReply("✅ Sent!");
      return interaction.channel.send(msg);
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
      const id = member.id;
      const count = (warns.get(id) || 0) + 1;
      warns.set(id, count);

      if (count >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns reached");
        warns.set(id, 0);

        return interaction.editReply(
          `⚠️ ${member} reached 3 warns → Timeout 1 day`
        );
      }

      return interaction.editReply(`⚠️ ${member} warned (${count}/3)`);
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      const id = member.id;
      const count = Math.max((warns.get(id) || 0) - 1, 0);
      warns.set(id, count);

      return interaction.editReply(`✅ Warn removed (${count}/3)`);
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
