const express = require("express");
const {
Client,
GatewayIntentBits,
PermissionsBitField,
REST,
Routes,
SlashCommandBuilder,
EmbedBuilder
} = require("discord.js");

console.log("🔥 BOT STARTING...");

// ===== WEB SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot Alive ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Web running"));

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
"1420063137838923868",
"1378368132376297514"
];

// ===== WARN STORAGE =====
const warns = new Map();

// ===== SLASH COMMANDS =====
const commands = [

new SlashCommandBuilder().setName("ping").setDescription("Check bot"),

new SlashCommandBuilder()
.setName("kick")
.setDescription("Kick a user")
.addUserOption(opt => opt.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("ban")
.setDescription("Ban a user")
.addUserOption(opt => opt.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("timeout")
.setDescription("Timeout a user")
.addUserOption(opt => opt.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("warn")
.setDescription("Warn a user")
.addUserOption(opt => opt.setName("user").setRequired(true)),

new SlashCommandBuilder()
.setName("announce")
.setDescription("Send announcement")
.addStringOption(opt => opt.setName("message").setRequired(true)),

new SlashCommandBuilder()
.setName("addrole")
.setDescription("Give role")
.addUserOption(opt => opt.setName("user").setRequired(true))
.addRoleOption(opt => opt.setName("role").setRequired(true)),

new SlashCommandBuilder()
.setName("removerole")
.setDescription("Remove role")
.addUserOption(opt => opt.setName("user").setRequired(true))
.addRoleOption(opt => opt.setName("role").setRequired(true)),

new SlashCommandBuilder()
.setName("addroles")
.setDescription("Give multiple roles")
.addUserOption(opt => opt.setName("user").setRequired(true))
.addRoleOption(opt => opt.setName("role1").setRequired(true))
.addRoleOption(opt => opt.setName("role2"))
.addRoleOption(opt => opt.setName("role3"))
.addRoleOption(opt => opt.setName("role4"))
.addRoleOption(opt => opt.setName("role5"))

].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// ===== REGISTER =====
async function registerCommands(clientId) {
await rest.put(Routes.applicationCommands(clientId), { body: commands });
console.log("⚡ Commands registered");
}

// ===== READY =====
client.once("ready", async () => {
console.log(🟢 Logged in as ${client.user.tag});
await registerCommands(client.user.id);
});

// ===== WELCOME =====
client.on("guildMemberAdd", async (member) => {

const channel = member.guild.channels.cache.get("1493306099317739590");
const role = member.guild.roles.cache.get("1366502670788984902");

if (!channel) return;

const embed = new EmbedBuilder()
.setColor("#00b0f4")
.setTitle("🌆 Welcome to City Role Play!")
.setDescription(`👋 Hey <@${member.id}>!

Welcome to City Role Play 🌆
Enjoy your RP journey 🚀)   .setThumbnail(member.user.displayAvatarURL())   .setImage("https://cdn.discordapp.com/attachments/1493306099317739590/1493309044956463224/file_00000000f47c72088b760408f4b93739.png")   .setFooter({ text: Member #${member.guild.memberCount}` })
.setTimestamp();

await channel.send({
content: 🎉 Welcome <@${member.id}>!,
embeds: [embed],
allowedMentions: { users: [member.id] }
});

if (role) member.roles.add(role).catch(() => {});
});

// ===== GREETING (FIXED) =====
client.on("messageCreate", (message) => {
if (message.author.bot) return;

const msg = message.content.toLowerCase().trim();

if (msg === "hi" || msg === "hello" || msg === "hey") {
return message.reply(
👋 Greetings, ${message.author.username} Welcome to CRP
);
}
});

// ===== COMMAND HANDLER =====
client.on("interactionCreate", async (interaction) => {
if (!interaction.isChatInputCommand()) return;

if (!allowedUsers.includes(interaction.user.id)) {
return interaction.reply({ content: "❌ Not allowed", ephemeral: true });
}

const member = interaction.options.getMember("user");

if (!member) {
return interaction.reply({ content: "❌ User not found", ephemeral: true });
}

if (interaction.commandName === "ping") {
return interaction.reply("🏓 Pong!");
}

if (interaction.commandName === "kick") {
await member.kick();
return interaction.reply(👢 ${member.user.tag} kicked);
}

if (interaction.commandName === "ban") {
await member.ban();
return interaction.reply(🔨 ${member.user.tag} banned);
}

if (interaction.commandName === "timeout") {
await member.timeout(10 * 60 * 1000);
return interaction.reply(⏱️ Timeout applied);
}

if (interaction.commandName === "warn") {
const id = member.id;
warns.set(id, (warns.get(id) || 0) + 1);
return interaction.reply(⚠️ Warned (${warns.get(id)}));
}

if (interaction.commandName === "announce") {
const msg = interaction.options.getString("message");
await interaction.reply({ content: "✅ Sent", ephemeral: true });
return interaction.channel.send(\n\n${msg});
}

if (interaction.commandName === "addrole") {
const role = interaction.options.getRole("role");
await member.roles.add(role);
return interaction.reply(✅ Role ${role.name} given);
}

if (interaction.commandName === "removerole") {
const role = interaction.options.getRole("role");
await member.roles.remove(role);
return interaction.reply(❌ Role ${role.name} removed);
}

if (interaction.commandName === "addroles") {
const roles = [
interaction.options.getRole("role1"),
interaction.options.getRole("role2"),
interaction.options.getRole("role3"),
interaction.options.getRole("role4"),
interaction.options.getRole("role5")
].filter(r => r);

try {  
  for (const role of roles) {  
    await member.roles.add(role);  
  }  

  return interaction.reply(`✅ ${roles.length} roles added`);  
} catch (err) {  
  console.error(err);  
  return interaction.reply({  
    content: "❌ Failed to add roles",  
    ephemeral: true  
  });  
}

}

});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);
