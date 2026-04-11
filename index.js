const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

// ✅ EXPRESS WEB SERVER TO KEEP BOT ALIVE
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(3000, () => console.log('🌐 Web server running'));

// ✅ DISCORD BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // --------------------
  // .ping command
  // --------------------
  if (content === '.ping') {
    return message.reply('Pong!');
  }

  // --------------------
  // .help command
  // --------------------
  if (content === '.help') {
    return message.reply(`📜 Commands:
.ping
.help
.announce <message>
.kick @user <reason>
.ban @user <reason>
.warn @user <reason>`);
  }

  // --------------------
  // .announce command
  // --------------------
  if (content.startsWith('.announce ')) {
    const msg = message.content.slice(10).trim();
    if (!msg) return message.reply('❌ Please provide a message');

    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You need Manage Messages permission');
    }

    try { await message.delete(); } catch {}
    return message.channel.send(`📢 ${msg}`);
  }

  // --------------------
  // .kick command
  // --------------------
  if (content.startsWith('.kick ')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return message.reply('❌ You need Kick Members permission');
    }

    const member = message.mentions.members.first();
    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason';
    if (!member) return message.reply('❌ Mention a user to kick');

    try {
      await member.kick(reason);
      return message.channel.send(`👢 ${member.user.tag} kicked | Reason: ${reason}`);
    } catch {
      return message.reply('❌ Cannot kick this user');
    }
  }

  // --------------------
  // .ban command
  // --------------------
  if (content.startsWith('.ban ')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply('❌ You need Ban Members permission');
    }

    const member = message.mentions.members.first();
    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason';
    if (!member) return message.reply('❌ Mention a user to ban');

    try {
      await member.ban({ reason });
      return message.channel.send(`🔨 ${member.user.tag} banned | Reason: ${reason}`);
    } catch {
      return message.reply('❌ Cannot ban this user');
    }
  }

  // --------------------
  // .warn command
  // --------------------
  if (content.startsWith('.warn ')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ You need Manage Messages permission');
    }

    const member = message.mentions.members.first();
    const reason = message.content.split(' ').slice(2).join(' ') || 'No reason';
    if (!member) return message.reply('❌ Mention a user to warn');

    return message.channel.send(`⚠️ ${member.user.tag} warned | Reason: ${reason}`);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
