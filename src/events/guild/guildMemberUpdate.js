const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    const guild = newMember.guild;
    const userTag = newMember.user.tag;
    const userId = newMember.user.id;

    // 1. Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const oldNick = oldMember.nickname || oldMember.user.username;
      const newNick = newMember.nickname || newMember.user.username;

      await sendGuildLog(guild, 'memberUpdate', {
        title: '✏️ Member Nickname Changed',
        description: `Nickname of <@${userId}> was changed.`,
        color: config.defaultColor || '#5865F2',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '🔴 Old Nickname', value: `\`${oldNick}\``, inline: true },
          { name: '🟢 New Nickname', value: `\`${newNick}\``, inline: true }
        ],
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        details: { oldNick, newNick }
      });
    }

    // 2. Roles added or removed
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0) {
      const roleList = addedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join(', ');
      await sendGuildLog(guild, 'memberUpdate', {
        title: '🎭 Member Roles Assigned',
        description: `Roles added to <@${userId}>: ${roleList}`,
        color: config.successColor || '#57F287',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '➕ Added Roles', value: roleList, inline: false }
        ],
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        details: { addedRoles: addedRoles.map(r => r.name) }
      });
    }

    if (removedRoles.size > 0) {
      const roleList = removedRoles.map(r => `<@&${r.id}> (\`${r.name}\`)`).join(', ');
      await sendGuildLog(guild, 'memberUpdate', {
        title: '🎭 Member Roles Removed',
        description: `Roles removed from <@${userId}>: ${roleList}`,
        color: config.warningColor || '#FEE75C',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '➖ Removed Roles', value: roleList, inline: false }
        ],
        thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        details: { removedRoles: removedRoles.map(r => r.name) }
      });
    }

    // 3. Timeout status change
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    const now = Date.now();

    if (oldTimeout !== newTimeout) {
      if (newTimeout && newTimeout > now) {
        // Timeout applied
        await sendGuildLog(guild, 'memberUpdate', {
          title: '⏱️ Member Timed Out',
          description: `<@${userId}> has been put in timeout until <t:${Math.floor(newTimeout / 1000)}:R>.`,
          color: config.errorColor || '#ED4245',
          fields: [
            { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
            { name: '⏳ Timeout Expiration', value: `<t:${Math.floor(newTimeout / 1000)}:F> (<t:${Math.floor(newTimeout / 1000)}:R>)`, inline: false }
          ],
          thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
          user: { id: userId, tag: userTag },
          details: { timeoutUntil: newTimeout }
        });
      } else if (oldTimeout && (!newTimeout || newTimeout <= now)) {
        // Timeout removed
        await sendGuildLog(guild, 'memberUpdate', {
          title: '⏱️ Member Timeout Removed',
          description: `The timeout on <@${userId}> has ended or was removed.`,
          color: config.successColor || '#57F287',
          fields: [
            { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true }
          ],
          thumbnail: newMember.user.displayAvatarURL({ dynamic: true, size: 256 }),
          user: { id: userId, tag: userTag }
        });
      }
    }
  }
};
