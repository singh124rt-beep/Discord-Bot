const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder, WebhookClient } = require('discord.js');
const express = require("express");

const app = express();
app.get("/", (req, res) => res.send("Bot Alive"));
app.listen(3000);

// 👇 ADD YOUR HIGHER ROLE IDS
const HIGHER_ROLE_IDS = [
  "1361186641376575549",
  "1459503999786156208",
  "1396895987821445252"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// 🔹 Webhook setup
const webhookClient = new WebhookClient({
    id: '1491013093529092116',
    token: 'JXl_3pGkcnRtvrTZ9md85cEYCfCvHAJvtXu6ABGue8Ky4OY7cBtGvFS-3HNwTRV11P1Z'
});

// 🔹 Slash command setup
const commands = [
  new SlashCommandBuilder()
    .setName('getinfo')
    .setDescription('Show server info')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// 🔹 Message handler: role tag deletion + webhook command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 🔹 Webhook command: !webhook
  if (message.content.toLowerCase() === '!webhook') {
      webhookClient.send(`📢 Hello! ${message.author.username} triggered this webhook message!`)
        .then(() => {
            message.reply('✅ Message sent via webhook!');
        })
        .catch(error => {
            console.error(error);
            message.reply('❌ Could not send webhook message.');
        });
  }

  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const mentionedRoles = message.mentions.roles;
  const taggedHigher = HIGHER_ROLE_IDS.some(roleId =>
    mentionedRoles.has(roleId)
  );

  if (taggedHigher) {
    try {
      await message.delete();
    } catch (err) {
      console.log("Delete error:", err);
    }
  }
});

// 🔹 Bot ready + register slash command
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash command registered");
});

// 🔹 /getinfo command (usable by everyone)
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'getinfo') {
    await interaction.reply(`👋 Welcome to City Role Play!

Hey there! We're glad to have you join our city 🌆  
This server is all about creating your own story and living your role.

🎭 **Pick Your Role**  
Choose a role that fits your character—citizen, police, criminal, business owner, or anything in between!

📜 **Rules First**  
Before you start, make sure to read the rules carefully to keep the roleplay fun and fair for everyone.

🚀 **Get Started**  
Head over to the role selection channel and begin your journey in the city!

💬 **Need Help?**  
Feel free to ask staff or other members—we’re here to help.

Enjoy Playing City Role Play 🎉`);
  }
});

client.login(process.env.TOKEN);
