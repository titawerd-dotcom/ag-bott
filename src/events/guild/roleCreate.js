const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    const guild = role.guild;

    const fields = [
      { name: '🎭 Role', value: `${role} (\`${role.name}\`)`, inline: true },
      { name: '🆔 Role ID', value: `\`${role.id}\``, inline: true },
      { name: '🎨 Color', value: `\`${role.hexColor}\``, inline: true },
      { name: '📌 Hoisted / Display Separately', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: '📢 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true }
    ];

    await sendGuildLog(guild, 'roleCreate', {
      title: '🎭 Role Created',
      description: `New role ${role} (\`${role.name}\`) was created.`,
      color: role.color || config.successColor || '#57F287',
      fields,
      details: { roleName: role.name, color: role.hexColor }
    });
  }
};
