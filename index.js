const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Web server (for Render)
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`🌐 Server running on ${PORT}`));

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// ===== COMMANDS =====
const commands = [];

// ping
commands.push(
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!')
);

// help
commands.push(
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show commands')
);

// announce
const announce = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Make announcement');

announce.addStringOption(option =>
  option
    .setName('message')
    .setDescription('Message to send')
    .setRequired(true)
);

commands.push(announce);

// Convert commands
const commandData = commands.map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandData }
    );
    console.log('⚡ Commands registered');
  } catch (err) {
    console.error(err);
  }
});

// ===== SLASH COMMAND HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply('Pong!');
  }

  if (interaction.commandName === 'help') {
    return interaction.reply('/ping\n/help\n/announce');
  }

  if (interaction.commandName === 'announce') {

    // ✅ Only allowed users
    const allowedUsers = [
      '1420063137838923868',
      '1378368132376297514',
      '1335285604476522529'
    ];

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Not allowed', ephemeral: true });
    }

    const msg = interaction.options.getString('message');

    // ✅ Reply first (fixes "not responding")
    await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });

    // ✅ Send message
    if (interaction.channel) {
      await interaction.channel.send(msg);
    }
  }
});

// ===== GREETINGS =====
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const greetings = ['hi', 'hello', 'hey'];
  const words = message.content.toLowerCase().split(/\s+/);

  if (words.some(w => greetings.includes(w))) {
    message.channel.send('Hi 👋 Welcome to CRP');
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_BOT_TOKEN);
