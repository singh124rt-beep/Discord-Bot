const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once('clientReady', () => {
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
    return message.reply(`
📜 Commands:
.ping - Check bot
.announce <message> - Send announcement
.help - Show commands
    `);
  }

  // .announce
  if (content.startsWith('.announce ')) {
    const msg = message.content.slice(10).trim();

    if (!msg) {
      return message.reply('❌ Please provide a message');
    }

    // permission check (optional)
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('❌ You need Manage Messages permission');
    }

    message.channel.send(msg);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
