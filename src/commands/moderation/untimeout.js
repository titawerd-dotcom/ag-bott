const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to remove timeout from')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for removing timeout')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) {
      return interaction.reply({
        content: `${config.emojis.error} That user is not in this server!`,
        ephemeral: true
      });
    }

    if (!member.isCommunicationDisabled()) {
      return interaction.reply({
        content: `${config.emojis.warning} This member does not have an active timeout!`,
        ephemeral: true
      });
    }

    try {
      await member.timeout(null, `${interaction.user.tag}: ${reason}`);

      const untimeoutEmbed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.success} Timeout Removed`)
        .setDescription(`Successfully removed timeout from **${targetUser.tag}**.`)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [untimeoutEmbed] });
    } catch (err) {
      console.error('[UNTIMEOUT ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to remove timeout: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
