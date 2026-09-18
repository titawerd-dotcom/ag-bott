const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    const guild = role.guild;

    const fields = [
      { name: '🎭 Deleted Role', value: `\`@${role.name}\``, inline: true },
      { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true }
    ];

    await sendGuildLog(guild, 'roleDelete', {
      title: '🗑️ Role Deleted',
      description: `Role \`@${role.name}\` was removed from the server.`,
      color: config.errorColor || '#ED4245',
      fields,
      details: { roleName: role.name }
    });
  }
};
