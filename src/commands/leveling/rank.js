const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your current rank card, level, and XP statistics')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Target member (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const userData = db.getUserLevel(interaction.guild.id, targetUser.id);
    const leaderboard = db.getLeaderboard(interaction.guild.id, 100);

    const rankPos = leaderboard.findIndex(u => u.userId === targetUser.id) + 1;
    const rankStr = rankPos > 0 ? `#${rankPos}` : 'Unranked';

    const currentLevel = userData.level || 0;
    const currentXP = userData.xp || 0;

    // XP calculation
    const xpCurrentLevelBase = Math.pow(currentLevel / 0.1, 2);
    const xpNextLevelBase = Math.pow((currentLevel + 1) / 0.1, 2);
    const xpNeededForNext = Math.round(xpNextLevelBase - currentXP);
    const progressPct = Math.min(100, Math.max(0, Math.round(((currentXP - xpCurrentLevelBase) / (xpNextLevelBase - xpCurrentLevelBase)) * 100))) || 0;

    // Progress bar string: [████████░░]
    const barTotal = 15;
    const filledCount = Math.round((progressPct / 100) * barTotal);
    const progressBar = '█'.repeat(filledCount) + '░'.repeat(barTotal - filledCount);

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`⭐ Rank Card • ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🏆 Server Rank', value: `\`${rankStr}\``, inline: true },
        { name: '🆙 Level', value: `\`Level ${currentLevel}\``, inline: true },
        { name: '✨ Total XP', value: `\`${currentXP.toLocaleString()} XP\``, inline: true },
        { name: `📈 Progress (${progressPct}%)`, value: `\`[${progressBar}]\`\n*${xpNeededForNext.toLocaleString()} XP needed for Level ${currentLevel + 1}*`, inline: false }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
