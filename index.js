// index.js
const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Keep web server alive
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// Define slash commands
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('help').setDescription('Shows all commands'),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Make an announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to announce')
        .setRequired(true))
].map(command => command.toJSON());

// Deploy slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('⚡ Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
});

// Handle interactions (slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  } else if (commandName === 'help') {
    await interaction.reply('📜 Commands:\n/ping\n/help\n/announce <message>');
  } else if (commandName === 'announce') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: '❌ You need Manage Messages permission', ephemeral: true });
    }

    const msg = interaction.options.getString('message');

    // Send announcement as a normal message (hides your username)
    await interaction.channel.send(msg);

    // Ephemeral reply so Discord does not show "You used /announce"
    await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });
  }
});

// Greetings for normal messages (no username)
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const greetings = ['hi', 'hello', 'hey'];
  const words = message.content.toLowerCase().split(/\s+/);
  if (words.some(word => greetings.includes(word))) {
    message.channel.send('Hi 👋 Welcome to CRP');
  }
});

// Login using environment variable
client.login(process.env.DISCORD_BOT_TOKEN);
