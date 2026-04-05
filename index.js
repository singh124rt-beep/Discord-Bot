const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// check token exists
if (!process.env.TOKEN) {
  console.error("❌ TOKEN missing!");
  process.exit(1);
}

client.login(process.env.MTQ4OTkwOTI5MTY0ODU1Mjk3MQ.GJqakx.JPldV3GFEVew5hNhf_M_Y2QxGP-fmPxIza9o5E);
