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
  warns: Number
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

// ===== COMMANDS =====
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send message with optional image")
    .addStringOption(o =>
      o.setName("message").setDescription("Text message").setRequired(true))
    .addChannelOption(o =>
      o.setName("channel").setDescription("Target channel").setRequired(true)
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
    .setName("unwarn")
    .setDescription("Remove a warn")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)),

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
      o.setName("amount").setDescription("Amount").setRequired(true)),

  // ===== ADD ROLE (5 ROLES) =====
  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5")),

  // ===== REMOVE ROLE (5 ROLES) =====
  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove multiple roles")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role1").setDescription("Role 1").setRequired(true))
    .addRoleOption(o => o.setName("role2").setDescription("Role 2"))
    .addRoleOption(o => o.setName("role3").setDescription("Role 3"))
    .addRoleOption(o => o.setName("role4").setDescription("Role 4"))
    .addRoleOption(o => o.setName("role5").setDescription("Role 5"))

].map(c => c.toJSON());

// ===== REGISTER =====
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await new REST({ version: "10" })
    .setToken(process.env.DISCORD_BOT_TOKEN)
    .put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands registered");
});

// ===== BUTTON =====
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  if (i.customId === "dismiss") {
    return i.update({ content: "✅ Closed", components: [] });
  }
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const allowed = allowedUsers.includes(interaction.user.id);
    const member = interaction.options.getMember("user");

    if (interaction.commandName !== "ping" && !allowed)
      return interaction.editReply("❌ No permission");

    // ===== ANNOUNCE =====
    if (interaction.commandName === "announce") {
      const msg = interaction.options.getString("message");
      const channel = interaction.options.getChannel("channel");
      const image = interaction.options.getString("image");

      if (image) {
        await channel.send({
          content: msg,
          embeds: [{ image: { url: image } }]
        });
      } else {
        await channel.send(msg);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("dismiss")
          .setLabel("Dismiss")
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({
        content: "📤 Announcement sent",
        components: [row]
      });
    }

    // ===== WARN =====
    if (interaction.commandName === "warn") {
      const reason = interaction.options.getString("reason");

      let data = await Warn.findOne({ userId: member.id });
      if (!data) data = new Warn({ userId: member.id, warns: 0 });

      data.warns++;

      if (data.warns >= 3) {
        await member.timeout(86400000, "3 warns");
        data.warns = 0;
        await data.save();

        await member.send(`🚫 Timeout 24h\nReason: ${reason}`).catch(()=>{});
        await interaction.channel.send(`🚫 ${member.user.tag} timed out (3 warns)`);

        return interaction.editReply("✅ Done");
      }

      await data.save();
      await member.send(`⚠️ Warn\nReason: ${reason}`).catch(()=>{});
      await interaction.channel.send(`⚠️ ${member.user.tag} warned (${data.warns}/3)`);

      return interaction.editReply("✅ Done");
    }

    // ===== UNWARN =====
    if (interaction.commandName === "unwarn") {
      let data = await Warn.findOne({ userId: member.id });

      if (!data || data.warns === 0)
        return interaction.editReply("⚠️ No warns");

      data.warns--;
      await data.save();

      await member.send("✅ Warn removed").catch(()=>{});
      await interaction.channel.send(`✅ ${member.user.tag} unwarned (${data.warns}/3)`);

      return interaction.editReply("✅ Done");
    }

    // ===== KICK =====
    if (interaction.commandName === "kick") {
      const reason = interaction.options.getString("reason");

      await member.send(`👢 Kicked\nReason: ${reason}`).catch(()=>{});
      await member.kick(reason);

      await interaction.channel.send(`👢 ${member.user.tag} kicked\nReason: ${reason}`);
      return interaction.editReply("✅ Done");
    }

    // ===== BAN =====
    if (interaction.commandName === "ban") {
      const reason = interaction.options.getString("reason");

      await member.send(`🔨 Banned\nReason: ${reason}`).catch(()=>{});
      await member.ban({ reason });

      await interaction.channel.send(`🔨 ${member.user.tag} banned\nReason: ${reason}`);
      return interaction.editReply("✅ Done");
    }

    // ===== TIMEOUT =====
    if (interaction.commandName === "timeout") {
      const min = interaction.options.getInteger("duration");
      const reason = interaction.options.getString("reason");
      const hrs = (min / 60).toFixed(1);

      await member.timeout(min * 60000, reason);

      await interaction.channel.send(
        `⏱️ ${member.user.tag} timeout\nDuration: ${min} min (${hrs} hrs)\nReason: ${reason}`
      );

      return interaction.editReply("✅ Done");
    }

    // ===== UNTIMEOUT =====
    if (interaction.commandName === "untimeout") {
      await member.timeout(null);
      await interaction.channel.send(`✅ Timeout removed: ${member.user.tag}`);
      return interaction.editReply("✅ Done");
    }

    // ===== PURGE =====
    if (interaction.commandName === "purge") {
      const amt = interaction.options.getInteger("amount");
      await interaction.channel.bulkDelete(amt, true);
      return interaction.editReply(`🧹 Deleted ${amt}`);
    }

    // ===== ADD ROLE =====
    if (interaction.commandName === "addrole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      for (const role of roles) await member.roles.add(role);

      await interaction.channel.send(`✅ Added ${roles.length} role(s) to ${member.user.tag}`);
      return interaction.editReply("✅ Done");
    }

    // ===== REMOVE ROLE =====
    if (interaction.commandName === "removerole") {
      const roles = [
        interaction.options.getRole("role1"),
        interaction.options.getRole("role2"),
        interaction.options.getRole("role3"),
        interaction.options.getRole("role4"),
        interaction.options.getRole("role5")
      ].filter(Boolean);

      for (const role of roles) await member.roles.remove(role);

      await interaction.channel.send(`🗑️ Removed ${roles.length} role(s) from ${member.user.tag}`);
      return interaction.editReply("✅ Done");
    }

    if (interaction.commandName === "ping") {
      return interaction.editReply("🏓 Pong!");
    }

  } catch (err) {
    console.error(err);
    interaction.editReply("❌ Error");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
