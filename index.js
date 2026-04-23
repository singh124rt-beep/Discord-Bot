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
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Alive"));
app.listen(3000);

// ===== DB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Mongo Connected"))
  .catch(console.error);

// ===== WARN MODEL =====
const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: Number,
  history: [
    {
      reason: String,
      date: String
    }
  ]
}));

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

// ===== ADM ROLE =====
const admRoleId = "1390273593040048220";

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send message with optional image")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear all warns of user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("View warn list (public)")
    .addUserOption(o => o.setName("user").setDescription("User (optional)")),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn history of user (public)")
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
    .addIntegerOption(o => o.setName("duration").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

].map(c => c.toJSON());

// ===== REGISTER =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands registered");
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const command = interaction.commandName;
    const allowed = allowedUsers.includes(interaction.user.id);

    // SAFE MEMBER FETCH
    const userOption = interaction.options.getUser("user");
    const member = userOption
      ? await interaction.guild.members.fetch(userOption.id).catch(() => null)
      : null;

    if (userOption && !member) {
      return interaction.editReply("❌ User not found in server");
    }

    const hasAdmRole = interaction.member?.roles?.cache?.has(admRoleId);

    const publicCommands = ["ping", "warnlist", "warninfo"];

    // ===== PERMISSION SYSTEM =====
    if (!publicCommands.includes(command) && !allowed) {
      return interaction.editReply("❌ No permission");
    }

    // ===== PING =====
    if (command === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

    // ===== ANNOUNCE =====
    if (command === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      const image = interaction.options.getString("image");

      if (image) {
        await channel.send({ content: msg, embeds: [{ image: { url: image } }] });
      } else {
        await channel.send(msg);
      }

      return interaction.editReply("📤 Sent");
    }

    // ===== WARN =====
    if (command === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0, history: [] });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      await data.save();
      return interaction.editReply(`Warned (${data.warns}/3)`);
    }

    // ===== UNWARN =====
    if (command === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data || data.warns === 0)
        return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      return interaction.editReply("Unwarned");
    }

    // ===== CLEARWARN (ADM + ALLOWED ONLY) =====
    if (command === "clearwarn") {
      if (!allowed && !hasAdmRole)
        return interaction.editReply("❌ No permission");

      await Warn.deleteOne({ userId: member.id });
      return interaction.editReply(`🧹 Cleared warns of ${member.user.tag}`);
    }

    // ===== WARNLIST (PUBLIC) =====
    if (command === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      if (!all.length) return interaction.editReply("No warns");

      return interaction.editReply(
        all.map(w => `<@${w.userId}> → ${w.warns}`).join("\n")
      );
    }

    // ===== WARNINFO (PUBLIC) =====
    if (command === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });

      if (!data || !data.history.length)
        return interaction.editReply("No history");

      return interaction.editReply(
        data.history.map((h, i) =>
          `${i + 1}. ${h.reason} - ${h.date}`
        ).join("\n")
      );
    }

    // ===== KICK =====
    if (command === "kick") {
      const r = interaction.options.getString("reason");
      await member.kick(r);
      return interaction.editReply("Kicked");
    }

    // ===== BAN =====
    if (command === "ban") {
      const r = interaction.options.getString("reason");
      await member.ban({ reason: r });
      return interaction.editReply("Banned");
    }

    // ===== TIMEOUT =====
    if (command === "timeout") {
      const min = interaction.options.getInteger("duration");
      const r = interaction.options.getString("reason");

      await member.timeout(min * 60000, r);
      return interaction.editReply("Timed out");
    }

    // ===== UNTIMEOUT =====
    if (command === "untimeout") {
      await member.timeout(null);
      return interaction.editReply("Timeout removed");
    }

    // ===== PURGE =====
    if (command === "purge") {
      const amt = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amt, true);
      return interaction.editReply(`Deleted ${amt}`);
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
