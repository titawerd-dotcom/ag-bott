const { Events, ChannelType } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

function getChannelTypeName(type) {
  switch (type) {
    case ChannelType.GuildText: return 'Text Channel';
    case ChannelType.GuildVoice: return 'Voice Channel';
    case ChannelType.GuildCategory: return 'Category';
    case ChannelType.GuildAnnouncement: return 'Announcement Channel';
    default: return 'Channel';
  }
}

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;

    const typeName = getChannelTypeName(channel.type);

    const fields = [
      { name: '💬 Channel Name', value: `\`#${channel.name}\``, inline: true },
      { name: '🆔 Channel ID', value: `\`${channel.id}\``, inline: true },
      { name: '🏷️ Type', value: `\`${typeName}\``, inline: true }
    ];

    await sendGuildLog(channel.guild, 'channelDelete', {
      title: '🗑️ Channel Deleted',
      description: `**${typeName}** \`#${channel.name}\` was deleted.`,
      color: config.errorColor || '#ED4245',
      fields,
      channel: { id: channel.id, name: channel.name },
      details: { type: typeName }
    });
  }
};
