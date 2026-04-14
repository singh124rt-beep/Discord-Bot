const express = require("express");
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ALLOWED USERS ONLY =====
const allowedUsers = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ===== KEEP ALIVE SERVER =====
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
  intents: [GatewayIntentBits.Guilds]
});

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send message")
    .addStringOption(o => o.setName("message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Give role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addroles")
    .setDescription("Give multiple roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))
    .addRoleOption(o => o.setName("role4"))
    .addRoleOption(o => o.setName("role5")),

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

// ===== READY (FIXED DEPLOYMENT SAFE) =====
client.once("ready", async () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);

  try {
    console.log("⚡ Registering commands...");

    await rest.put(
      Routes.applicationCommands(client.application.id),
      { body: commands }
    );

    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Command error:", err);
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // ===== ONLY YOUR IDS =====
    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You are not allowed to use this bot",
        ephemeral: true
      });
    }

    const getUser = interaction.options.getUser("user");
    const member = getUser
      ? await interaction.guild.members.fetch(getUser.id).catch(() => null)
      : null;

    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Deleted ${amount}`, ephemeral: true });
    }

    if (!member && interaction.commandName !== "announce") {
      return interaction.reply({ content: "❌ User not found", ephemeral: true });
    }

    if (interaction.commandName === "kick") {
      await member.kick();
      return interaction.reply(`👢 Kicked`);
    }

    if (interaction.commandName === "ban") {
      await member.ban();
      return interaction.reply(`🔨 Banned`);
    }

    if (interaction.commandName === "timeout") {
      await member.timeout(10 * 60 * 1000);
      return interaction.reply(`⏱️ Timeout`);
    }

    if (interaction.commandName === "warn") {
      return interaction.reply(`⚠️ Warned`);
    }

    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      await interaction.reply({ content: "✅ Sent", ephemeral: true });
      return interaction.channel.send(msg);
    }

    if (interaction.commandName === "addrole") {
      const role = interaction.options.getRole("role");
      await member.roles.add(role);
      return interaction.reply("✅ Role added");
    }

    if (interaction.commandName === "removerole") {
      const role = interaction.options.getRole("role");
      await member.roles.remove(role);
      return interaction.reply("❌ Role removed");
    }

    if (interaction.commandName === "addroles") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      for (const r of roles) await member.roles.add(r);

      return interaction.reply(`✅ Roles added`);
    }

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Error",
      ephemeral: true
    });
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
