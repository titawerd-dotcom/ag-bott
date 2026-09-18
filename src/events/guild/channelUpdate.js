const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;

    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push({ name: '✏️ Name Changed', value: `\`#${oldChannel.name}\` ➔ \`#${newChannel.name}\``, inline: false });
    }

    if (oldChannel.topic !== newChannel.topic) {
      changes.push({
        name: '📝 Topic Changed',
        value: `**Old:** ${oldChannel.topic || '*(None)*'}\n**New:** ${newChannel.topic || '*(None)*'}`,
        inline: false
      });
    }

    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push({
        name: '⏱️ Slowmode Changed',
        value: `\`${oldChannel.rateLimitPerUser || 0}s\` ➔ \`${newChannel.rateLimitPerUser || 0}s\``,
        inline: true
      });
    }

    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push({
        name: '🔞 NSFW Status',
        value: newChannel.nsfw ? 'Marked as NSFW' : 'NSFW Disabled',
        inline: true
      });
    }

    if (changes.length === 0) return;

    await sendGuildLog(newChannel.guild, 'channelUpdate', {
      title: '⚙️ Channel Updated',
      description: `Channel ${newChannel} (\`#${newChannel.name}\`) was modified.`,
      color: config.defaultColor || '#5865F2',
      fields: changes,
      channel: { id: newChannel.id, name: newChannel.name },
      details: { changesCount: changes.length }
    });
  }
};
