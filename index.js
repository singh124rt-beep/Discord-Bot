const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

// Use Replit's port
const PORT = process.env.PORT || 3000;

const app = express();

// Keep web server alive
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// Discord bot setup
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

  // Greetings
  const greetings = ['hi', 'hello', 'hey'];
  if (greetings.some(g => content.includes(g))) {
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

// === Login ===
// ⚠️ Replace 'YOUR_BOT_TOKEN_HERE' with your Discord bot token
client.login('YOUR_BOT_TOKEN_HERE');
