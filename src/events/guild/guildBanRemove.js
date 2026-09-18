const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    const guild = ban.guild;
    const user = ban.user;

    const fields = [
      { name: '👤 Unbanned User', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true }
    ];

    await sendGuildLog(guild, 'guildBanRemove', {
      title: '🔓 Member Unbanned',
      description: `User <@${user.id}> (\`${user.tag}\`) was unbanned from **${guild.name}**.`,
      color: config.successColor || '#57F287',
      fields,
      thumbnail: user.displayAvatarURL({ dynamic: true, size: 256 }),
      user: { id: user.id, tag: user.tag }
    });
  }
};
