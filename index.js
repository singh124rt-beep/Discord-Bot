const express = require("express");
const fs = require("fs");
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
  console.log("❌ DISCORD_BOT_TOKEN MISSING");
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

// ===== DATABASE =====
const DB_FILE = "./warns.json";
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

function getDB() {
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

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
    .addIntegerOption(o => o.setName("minutes").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removetimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

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
  console.log(`🟢 Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Commands registered");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!allowedUsers.includes(interaction.user.id)) {
    return interaction.reply({ content: "❌ Not allowed", ephemeral: true });
  }

  const db = getDB();

  try {

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      await interaction.deferReply({ ephemeral: true });

      const msg = interaction.options.getString("message");
      await interaction.channel.send(msg);

      return interaction.editReply("✅ Sent!");
    }

    const member = interaction.options.getMember("user");

    if (interaction.commandName !== "purge" && !member) {
      return interaction.reply({ content: "❌ User not found", ephemeral: true });
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      await interaction.deferReply();

      const reason = interaction.options.getString("reason");
      await member.kick(reason);

      return interaction.editReply(`👢 ${member.user.tag} kicked | Reason: ${reason}`);
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      await interaction.deferReply();

      const reason = interaction.options.getString("reason");
      await member.ban({ reason });

      return interaction.editReply(`🔨 ${member.user.tag} banned | Reason: ${reason}`);
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      await interaction.deferReply();

      const minutes = interaction.options.getInteger("minutes");
      const reason = interaction.options.getString("reason");

      await member.timeout(minutes * 60 * 1000, reason);

      return interaction.editReply(
        `⏱️ ${member} timed out for ${minutes} minutes\nReason: ${reason}`
      );
    }

    // ===== REMOVE TIMEOUT =====
    if (interaction.commandName === "removetimeout") {
      await interaction.deferReply();

      await member.timeout(null);

      return interaction.editReply(`✅ Timeout removed from ${member.user.tag}`);
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      await interaction.deferReply();

      const reason = interaction.options.getString("reason");
      const id = member.id;

      if (!db[id]) db[id] = 0;
      db[id]++;

      saveDB(db);

      if (db[id] >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warnings reached");
        db[id] = 0;
        saveDB(db);

        return interaction.editReply(
          `⚠️ ${member.user.tag} reached 3 warns → 1 DAY TIMEOUT`
        );
      }

      return interaction.editReply(
        `⚠️ Warned ${member.user.tag} | Total: ${db[id]}\nReason: ${reason}`
      );
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      await interaction.deferReply();

      const id = member.id;

      if (!db[id]) db[id] = 0;
      if (db[id] > 0) db[id]--;

      saveDB(db);

      return interaction.editReply(
        `✅ Removed warn from ${member.user.tag} | Total: ${db[id]}`
      );
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      await interaction.deferReply({ ephemeral: true });

      const amount = interaction.options.getInteger("amount");

      if (amount < 1 || amount > 100) {
        return interaction.editReply("❌ 1-100 only");
      }

      await interaction.channel.bulkDelete(amount, true);

      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

  } catch (err) {
    console.error(err);

    if (interaction.deferred) {
      return interaction.editReply("❌ Error occurred");
    } else {
      return interaction.reply({ content: "❌ Error occurred", ephemeral: true });
    }
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
