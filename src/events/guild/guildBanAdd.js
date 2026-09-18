const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;

    const fields = [
      { name: '👤 Banned User', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
      { name: '📝 Reason', value: ban.reason || '*(No reason provided)*', inline: false }
    ];

    await sendGuildLog(guild, 'guildBanAdd', {
      title: '🔨 Member Banned',
      description: `User <@${user.id}> (\`${user.tag}\`) was banned from **${guild.name}**.`,
      color: config.errorColor || '#ED4245',
      fields,
      thumbnail: user.displayAvatarURL({ dynamic: true, size: 256 }),
      user: { id: user.id, tag: user.tag },
      details: { reason: ban.reason }
    });
  }
};
