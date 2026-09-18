const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embed loads/reactions

    const authorTag = newMessage.author ? newMessage.author.tag : 'Unknown User';
    const authorId = newMessage.author ? newMessage.author.id : 'N/A';
    const oldContent = oldMessage.content ? (oldMessage.content.length > 900 ? oldMessage.content.slice(0, 900) + '...' : oldMessage.content) : '*(Original content not cached)*';
    const newContent = newMessage.content ? (newMessage.content.length > 900 ? newMessage.content.slice(0, 900) + '...' : newMessage.content) : '*(No text content)*';

    const fields = [
      { name: '👤 Author', value: `<@${authorId}> (\`${authorTag}\`)`, inline: true },
      { name: '💬 Channel', value: `${newMessage.channel} (\`#${newMessage.channel.name}\`)`, inline: true },
      { name: '🔗 Jump Link', value: `[Go to Message](${newMessage.url})`, inline: true },
      { name: '🔴 Before (Original)', value: `\`\`\`${oldContent}\`\`\``, inline: false },
      { name: '🟢 After (Edited)', value: `\`\`\`${newContent}\`\`\``, inline: false }
    ];

    await sendGuildLog(newMessage.guild, 'messageUpdate', {
      title: '✏️ Message Edited',
      description: `A message by <@${authorId}> was edited in ${newMessage.channel}.`,
      color: config.warningColor || '#FEE75C',
      fields,
      user: { id: authorId, tag: authorTag },
      channel: { id: newMessage.channel.id, name: newMessage.channel.name },
      details: { before: oldContent, after: newContent, url: newMessage.url }
    });
  }
};
