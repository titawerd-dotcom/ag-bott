const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    const guild = newRole.guild;
    const changes = [];

    if (oldRole.name !== newRole.name) {
      changes.push({ name: '✏️ Name Changed', value: `\`${oldRole.name}\` ➔ \`${newRole.name}\``, inline: false });
    }

    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push({ name: '🎨 Color Changed', value: `\`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``, inline: true });
    }

    if (oldRole.hoist !== newRole.hoist) {
      changes.push({ name: '📌 Hoist Status', value: newRole.hoist ? 'Separated on Member List' : 'Not Separated', inline: true });
    }

    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push({ name: '📢 Mentionable Status', value: newRole.mentionable ? 'Anyone can mention' : 'Not mentionable', inline: true });
    }

    if (changes.length === 0) return;

    await sendGuildLog(guild, 'roleUpdate', {
      title: '⚙️ Role Modified',
      description: `Role ${newRole} (\`${newRole.name}\`) settings were updated.`,
      color: newRole.color || config.defaultColor || '#5865F2',
      fields: changes,
      details: { roleName: newRole.name }
    });
  }
};
