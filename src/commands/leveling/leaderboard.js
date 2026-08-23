const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the top 10 most active members by XP on this server'),

  async execute(interaction) {
    const topUsers = db.getLeaderboard(interaction.guild.id, 10);

    if (topUsers.length === 0) {
      return interaction.reply({
        content: '📊 No XP data recorded yet on this server. Start chatting to gain XP!',
        ephemeral: true
      });
    }

    const leaderboardLines = topUsers.map((u, index) => {
      const emoji = rankEmojis[index] || `**#${index + 1}**`;
      return `${emoji} <@${u.userId}> — **Level ${u.level}** (\`${u.xp.toLocaleString()} XP\`)`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🏆 ${interaction.guild.name} • XP Leaderboard`)
      .setDescription(leaderboardLines.join('\n\n'))
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || undefined)
      .setFooter({ text: 'Gain XP by sending messages in active chat channels!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
