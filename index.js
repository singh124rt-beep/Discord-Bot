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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// ===== WARN STORAGE =====
const warns = new Map();

// ===== SLASH COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(opt => opt.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(opt => opt.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user")
    .addUserOption(opt => opt.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user")
    .addUserOption(opt => opt.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(opt => opt.setName("message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Give role")
    .addUserOption(opt => opt.setName("user").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(opt => opt.setName("user").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addroles")
    .setDescription("Give multiple roles")
    .addUserOption(opt => opt.setName("user").setRequired(true))
    .addRoleOption(opt => opt.setName("role1").setRequired(true))
    .addRoleOption(opt => opt.setName("role2"))
    .addRoleOption(opt => opt.setName("role3"))
    .addRoleOption(opt => opt.setName("role4"))
    .addRoleOption(opt => opt.setName("role5")),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages (Admin only)")
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

// ===== AUTO WELCOME =====
client.on("guildMemberAdd", async (member) => {

  const channel = member.guild.channels.cache.get("1493306099317739590");
  const role = member.guild.roles.cache.get("1366502670788984902");

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#00b0f4")
    .setTitle("🌆 Welcome to City Role Play!")
    .setDescription(`👋 Hey <@${member.id}>!

Welcome to **City Role Play** 🌆  
Enjoy your RP journey 🚀`)
    .setThumbnail(member.user.displayAvatarURL())
    .setImage("https://cdn.discordapp.com/attachments/1493306099317739590/1493309044956463224/file_00000000f47c72088b760408f4b93739.png")
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  await channel.send({
    content: `🎉 Welcome <@${member.id}>!`,
    embeds: [embed],
    allowedMentions: { users: [member.id] }
  });

  if (role) member.roles.add(role).catch(() => {});
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ADMIN CHECK =====
    const isAdmin = interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    if (!isAdmin) {
      return interaction.reply({
        content: "❌ Admin only command",
        ephemeral: true
      });
    }

    const member = interaction.options.getMember("user");

    if (interaction.commandName !== "purge" && interaction.commandName !== "announce" && !member) {
      return interaction.reply({ content: "❌ User not found", ephemeral: true });
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");

      if (amount < 1 || amount > 100) {
        return interaction.reply({ content: "❌ Enter 1-100", ephemeral: true });
      }

      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        content: `🧹 Deleted ${amount} messages`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "kick") {
      await member.kick();
      return interaction.reply(`👢 ${member.user.tag} kicked`);
    }

    if (interaction.commandName === "ban") {
      await member.ban();
      return interaction.reply(`🔨 ${member.user.tag} banned`);
    }

    if (interaction.commandName === "timeout") {
      await member.timeout(10 * 60 * 1000);
      return interaction.reply(`⏱️ Timeout applied`);
    }

    if (interaction.commandName === "warn") {
      const id = member.id;
      warns.set(id, (warns.get(id) || 0) + 1);
      return interaction.reply(`⚠️ Warned (${warns.get(id)})`);
    }

    // ✅ FIXED ANNOUNCE (NO HEADER)
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      await interaction.reply({ content: "✅ Sent", ephemeral: true });
      return interaction.channel.send(msg);
    }

    if (interaction.commandName === "addrole") {
      const role = interaction.options.getRole("role");
      await member.roles.add(role);
      return interaction.reply(`✅ Role ${role.name} given`);
    }

    if (interaction.commandName === "removerole") {
      const role = interaction.options.getRole("role");
      await member.roles.remove(role);
      return interaction.reply(`❌ Role ${role.name} removed`);
    }

    if (interaction.commandName === "addroles") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      for (const role of roles) {
        await member.roles.add(role);
      }

      return interaction.reply(`✅ ${roles.length} roles added`);
    }

  } catch (err) {
    console.error(err);
    return interaction.reply({
      content: "❌ Error executing command",
      ephemeral: true
    });
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
