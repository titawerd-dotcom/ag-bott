const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages, channel) {
    if (!channel.guild) return;

    const count = messages.size;
    const fields = [
      { name: '💬 Channel', value: `${channel} (\`#${channel.name}\`)`, inline: true },
      { name: '🔢 Messages Count', value: `\`${count} messages\``, inline: true }
    ];

    await sendGuildLog(channel.guild, 'messageDeleteBulk', {
      title: '🗑️ Bulk Messages Purged',
      description: `**${count}** messages were purged/deleted in bulk from ${channel}.`,
      color: config.errorColor || '#ED4245',
      fields,
      channel: { id: channel.id, name: channel.name },
      details: { count }
    });
  }
};
