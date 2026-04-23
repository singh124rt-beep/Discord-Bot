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
  warns: { type: Number, default: 0 },
  history: [{ reason: String, date: String }]
}));

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== CONFIG =====
const allowedUsers = [
  "1390273593040048220",
  "1448606724100456459",
  "1420063137838923868"
];

const purgeRoleId = "1390273593040048220";

// =====================================================
// ANTI-SPAM
// =====================================================
const spamMap = new Map();

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const id = message.author.id;
  const now = Date.now();

  const data = spamMap.get(id) || { count: 0, last: now };

  if (now - data.last > 5000) {
    data.count = 0;
    data.last = now;
  }

  data.count++;
  spamMap.set(id, data);

  if (data.count >= 5) {
    const member = await message.guild.members.fetch(id).catch(() => null);
    if (member) {
      await member.timeout(5 * 60 * 1000, "Anti-spam");
      message.channel.send(`🚨 ${member.user.tag} muted for spam`);
    }
    spamMap.set(id, { count: 0, last: now });
  }
});

// =====================================================
// COMMANDS
// =====================================================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel").setRequired(true)
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
    .setDescription("Show all warns"),

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
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5")),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))

].map(c => c.toJSON());

// REGISTER
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
});

// HANDLER
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const cmd = interaction.commandName;
    const allowed = allowedUsers.includes(interaction.user.id);
    const hasRole = interaction.member.roles.cache.has(purgeRoleId);

    const user = interaction.options.getUser("user");
    const member = user
      ? await interaction.guild.members.fetch(user.id).catch(() => null)
      : null;

    // PERMISSIONS
    if (!["ping","warnlist","warninfo"].includes(cmd)) {
      if (cmd === "purge") {
        if (!allowed && !hasRole)
          return interaction.editReply("❌ No permission");
      } else if (!allowed) {
        return interaction.editReply("❌ No permission");
      }
    }

    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      const image = interaction.options.getString("image");

      if (image)
        await channel.send({ content: msg, embeds: [{ image: { url: image } }] });
      else
        await channel.send(msg);

      return interaction.editReply("📢 Sent");
    }

    // WARN
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id, warns: 0, history: [] });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        data.warns = 0;
        data.history = [];
      }

      await data.save();

      await interaction.channel.send(`⚠️ <@${member.id}> warned\nReason: ${reason}`);
      return interaction.editReply("Warned");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(data.history.map((h,i)=>`${i+1}. ${h.reason}`).join("\n"));
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(all.map(w=>`<@${w.userId}> → ${w.warns}`).join("\n") || "No warns");
    }

    if (cmd === "kick") {
      await member.kick();
      await interaction.channel.send(`👢 <@${member.id}> kicked`);
      return interaction.editReply("Done");
    }

    if (cmd === "ban") {
      await member.ban();
      await interaction.channel.send(`🔨 <@${member.id}> banned`);
      return interaction.editReply("Done");
    }

    if (cmd === "timeout") {
      const d = interaction.options.getInteger("duration");
      await member.timeout(d * 60000);
      return interaction.editReply("Timed out");
    }

    if (cmd === "untimeout") {
      await member.timeout(null);
      return interaction.editReply("Removed timeout");
    }

    if (cmd === "purge") {
      const amount = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amount, true);
      return interaction.editReply("Deleted");
    }

    if (cmd === "addrole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r=>interaction.options.getRole(r)).filter(Boolean);

      for (const r of roles) await member.roles.add(r);
      return interaction.editReply("Added");
    }

    if (cmd === "removerole") {
      const roles = ["role1","role2","role3","role4","role5"]
        .map(r=>interaction.options.getRole(r)).filter(Boolean);

      for (const r of roles) await member.roles.remove(r);
      return interaction.editReply("Removed");
    }

    if (cmd === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      return interaction.editReply("Unwarned");
    }

    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });
      return interaction.editReply("Cleared");
    }

  } catch (err) {
    console.error(err);
    return interaction.editReply("❌ Error");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
