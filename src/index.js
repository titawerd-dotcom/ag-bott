require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.User,
    Partials.Message,
    Partials.GuildMember,
    Partials.ThreadMember,
    Partials.Channel,
    Partials.Reaction
  ]
});

// Global error handling to prevent bot crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error('[UNCAUGHT EXCEPTION]', err, origin);
});

const { startDashboard } = require('./dashboard/server');

async function startBot() {
  const token = process.env.DISCORD_TOKEN;

  // Start Web Dashboard immediately
  startDashboard(client);

  if (!token || token === 'YOUR_BOT_TOKEN_HERE' || token.trim() === '') {
    console.error('================================================================');
    console.error('⚠️  DISCORD_TOKEN is missing or empty in your .env file!');
    console.error('👉 Please open .env file and paste your bot token.');
    console.error('================================================================');
    return;
  }

  // Load events
  eventHandler(client);

  // Load and register slash commands
  await commandHandler(client);

  // Login to Discord
  await client.login(token);
}

startBot().catch((err) => {
  console.error('[STARTUP ERROR]', err);
});
