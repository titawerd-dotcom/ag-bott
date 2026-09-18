const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const authorTag = message.author ? message.author.tag : 'Unknown User';
    const authorId = message.author ? message.author.id : 'N/A';
    const content = message.content ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content) : '*(No text content or embed/attachment)*';
    const attachments = message.attachments ? message.attachments.map(a => a.url).join('\n') : '';

    const fields = [
      { name: '👤 Author', value: `<@${authorId}> (\`${authorTag}\`)`, inline: true },
      { name: '💬 Channel', value: `${message.channel} (\`#${message.channel.name}\`)`, inline: true },
      { name: '🆔 Message ID', value: `\`${message.id}\``, inline: true },
      { name: '📝 Message Content', value: `\`\`\`${content}\`\`\``, inline: false }
    ];

    if (attachments) {
      fields.push({ name: '📎 Attachments', value: attachments.slice(0, 1000), inline: false });
    }

    await sendGuildLog(message.guild, 'messageDelete', {
      title: '🗑️ Message Deleted',
      description: `A message sent by <@${authorId}> was deleted in ${message.channel}.`,
      color: config.errorColor || '#ED4245',
      fields,
      user: { id: authorId, tag: authorTag },
      channel: { id: message.channel.id, name: message.channel.name },
      details: { content, attachments }
    });
  }
};
