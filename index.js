const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const GREETINGS = ['hi', 'hello', 'hey', 'sup', 'howdy', 'hiya'];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// MESSAGE COMMANDS
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // Greeting
  if (GREETINGS.some(g => lower === g || lower.startsWith(g + ' '))) {
    return message.reply(`Hi ${message.author.username}! 👋`);
  }

  // HELP
  if (lower === '!help') {
    return message.reply(
      `**Commands:**\n` +
      `• hi / hello / hey → greeting\n` +
      `• !announce <msg> → send announcement\n` +
      `• !help → show commands`
    );
  }

  // ANNOUNCE
  if (lower.startsWith('!announce ')) {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return message.reply('❌ You need Manage Messages permission.');
    }

    const msg = content.slice(10);
    if (!msg) return message.reply('❌ Write a message.');

    return message.channel.send(`📢 ${msg}`);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
