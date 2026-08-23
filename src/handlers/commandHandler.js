const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = async (client) => {
  client.commands = new Map();
  client.commandCategories = new Map();
  const slashCommands = [];

  const commandsPath = path.join(__dirname, '../commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
    const categoryCommands = [];

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          slashCommands.push(command.data.toJSON());
          categoryCommands.push(command.data.name);
        } else {
          console.warn(`[COMMANDS] The command at ${filePath} is missing required "data" or "execute" property.`);
        }
      } catch (err) {
        console.error(`[COMMANDS] Error loading command ${filePath}:`, err);
      }
    }

    client.commandCategories.set(category, categoryCommands);
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.warn('[SLASH COMMANDS] DISCORD_TOKEN or CLIENT_ID is missing in .env. Skipping REST registration.');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`[SLASH COMMANDS] Refreshing ${slashCommands.length} application (/) commands...`);

    if (guildId && guildId.trim() !== '') {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: slashCommands }
      );
      console.log(`[SLASH COMMANDS] Successfully registered commands to Guild ID: ${guildId}`);
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: slashCommands }
      );
      console.log('[SLASH COMMANDS] Successfully registered commands globally across all servers.');
    }
  } catch (error) {
    console.error('[SLASH COMMANDS] Error registering application commands:', error);
  }
};
