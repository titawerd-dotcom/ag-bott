const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { formatVoiceTime, getActiveVoiceSession } = require('../../utils/voiceTracker');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userstats')
    .setDescription('View voice activity time, message counts, and server rankings for a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to view statistics for (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;
    const guildId = guild.id;

    const stats = db.getUserStats(guildId, targetUser.id);
    const activeSession = getActiveVoiceSession(guildId, targetUser.id);

    // Calculate effective voice seconds (cumulative + active session duration)
    let totalVoiceSec = stats.voiceSeconds || 0;
    let liveVoiceText = '🔇 Not in Voice';

    if (activeSession) {
      totalVoiceSec += activeSession.currentSessionSeconds || 0;
      const channel = guild.channels.cache.get(activeSession.channelId);
      const chanName = channel ? channel.name : 'Voice Channel';
      const liveDuration = formatVoiceTime(activeSession.currentSessionSeconds || 0);
      liveVoiceText = `🟢 In **#${chanName}** (active for ${liveDuration})`;
    }

    // Rankings
    const voiceLb = db.getVoiceLeaderboard(guildId, 99999);
    const voiceRankItem = voiceLb.find(item => item.userId === targetUser.id);
    const voiceRank = voiceRankItem ? `#${voiceRankItem.rank} of ${guild.memberCount}` : 'Unranked';

    const msgLb = db.getMessagesLeaderboard(guildId, 99999);
    const msgRankItem = msgLb.find(item => item.userId === targetUser.id);
    const msgRank = msgRankItem ? `#${msgRankItem.rank} of ${guild.memberCount}` : 'Unranked';

    // Rank Medal Emojis
    const getMedal = (rankStr) => {
      if (rankStr.startsWith('#1 of')) return '🥇';
      if (rankStr.startsWith('#2 of')) return '🥈';
      if (rankStr.startsWith('#3 of')) return '🥉';
      return '📊';
    };

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor || '#5865F2')
      .setAuthor({
        name: `${targetUser.username}'s Activity Statistics`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true, size: 256 })
      })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '🎙️ Voice Activity Time',
          value: `**${formatVoiceTime(totalVoiceSec)}**\n${getMedal(voiceRank)} Rank: \`${voiceRank}\``,
          inline: true
        },
        {
          name: '💬 Chat Messages',
          value: `**${(stats.messagesCount || 0).toLocaleString()} messages**\n${getMedal(msgRank)} Rank: \`${msgRank}\``,
          inline: true
        },
        {
          name: '📻 Voice Sessions',
          value: `\`${(stats.voiceSessions || 0).toLocaleString()} sessions\``,
          inline: true
        },
        {
          name: '📡 Current Voice Status',
          value: liveVoiceText,
          inline: false
        }
      )
      .setFooter({ text: `${guild.name} • Member Activity Tracker`, iconURL: guild.iconURL() || undefined })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
