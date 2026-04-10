const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// ===== COMMANDS =====
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),

  new SlashCommandBuilder().setName('help').setDescription('Show commands'),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Make announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message')
        .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('⚡ Commands registered');
  } catch (err) {
    console.error(err);
  }
});

// ===== SLASH COMMANDS =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply('Pong!');
  }

  if (interaction.commandName === 'help') {
    return interaction.reply('/ping\n/help\n/announce');
  }

  if (interaction.commandName === 'announce') {

    // ✅ ONLY allowed users
    const allowedUsers = [
      '1420063137838923868', // YOU
      '1378368132376297514',
      '1335285604476522529'
    ];

    if (!allowedUsers.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Not allowed', ephemeral: true });
    }

    const msg = interaction.options.getString('message');

    // ✅ Reply FIRST (fixes "not responding")
    await interaction.reply({ content: '✅ Announcement sent!', ephemeral: true });

    // ✅ Then send message
    await interaction.channel.send(msg
