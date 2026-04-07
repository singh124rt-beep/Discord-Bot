// 
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot Alive"));
app.listen(3000);


// 🔽 YOUR EXISTING BOT CODE BELOW
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
