const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const app = express();

// ✅ KEEP RENDER ALIVE (PORT FIX)
app.get('/', (req, res) => {
  res.send('Bot is running');
});

app.listen(3000, () => {
  console.log('🌐 Web server running');
});

// ✅ DISCORD BOT
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

    if (!msg) {
      return message.reply('❌ Please provide a message');
    }

    // ✅ FIXED PERMISSION
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You need Manage Messages permission');
    }

    try {
      await message.delete(); // optional clean
    } catch {}

    message.channel.send(`${msg}`);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
