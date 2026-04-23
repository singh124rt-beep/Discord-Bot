const express = require("express");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== ENV =====
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== EXPRESS =====
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

// ===== USERS / ROLES =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

const admRoleId = "1390273593040048220";

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("Channel")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

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
    .setName("clearwarn")
    .setDescription("Clear all warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("Show all warns")
    .addUserOption(o => o.setName("user").setDescription("User (optional)")),

  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn history")
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

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))
    .addRoleOption(o => o.setName("role4"))
    .addRoleOption(o => o.setName("role5")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role").setRequired(true))
    .addRoleOption(o => o.setName("role2"))
    .addRoleOption(o => o.setName("role3"))
    .addRoleOption(o => o.setName("role4"))
    .addRoleOption(o => o.setName("role5"))

].map(c => c.toJSON());

// ===== REGISTER COMMANDS =====
async function register() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Slash commands registered");
}

// ===== READY EVENT (FIXED) =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

// ===== HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const command = interaction.commandName;
    const allowed = allowedUsers.includes(interaction.user.id);

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    const hasAdmRole = interaction.member?.roles?.cache?.has(admRoleId);

    const publicCmds = ["ping", "warnlist", "warninfo"];

    if (!publicCmds.includes(command) && !allowed) {
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

    // ===== WARN (WITH DM + 3 WARN 24H) =====
    if (command === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0, history: [] });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      // 📩 DM USER
      await member.send(`⚠️ You got warned in **${interaction.guild.name}**\nReason: ${reason}`).catch(() => {});

      // 🚫 3 WARN = 24H TIMEOUT
      if (data.warns >= 3) {
        await member.timeout(24 * 60 * 60 * 1000, "3 warns reached");

        const old = data.warns;
        data.warns = 0;
        data.history = [];

        await data.save();

        return interaction.editReply(`🚫 ${member.user.tag} got 24h timeout (3 warns)`);
      }

      await data.save();
      return interaction.editReply(`⚠️ Warned (${data.warns}/3)`);
    }

    // ===== WARNINFO =====
    if (command === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(
        data.history.map((h, i) => `${i + 1}. ${h.reason} - ${h.date}`).join("\n")
      );
    }

    // ===== WARNLIST =====
    if (command === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(
        all.map(w => `<@${w.userId}> → ${w.warns}`).join("\n") || "No warns"
      );
    }

    // ===== CLEARWARN =====
    if (command === "clearwarn") {
      if (!allowed && !hasAdmRole)
        return interaction.editReply("❌ No permission");

      await Warn.deleteOne({ userId: member.id });
      return interaction.editReply("Cleared warns");
    }

    // ===== UNWARN =====
    if (command === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      return interaction.editReply("Unwarned");
    }

    // ===== KICK / BAN / TIMEOUT =====
    if (command === "kick") {
      await member.kick(interaction.options.getString("reason"));
      return interaction.editReply("Kicked");
    }

    if (command === "ban") {
      await member.ban({ reason: interaction.options.getString("reason") });
      return interaction.editReply("Banned");
    }

    if (command === "timeout") {
      await member.timeout(
        interaction.options.getInteger("duration") * 60000,
        interaction.options.getString("reason")
      );
      return interaction.editReply("Timed out");
    }

    if (command === "untimeout") {
      await member.timeout(null);
      return interaction.editReply("Timeout removed");
    }

    // ===== ROLE SYSTEM =====
    if (command === "addrole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const r of roles) await member.roles.add(r);
      return interaction.editReply("Roles added");
    }

    if (command === "removerole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r => interaction.options.getRole(r))
        .filter(Boolean);

      for (const r of roles) await member.roles.remove(r);
      return interaction.editReply("Roles removed");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
