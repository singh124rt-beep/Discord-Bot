const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 🔧 REGISTER COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help menu'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot response'),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to announce')
        .setRequired(true)
    ),
].map(cmd => cmd.toJSON());

client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error(err);
  }
});

// 🎯 COMMAND HANDLER
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'help') {
    await interaction.reply(
      '**Commands:**\n' +
      '/help - show commands\n' +
      '/ping - test bot\n' +
      '/announce - send announcement'
    );
  }

  if (interaction.commandName === 'announce') {
    const msg = interaction.options.getString('message');

    // ✅ NO EMOJI HERE
    await interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
