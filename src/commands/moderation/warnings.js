const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View the warning history of a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to check warnings for')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const warns = db.getWarns(interaction.guild.id, targetUser.id);

    if (warns.length === 0) {
      return interaction.reply({
        content: `${config.emojis.success} **${targetUser.tag}** has 0 warnings on this server.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`📋 Warnings for ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(`Total Warnings: **${warns.length}**\n\n` +
        warns.map((w, index) => {
          return `**#${index + 1}** [ID: \`${w.id}\`]\n• **Reason:** ${w.reason}\n• **Moderator:** <@${w.moderatorId}>\n• **Date:** <t:${Math.floor(w.timestamp / 1000)}:f>`;
        }).join('\n\n')
      )
      .setFooter({ text: `User ID: ${targetUser.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
