const express = require("express");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing DISCORD_BOT_TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI");

// ===== EXPRESS =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(console.error);

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

// ===== ALLOWED USERS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("Message")
        .setRequired(true))
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User")
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("1-100")
        .setRequired(true))

].map(c => c.toJSON());

// ===== REST =====
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY EVENT (FIXED) =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("📦 Slash commands registered");
  } catch (err) {
    console.error(err);
  }
});

// ===== BUTTON HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "dismiss_announce") {
    return interaction.update({
      content: "✅ Announcement dismissed",
      components: []
    });
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    const userId = interaction.user.id;
    const isAllowed = allowedUsers.includes(userId);

    const member = interaction.options.getMember("user");

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.reply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {

      if (!isAllowed)
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");

      await channel.send(`📢 **Announcement:**\n${msg}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dismiss_announce")
          .setLabel("Dismiss")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        content: "📢 Announcement sent successfully!",
        ephemeral: true,
        components: [row]
      });
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {

      if (!isAllowed)
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      let data = await Warn.findOne({ userId });
      if (!data) data = new Warn({ userId, warns: 0 });

      data.warns++;
      await data.save();

      return interaction.reply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {

      if (!isAllowed)
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      await member.kick();
      return interaction.reply("👢 User kicked");
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {

      if (!isAllowed)
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      await member.ban();
      return interaction.reply("🔨 User banned");
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {

      if (!isAllowed)
        return interaction.reply({ content: "❌ No permission", ephemeral: true });

      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({
        content: `🧹 Deleted ${amount} messages`,
        ephemeral: true
      });
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
