const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`🌐 Server running on ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// ===== COMMANDS =====
const commands = [];

const ping = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');
commands.push(ping);

const help = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show commands');
commands.push(help);

const announce = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Make announcement');

announce.addStringOption(function(option) {
  option.setName('message');
  option.setDescription('Message');
  option.setRequired(true);
  return option;
});

commands.push(announce);

// Convert to JSON
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

// ===== INTERACTIONS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply('Pong!');
  }

  if (interaction.commandName === 'help') {
    return interaction.reply('/ping\n/help\n/announce');
  }

  if (interaction.commandName === 'announce') {

    const allowedUsers = [
      '1420063137838923868',
      '1378368132376297514',
      '1335285604476522529'
    ];

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Not allowed', ephemeral: true });
    }

    const msg = interaction.options.getString('message');

    await interaction.reply({ content: '✅ Sent!', ephemeral: true });
    await interaction.channel.send(msg);
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
