const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { formatVoiceTime } = require('../../utils/voiceTracker');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Display server leaderboard for voice time activity or chat messages')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Choose leaderboard category')
        .setRequired(true)
        .addChoices(
          { name: '🎙️ Voice Activity (Hours & Time)', value: 'voice' },
          { name: '💬 Chat Messages Count', value: 'messages' }
        )
    ),

  async execute(interaction) {
    const category = interaction.options.getString('category');
    const guild = interaction.guild;
    const guildId = guild.id;

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

    if (category === 'voice') {
      const topVoice = db.getVoiceLeaderboard(guildId, 10);

      if (topVoice.length === 0) {
        return interaction.reply({
          content: '🎙️ No voice activity records found yet on this server. Join a voice channel to start tracking!',
          ephemeral: true
        });
      }

      let description = '';
      for (let i = 0; i < topVoice.length; i++) {
        const item = topVoice[i];
        const medal = medals[i] || `#${i + 1}`;
        const durationStr = formatVoiceTime(item.voiceSeconds);
        description += `${medal} <@${item.userId}> — **${durationStr}** \`(${item.voiceSessions || 0} sessions)\`\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle(`🎙️ Top Voice Activity Leaderboard — ${guild.name}`)
        .setDescription(description)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Tracking active voice channel duration in real-time' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } else {
      const topMsgs = db.getMessagesLeaderboard(guildId, 10);

      if (topMsgs.length === 0) {
        return interaction.reply({
          content: '💬 No message records recorded yet on this server.',
          ephemeral: true
        });
      }

      let description = '';
      for (let i = 0; i < topMsgs.length; i++) {
        const item = topMsgs[i];
        const medal = medals[i] || `#${i + 1}`;
        description += `${medal} <@${item.userId}> — **${item.messagesCount.toLocaleString()} messages**\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle(`💬 Top Chat Messages Leaderboard — ${guild.name}`)
        .setDescription(description)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Tracking total server chat messages' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
