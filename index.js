const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Web server
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
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Pong'),
  new SlashCommandBuilder().setName('help').setDescription('Show commands'),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Make announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('⚡ Commands registered');
  } catch (err) {
    console.error(err);
  }
});

// ===== COMMAND HANDLER =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

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

    // Reply first (prevents timeout)
    await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });

    if (interaction.channel) {
      await interaction.channel.send(msg);
    }
  }
});

// ===== GREETINGS =====
client.on('messageCreate', message => {
  if (message.author.bot) return;

  const greetings = ['hi', 'hello', 'hey'];
  const msg = message.content.toLowerCase();

  if (greetings.includes(msg)) {
    message.channel.send('Hi 👋 Welcome to CRP');
  }
});

// ===== LOGIN WITH ERROR DEBUG =====
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log("🔥 Bot login success"))
  .catch(err => console.error("❌ Login error:", err));
