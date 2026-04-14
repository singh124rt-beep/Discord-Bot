const express = require("express");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== KEEP ALIVE SERVER (IMPORTANT) =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server running");
});

// ===== TOKEN CHECK =====
if (!process.env.DISCORD_BOT_TOKEN) {
  console.log("❌ DISCORD_BOT_TOKEN missing");
  process.exit(1);
}

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(opt =>
      opt.setName("amount")
        .setDescription("1-100")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("⚡ Commands registered");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply("🏓 Pong!");
  }

  // Admin check
  const isAdmin = interaction.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );

  if (!isAdmin) {
    return interaction.reply({
      content: "❌ Admin only",
      ephemeral: true
    });
  }

  if (interaction.commandName === "purge") {
    const amount = interaction.options.getInteger("amount");

    if (amount < 1 || amount > 100) {
      return interaction.reply({
        content: "❌ Enter 1-100",
        ephemeral: true
      });
    }

    await interaction.channel.bulkDelete(amount, true);

    return interaction.reply({
      content: `🧹 Deleted ${amount}`,
      ephemeral: true
    });
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
