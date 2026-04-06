// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const express = require("express"); // add Express
const app = express();

// Dummy web server to keep Render happy
app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Discord bot code
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
