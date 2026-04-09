const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const app = express();

// ✅ Keep web server alive
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(3000, () => {
  console.log('🌐 Web server running');
});

// ✅ Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // ✅ Greetings
  const greetings = ['hi', 'hello', 'hey'];
  if (greetings.includes(content)) {
    return message.channel.send(`Hi, ${message.author.username} 👋 Welcome to CRP`);
  }

  // .ping
  if (content === '.ping') {
    return message.reply('Pong!');
  }

  // .help
  if (content === '.help') {
    return message.reply(`📜 Commands:
.ping
.help
.announce <message>`);
  }

  // .announce
  if (content.startsWith('.announce ')) {
    const msg = message.content.slice(10).trim();
    if (!msg) return message.reply('❌ Please provide a message');

    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You need Manage Messages permission');
    }

    try { await message.delete(); } catch {}
    message.channel.send(`${msg}`);
  }
});

// ✅ Login
client.login(process.env.DISCORD_BOT_TOKEN);
