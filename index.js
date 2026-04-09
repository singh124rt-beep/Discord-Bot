const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show help menu'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot'),
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send announcement')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Message to send')
        .setRequired(true)
    ),
].map(cmd => cmd.toJSON());

client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

    // ✅ REGISTER TO YOUR SERVER (INSTANT)
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, "1361179762294390826"),
      { body: commands }
    );

    console.log("✅ Slash commands registered instantly");
  } catch (err) {
    console.error(err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (interaction.commandName === 'help') {
    await interaction.reply('Use /ping, /announce, /help');
  }

  if (interaction.commandName === 'announce') {
    const msg = interaction.options.getString('message');
    await interaction.reply(msg); // no emoji
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
