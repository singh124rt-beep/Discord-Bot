const express = require("express");
const mongoose = require("mongoose");
const transcripts = require("discord-html-transcripts");

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const MONGO = process.env.MONGO_URI;

const ADMIN_ROLE = "1390273593040048220";
const TICKET_CATEGORY = "1404779580283424829";
const LOG_CHANNEL = "1375845745596305408";

const ALLOWED_USERS = [
  "1420063137838923868",
  "1378368132376297514",
  "1335285604476522529"
];

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot Running"));
app.listen(3000);

// ================= DB =================
mongoose.connect(MONGO)
.then(()=>console.log("Mongo Connected"))
.catch(()=>console.log("Mongo Error"));

const TicketCounter = mongoose.model("TicketCounter", new mongoose.Schema({
  guildId: String,
  count: { type: Number, default: 0 }
}));

const Warn = mongoose.model("Warn", new mongoose.Schema({
  userId: String,
  warns: [{ reason: String, by: String, time: Date }]
}));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= PERMISSION =================
function isAllowed(member) {
  return (
    member.roles.cache.has(ADMIN_ROLE) ||
    ALLOWED_USERS.includes(member.user.id) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// ================= COMMANDS =================
const commands = [

  new SlashCommandBuilder().setName("ping").setDescription("Ping"),

  new SlashCommandBuilder().setName("serverinfo").setDescription("Server Info"),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Announcement")
    .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel"))
    .addAttachmentOption(o => o.setName("file1").setDescription("File1"))
    .addAttachmentOption(o => o.setName("file2").setDescription("File2")),

  new SlashCommandBuilder().setName("ticketpanel").setDescription("Ticket panel"),
  new SlashCommandBuilder().setName("close").setDescription("Close ticket"),

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
    .addIntegerOption(o => o.setName("time").setDescription("Minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Untimeout")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Remove one warn")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Clear warns")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder().setName("warnlist").setDescription("Warn list"),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount").setRequired(true)),

  new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove role")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true))

].map(c => c.toJSON());

// ================= READY =================
client.once("ready", async () => {
  console.log("Bot Ready");

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("Commands Registered");
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async i => {
  try {

    if (!i.guild) return;

    // ================= BASIC =================
    if (i.commandName === "ping")
      return i.reply({ content: "Pong", ephemeral: true });

    if (i.commandName === "serverinfo")
      return i.reply({ content: `Members: ${i.guild.memberCount}`, ephemeral: true });

    // ================= ANNOUNCE =================
    if (i.commandName === "announce") {
      if (!isAllowed(i.member)) return i.reply({ content: "No permission", ephemeral: true });

      const msg = i.options.getString("message");
      const ch = i.options.getChannel("channel") || i.channel;

      const files = [];
      ["file1","file2"].forEach(f=>{
        const file=i.options.getAttachment(f);
        if(file) files.push(file.url);
      });

      await ch.send({ content: msg, files });
      return i.reply({ content: "Sent 📤", ephemeral: true });
    }

    // ================= TICKET PANEL =================
    if (i.commandName === "ticketpanel") {
      if (!i.member.roles.cache.has(ADMIN_ROLE))
        return i.reply({ content: "No permission", ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket").setLabel("Create Ticket").setStyle(ButtonStyle.Primary)
      );

      await i.channel.send({ content: "To open a Ticket Click below 👇", components: [row] });
      return i.reply({ content: "Sent 📤", ephemeral: true });
    }

    // ================= CLOSE COMMAND =================
    if (i.commandName === "close") {
      if (!isAllowed(i.member)) return i.reply({ content: "No permission", ephemeral: true });

      await i.reply({ content: "Closing...", ephemeral: true });
      setTimeout(()=> i.channel.delete(),2000);
    }

    // ================= BUTTON =================
    if (i.isButton() && i.customId === "ticket") {

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("type")
          .setPlaceholder("Select Ticket Type")
          .addOptions([
            { label: "Support", value: "Support" },
            { label: "Report", value: "Report" },
            { label: "Help", value: "Help" }
          ])
      );

      return i.reply({ content: "Select type", components: [menu], ephemeral: true });
    }

    // ================= SELECT =================
    if (i.isStringSelectMenu()) {

      const counter = await TicketCounter.findOneAndUpdate(
        { guildId: i.guild.id },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
      );

      const channel = await i.guild.channels.create({
        name: `ticket-${counter.count}`,
        type: 0,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel","SendMessages"] },
          { id: ADMIN_ROLE, allow: ["ViewChannel","SendMessages"] }
        ]
      });

      const closeBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("close_btn").setLabel("Close").setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `<@&${ADMIN_ROLE}>\n\nName: <@${i.user.id}>\nType: ${i.values[0]}\nDescribe your issue:\n\nOur team will assist you shortly`,
        components: [closeBtn]
      });

      return i.update({ content: "Ticket Created", components: [] });
    }

    // ================= CLOSE BUTTON =================
    if (i.isButton() && i.customId === "close_btn") {
      if (!isAllowed(i.member))
        return i.reply({ content: "No permission", ephemeral: true });

      await i.reply({ content: "Closing...", ephemeral: true });
      setTimeout(()=> i.channel.delete(),2000);
    }

    // ================= MODERATION =================
    if (!isAllowed(i.member))
      return i.reply({ content: "No permission", ephemeral: true });

    if (i.commandName === "kick") {
      const u=i.options.getUser("user");
      await i.guild.members.kick(u.id);
      return i.reply({ content: `Kicked ${u.tag}`, ephemeral: true });
    }

    if (i.commandName === "ban") {
      const u=i.options.getUser("user");
      await i.guild.members.ban(u.id);
      return i.reply({ content: `Banned ${u.tag}`, ephemeral: true });
    }

    if (i.commandName === "timeout") {
      const u=i.options.getUser("user");
      const t=i.options.getInteger("time");
      const m=await i.guild.members.fetch(u.id);
      await m.timeout(t*60000);
      return i.reply({ content: "Timed out", ephemeral: true });
    }

    if (i.commandName === "untimeout") {
      const u=i.options.getUser("user");
      const m=await i.guild.members.fetch(u.id);
      await m.timeout(null);
      return i.reply({ content: "Removed timeout", ephemeral: true });
    }

    if (i.commandName === "purge") {
      const a=i.options.getInteger("amount");
      await i.channel.bulkDelete(a);
      return i.reply({ content: "Deleted", ephemeral: true });
    }

    if (i.commandName === "addrole") {
      const u=i.options.getUser("user");
      const r=i.options.getRole("role");
      const m=await i.guild.members.fetch(u.id);
      await m.roles.add(r);
      return i.reply({ content: "Role added", ephemeral: true });
    }

    if (i.commandName === "removerole") {
      const u=i.options.getUser("user");
      const r=i.options.getRole("role");
      const m=await i.guild.members.fetch(u.id);
      await m.roles.remove(r);
      return i.reply({ content: "Role removed", ephemeral: true });
    }

    // ================= WARN SYSTEM =================
    if (i.commandName === "warn") {
      const u=i.options.getUser("user");
      const r=i.options.getString("reason");

      let data = await Warn.findOne({ userId: u.id }) || new Warn({ userId: u.id, warns: [] });
      data.warns.push({ reason: r, by: i.user.id, time: new Date() });
      await data.save();

      if (data.warns.length >= 3) {
        const m=await i.guild.members.fetch(u.id);
        await m.timeout(24*60*60*1000);
      }

      return i.reply({ content: `<@${u.id}> warned (${data.warns.length}/3)`, ephemeral: true });
    }

    if (i.commandName === "unwarn") {
      const u=i.options.getUser("user");
      let data = await Warn.findOne({ userId: u.id });
      if (!data) return i.reply({ content: "No warns", ephemeral: true });

      data.warns.pop();
      await data.save();

      return i.reply({ content: `<@${u.id}> unwarned (${data.warns.length}/3)`, ephemeral: true });
    }

    if (i.commandName === "clearwarn") {
      const u=i.options.getUser("user");
      await Warn.deleteOne({ userId: u.id });
      return i.reply({ content: "Cleared", ephemeral: true });
    }

    if (i.commandName === "warnlist") {
      const all = await Warn.find();
      const text = all.map(x=>`<@${x.userId}> - ${x.warns.length}`).join("\n");
      return i.reply({ content: text || "No warns", ephemeral: true });
    }

  } catch (err) {
    console.error(err);
    if (!i.replied) i.reply({ content: "Error", ephemeral: true });
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_BOT_TOKEN);
