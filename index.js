// index.js
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

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
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN
