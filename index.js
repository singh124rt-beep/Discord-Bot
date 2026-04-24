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
  .then(() => console.log("✅ Mongo Connected"))
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
    GatewayIntentBits.GuildMembers
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
// COMMANDS
// =====================================================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel (optional)")
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
    .setDescription("Show all warned users"),

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

// ===== READY =====
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("✅ Commands registered");
});

// ===== HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "serverinfo") {
    await interaction.deferReply(); // PUBLIC
  } else {
    await interaction.deferReply({ ephemeral: true }); // PRIVATE
  }

  try {
    const cmd = interaction.commandName;
    const allowed = allowedUsers.includes(interaction.user.id);
    const hasRole = interaction.member.roles.cache.has(purgeRoleId);

    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;

    if (user && !member)
      return interaction.editReply("❌ User not found");

    // PERMISSIONS
    if (!["ping","warnlist","warninfo","serverinfo"].includes(cmd)) {
      if (cmd === "purge") {
        if (!allowed && !hasRole)
          return interaction.editReply("❌ No permission");
      } else if (!allowed) {
        return interaction.editReply("❌ No permission");
      }
    }

    // ===== SERVERINFO =====
    if (cmd === "serverinfo") {
      return interaction.editReply({
        embeds: [{
          color: 0x2b2d31,
          title: "👋 Welcome to City Role Play!",
          description: "We're glad to have you join our city 🌆\nThis server is all about creating your own story and living your role.",
          image: {
            url: "https://i.imgur.com/JeZR5OO.jpg"
          },
          fields: [
            { name: "🎭 Pick Your Role", value: "Citizen, Police, Criminal, Business Owner, Airforce and more." },
            { name: "📜 Rules First", value: "Read rules to keep RP fair and fun." },
            { name: "🚀 Get Started", value: "Go to role channel and begin your journey." },
            { name: "💬 Need Help?", value: "Ask staff anytime." }
          ],
          footer: { text: "Enjoy Playing City Role Play 🎉" },
          timestamp: new Date()
        }]
      });
    }

    // ===== ANNOUNCE =====
    if (cmd === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel") || interaction.channel;
      const image = interaction.options.getString("image");

      if (image)
        await channel.send({ content: msg, embeds: [{ image: { url: image } }] });
      else
        await channel.send(msg);

      return interaction.editReply("📤 Sent");
    }

    // ===== WARN =====
    if (cmd === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id }) || new Warn({ userId: member.id });

      data.warns++;
      data.history.push({ reason, date: new Date().toLocaleString() });

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        data.warns = 0;
        data.history = [];
      }

      await data.save();

      await interaction.channel.send(`⚠️ <@${member.id}> warned (${data.warns}/3)\nReason: ${reason}`);
      return interaction.editReply("Done");
    }

    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.editReply(all.map(w=>`<@${w.userId}> → ${w.warns}`).join("\n") || "No warns");
    }

    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.editReply("No history");

      return interaction.editReply(data.history.map((h,i)=>`${i+1}. ${h.reason} (${h.date})`).join("\n"));
    }

    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });
      return interaction.editReply("Cleared");
    }

    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
