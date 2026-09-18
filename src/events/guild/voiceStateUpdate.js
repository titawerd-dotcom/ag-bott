const { Events } = require('discord.js');
const { sendGuildLog } = require('../../utils/logger');
const { handleVoiceStateUpdate } = require('../../utils/voiceTracker');
const config = require('../../../config.json');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    // Track user voice activity duration
    try {
      await handleVoiceStateUpdate(oldState, newState);
    } catch (err) {
      console.error('[VOICE TRACKER ERROR]', err);
    }

    const guild = newState.guild || oldState.guild;
    const userTag = member.user.tag;
    const userId = member.user.id;

    // 1. Joined Voice Channel
    if (!oldState.channelId && newState.channelId) {
      const channel = newState.channel;
      await sendGuildLog(guild, 'voiceStateUpdate', {
        title: '🔊 Voice Channel Joined',
        description: `<@${userId}> connected to voice channel ${channel} (\`#${channel.name}\`).`,
        color: config.successColor || '#57F287',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '🔊 Channel', value: `${channel} (\`#${channel.name}\`)`, inline: true }
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        channel: { id: channel.id, name: channel.name },
        details: { action: 'JOIN' }
      });
      return;
    }

    // 2. Left Voice Channel
    if (oldState.channelId && !newState.channelId) {
      const channel = oldState.channel;
      await sendGuildLog(guild, 'voiceStateUpdate', {
        title: '🔇 Voice Channel Left',
        description: `<@${userId}> disconnected from voice channel \`#${channel?.name || 'Voice Channel'}\`.`,
        color: config.errorColor || '#ED4245',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '🔊 Channel', value: `\`#${channel?.name || 'Unknown'}\``, inline: true }
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        channel: channel ? { id: channel.id, name: channel.name } : null,
        details: { action: 'LEAVE' }
      });
      return;
    }

    // 3. Switched Voice Channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const oldChan = oldState.channel;
      const newChan = newState.channel;

      await sendGuildLog(guild, 'voiceStateUpdate', {
        title: '🔀 Switched Voice Channel',
        description: `<@${userId}> moved from \`#${oldChan?.name}\` to ${newChan}.`,
        color: config.warningColor || '#FEE75C',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '🔴 Previous Channel', value: `\`#${oldChan?.name || 'Unknown'}\``, inline: true },
          { name: '🟢 New Channel', value: `${newChan} (\`#${newChan.name}\`)`, inline: true }
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        channel: { id: newChan.id, name: newChan.name },
        details: { action: 'SWITCH', from: oldChan?.name, to: newChan.name }
      });
      return;
    }

    // 4. Server Mute / Deafen changes
    if (oldState.serverMute !== newState.serverMute) {
      const isMuted = newState.serverMute;
      await sendGuildLog(guild, 'voiceStateUpdate', {
        title: isMuted ? '🎙️ Server Voice Muted' : '🎙️ Server Voice Unmuted',
        description: `<@${userId}> was ${isMuted ? 'server muted' : 'server unmuted'} in ${newState.channel}.`,
        color: isMuted ? config.errorColor || '#ED4245' : config.successColor || '#57F287',
        fields: [
          { name: '👤 Member', value: `<@${userId}> (\`${userTag}\`)`, inline: true },
          { name: '🔊 Channel', value: `${newState.channel}`, inline: true }
        ],
        thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
        user: { id: userId, tag: userTag },
        details: { serverMute: isMuted }
      });
    }
  }
};
