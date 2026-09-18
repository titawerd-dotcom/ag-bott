const { Events, ChannelType } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

function getChannelTypeName(type) {
  switch (type) {
    case ChannelType.GuildText: return 'Text Channel';
    case ChannelType.GuildVoice: return 'Voice Channel';
    case ChannelType.GuildCategory: return 'Category';
    case ChannelType.GuildAnnouncement: return 'Announcement Channel';
    case ChannelType.GuildStageVoice: return 'Stage Voice Channel';
    case ChannelType.GuildForum: return 'Forum Channel';
    default: return 'Channel';
  }
}

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    if (!channel.guild) return;

    const typeName = getChannelTypeName(channel.type);
    const parentName = channel.parent ? channel.parent.name : 'None';

    const fields = [
      { name: '💬 Channel', value: `${channel} (\`#${channel.name}\`)`, inline: true },
      { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
      { name: '📁 Category', value: `\`${parentName}\``, inline: true },
      { name: '🏷️ Type', value: `\`${typeName}\``, inline: true }
    ];

    await sendGuildLog(channel.guild, 'channelCreate', {
      title: '📁 Channel Created',
      description: `New **${typeName}** ${channel} was created.`,
      color: config.successColor || '#57F287',
      fields,
      channel: { id: channel.id, name: channel.name },
      details: { type: typeName, parent: parentName }
    });
  }
};
