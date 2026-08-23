const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their User ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('The ID of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for unbanning')
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const banList = await interaction.guild.bans.fetch();
      const bannedUser = banList.get(userId);

      if (!bannedUser) {
        return interaction.reply({
          content: `${config.emojis.error} User with ID \`${userId}\` is not banned on this server!`,
          ephemeral: true
        });
      }

      await interaction.guild.bans.remove(userId, `${interaction.user.tag}: ${reason}`);

      const unbanEmbed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.success} User Unbanned`)
        .setDescription(`Successfully unbanned **${bannedUser.user.tag}** from the server.`)
        .addFields(
          { name: '👤 User', value: `${bannedUser.user.tag} (\`${userId}\`)`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [unbanEmbed] });
    } catch (err) {
      console.error('[UNBAN ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to unban user: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
