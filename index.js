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

// ===== ADMINS =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

// ===== AUTOMOD WORDS =====
const badWords = ["madarchod", "bhosdike", "chutiya", "gandu"];

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send advanced announcement")
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
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout user")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addIntegerOption(o => o.setName("duration").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addRoleOption(o => o.setName("role1").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))

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

// ===== AUTOMOD =====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const content = msg.content.toLowerCase();

  if (badWords.some(w => content.includes(w))) {
    await msg.delete().catch(() => {});
    await msg.member.timeout(86400000, "Abuse");

    msg.channel.send(`🚫 ${msg.author} abused → Timeout 24h`);
  }

  if (msg.mentions.users.size >= 5) {
    await msg.delete().catch(() => {});
    await msg.member.timeout(86400000, "Spam");

    msg.channel.send(`🚫 ${msg.author} spam → Timeout`);
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const isAllowed = allowedUsers.includes(interaction.user.id);
    const member = interaction.options.getMember("user");

    if (interaction.commandName !== "ping" && !isAllowed)
      return interaction.reply({ content: "❌ No permission", ephemeral: true });

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {

      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      const image = interaction.options.getString("image");

      const embed = new EmbedBuilder()
        .setDescription(msg)
        .setColor(0x2b2d31)
        .setFooter({ text: `Sent by ${interaction.user.username}` })
        .setTimestamp();

      if (image) embed.setImage(image);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dismiss_announce")
          .setLabel("Dismiss")
          .setStyle(ButtonStyle.Secondary)
      );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({ content: "✅ Sent!", ephemeral: true });
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        await member.send(`🚫 3 warns → Timeout 24h\nReason: ${reason}`).catch(()=>{});

        data.warns = 0;
        await data.save();

        return interaction.reply(`🚨 ${member.user.tag} timed out (3 warns)`);
      }

      await data.save();
      await member.send(`⚠️ Warned\nReason: ${reason}`).catch(()=>{});

      return interaction.reply(`⚠️ Warned ${member.user.tag} (${data.warns}/3)\nReason: ${reason}`);
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");

      await member.send(`👢 Kicked\nReason: ${reason}`).catch(()=>{});
      await member.kick(reason);

      return interaction.reply(`👢 Kicked ${member.user.tag}\nReason: ${reason}`);
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");

      await member.send(`🔨 Banned\nReason: ${reason}`).catch(()=>{});
      await member.ban({ reason });

      return interaction.reply(`🔨 Banned ${member.user.tag}\nReason: ${reason}`);
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const duration = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason");

      await member.timeout(duration * 60000, reason);
      await member.send(`⏱️ Timeout\nDuration: ${duration} min\nReason: ${reason}`).catch(()=>{});

      return interaction.reply(`⏱️ Timeout ${member.user.tag} (${duration} min)\nReason: ${reason}`);
    }

    // ===== UNTIMEOUT =====
    if (interaction.commandName === "untimeout") {
      await member.timeout(null);
      return interaction.reply(`✅ Timeout removed for ${member.user.tag}`);
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);

      return interaction.reply({ content: `🧹 Deleted ${amount}`, ephemeral: true });
    }

    // ===== ADD ROLE =====
    if (interaction.commandName === "addrole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) {
        await member.roles.add(role);
      }

      return interaction.reply({ content: `✅ Added roles`, ephemeral: true });
    }

    // ===== REMOVE ROLE =====
    if (interaction.commandName === "removerole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3")
      ].filter(Boolean);

      for (const role of roles) {
        await member.roles.remove(role);
      }

      return interaction.reply({ content: `🗑️ Removed roles`, ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    return interaction.reply("❌ Error occurred");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
