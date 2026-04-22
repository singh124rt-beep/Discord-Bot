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
  ButtonStyle,
  EmbedBuilder
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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
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

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o =>
      o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel").setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o =>
      o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o =>
      o.setName("duration").setDescription("Minutes").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("1-100").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o =>
      o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o =>
      o.setName("role2").setDescription("Role"))
    .addRoleOption(o =>
      o.setName("role3").setDescription("Role")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o =>
      o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o =>
      o.setName("role2").setDescription("Role"))
    .addRoleOption(o =>
      o.setName("role3").setDescription("Role"))

].map(c => c.toJSON());

// ===== READY =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands registered");
});

// ===== BUTTON HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "dismiss_announce") {
    return interaction.update({
      content: "✅ Dismissed",
      embeds: [],
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

    // 🔹 defer reply ONLY for safety
    await interaction.deferReply({ ephemeral: true });

    // ===== PING =====
    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {

      if (!isAllowed)
        return interaction.editReply("❌ No permission");

      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      const image = interaction.options.getString("image");

      const embed = new EmbedBuilder()
        .setDescription(msg)
        .setColor(0x2b2d31)
        .setTimestamp();

      if (image) embed.setImage(image);

      // 👇 SEND TO PUBLIC CHANNEL
      await channel.send({ embeds: [embed] });

      // 👇 PRIVATE CONFIRMATION (ONLY YOU)
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dismiss_announce")
          .setLabel("Dismiss")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        content: "📤 Announcement sent",
        components: [row]
      });
    }

    // ===== MODERATION COMMANDS =====
    if (!isAllowed)
      return interaction.editReply("❌ No permission");

    const member = interaction.options.getMember("user");

    if (interaction.commandName === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        await member.send(`🚫 Timeout 24h\nReason: ${reason}`).catch(()=>{});
        data.warns = 0;
      }

      await data.save();
      return interaction.editReply(`⚠️ Warned (${data.warns}/3)\nReason: ${reason}`);
    }

    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");
      await member.kick(reason);
      return interaction.editReply(`👢 Kicked\nReason: ${reason}`);
    }

    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");
      await member.ban({ reason });
      return interaction.editReply(`🔨 Banned\nReason: ${reason}`);
    }

    if (interaction.commandName === "timeout") {
      const duration = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason");

      await member.timeout(duration * 60000, reason);
      return interaction.editReply(`⏱️ Timeout ${duration} min\nReason: ${reason}`);
    }

    if (interaction.commandName === "untimeout") {
      await member.timeout(null);
      return interaction.editReply(`✅ Timeout removed`);
    }

    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply(`🧹 Deleted ${amount}`);
    }

    if (interaction.commandName === "addrole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) await member.roles.add(role);
      return interaction.editReply("✅ Roles added");
    }

    if (interaction.commandName === "removerole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) await member.roles.remove(role);
      return interaction.editReply("🗑️ Roles removed");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
