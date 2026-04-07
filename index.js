const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
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
    GatewayIntentBits.MessageContent
  ]
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // 👑 Ignore admins
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return;
  }

  const mentionedRoles = message.mentions.roles;

  const taggedHigher = HIGHER_ROLE_IDS.some(roleId =>
    mentionedRoles.has(roleId)
  );

  if (taggedHigher) {
    try {
      // 🗑️ Delete message only
      await message.delete();
    } catch (err) {
      console.log("Delete error:", err);
    }
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
