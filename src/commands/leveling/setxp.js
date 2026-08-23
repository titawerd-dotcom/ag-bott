const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Set or modify a user\'s XP and level')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
    .addIntegerOption(opt => opt.setName('xp').setDescription('XP Amount').setMinValue(0).setRequired(true))
    .addIntegerOption(opt => opt.setName('level').setDescription('Level (optional)').setMinValue(0).setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const xp = interaction.options.getInteger('xp');
    const level = interaction.options.getInteger('level');

    const updated = db.setUserXP(interaction.guild.id, targetUser.id, xp, level !== null ? level : undefined);

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle('✨ XP & Level Updated')
      .setDescription(`Successfully updated statistics for **${targetUser.tag}**.`)
      .addFields(
        { name: '👤 User', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
        { name: '🆙 Level', value: `\`Level ${updated.level}\``, inline: true },
        { name: '✨ Total XP', value: `\`${updated.xp} XP\``, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
