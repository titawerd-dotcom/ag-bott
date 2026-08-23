const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log('================================================================');
    console.log(`🤖 Logged in successfully as: ${client.user.tag}`);
    console.log(`🌐 Active on ${client.guilds.cache.size} server(s)`);
    console.log(`👥 Serving ${client.users.cache.size} users`);
    console.log('⚡ All slash commands, tickets, welcome, & moderation modules are ready!');
    console.log('================================================================');

    client.user.setPresence({
      activities: [
        {
          name: '/help | Moderation & Tickets',
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });
  }
};
