const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Clear all warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user whose warnings will be cleared')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const existing = db.getWarns(interaction.guild.id, targetUser.id);

    if (existing.length === 0) {
      return interaction.reply({
        content: `${config.emojis.warning} **${targetUser.tag}** does not have any warnings to clear.`,
        ephemeral: true
      });
    }

    const count = existing.length;
    db.clearWarns(interaction.guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle(`${config.emojis.success} Warnings Cleared`)
      .setDescription(`Successfully cleared **${count}** warning(s) for **${targetUser.tag}**.`)
      .addFields(
        { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
