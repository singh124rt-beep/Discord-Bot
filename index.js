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
if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Missing TOKEN");
if (!process.env.MONGO_URI) throw new Error("Missing MONGO");

// ===== SERVER =====
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

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement")
    .addStringOption(o => o.setName("message").setDescription("Text").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel").setRequired(false)
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName("image").setDescription("Image URL")),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server info"),

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

  new SlashCommandBuilder().setName("warnlist").setDescription("All warns"),
  new SlashCommandBuilder()
    .setName("warninfo")
    .setDescription("Warn history")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout")
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
  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });
});

// ===== BUTTON =====
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;
  if (i.customId === "dismiss") {
    return i.update({ content: "✅ Closed", components: [] });
  }
});

// ===== MAIN HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const cmd = interaction.commandName;
    const allowed = allowedUsers.includes(interaction.user.id);
    const hasRole = interaction.member.roles.cache.has(purgeRoleId);

    const user = interaction.options.getUser("user");
    const member = user ? await interaction.guild.members.fetch(user.id).catch(()=>null) : null;

    if (user && !member)
      return interaction.editReply("❌ User not found");

    if (!["ping","warnlist","warninfo","serverinfo"].includes(cmd)) {
      if (cmd === "purge") {
        if (!allowed && !hasRole)
          return interaction.editReply("❌ No permission");
      } else if (!allowed) {
        return interaction.editReply("❌ No permission");
      }
    }

    // ===== SERVER INFO =====
    if (cmd === "serverinfo") {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setImage("https://i.imgur.com/JeZR5OO.jpg")
        .setDescription(`
👋 Welcome to City Role Play!

This server is all about creating your own story and living your role.

🎭 Pick Your Role  
Choose roles like Police, Civilian, Gang Member, Business Owner, Airforce and more.

📜 Rules First  
Follow rules for fair and realistic RP.

🚀 Get Started  
Go to role channel and begin your journey.

💬 Need Help?  
Ask staff anytime.

Enjoy your stay 🌆
`);

      return interaction.reply({ embeds: [embed], ephemeral: false });
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

      try {
        await member.send(`⚠️ Warned in ${interaction.guild.name}\nReason: ${reason}\nWarns: ${data.warns}/3`);
      } catch {}

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");

        await interaction.channel.send(`🚫 ${member.user.tag} reached 3 warns → Timeout 24h`);

        data.warns = 0;
        data.history = [];
        await data.save();

        return interaction.editReply("⚠️ Warn added → punished");
      }

      await data.save();
      await interaction.channel.send(`⚠️ ${member.user.tag} warned (${data.warns}/3)\nReason: ${reason}`);

      return interaction.editReply("Warn added");
    }

    // ===== UNWARN =====
    if (cmd === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });
      if (!data || data.warns === 0)
        return interaction.editReply("No warns");

      data.warns--;
      data.history.pop();
      await data.save();

      await interaction.channel.send(`✅ ${member.user.tag} warning removed (${data.warns}/3)`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("dismiss").setLabel("Dismiss").setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: "Warning Removed", components: [row] });
    }

    // ===== CLEAR WARN =====
    if (cmd === "clearwarn") {
      await Warn.deleteOne({ userId: member.id });

      await interaction.channel.send(`🧹 ${member.user.tag} warnings cleared (0/3)`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("dismiss").setLabel("Dismiss").setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ content: "Warning Removed", components: [row] });
    }

    // ===== WARNLIST =====
    if (cmd === "warnlist") {
      const all = await Warn.find({ warns: { $gt: 0 } });
      return interaction.reply({
        content: all.map(w => `<@${w.userId}> → ${w.warns}/3`).join("\n") || "No warns",
        ephemeral: false
      });
    }

    // ===== WARNINFO =====
    if (cmd === "warninfo") {
      const data = await Warn.findOne({ userId: member.id });
      if (!data) return interaction.reply({ content: "No history", ephemeral: false });

      return interaction.reply({
        content: data.history.map((h,i)=>`${i+1}. ${h.reason} (${h.date})`).join("\n"),
        ephemeral: false
      });
    }

    // ===== OTHER COMMANDS SAME =====
    if (cmd === "ping") return interaction.editReply("🏓 Pong!");

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
