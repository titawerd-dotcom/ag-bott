const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for banning')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('delete_messages_days')
        .setDescription('Days of messages to delete (0 to 7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_messages_days') || 0;

    const member = interaction.guild.members.cache.get(targetUser.id);

    // Hierarchy checks
    if (member) {
      if (!member.bannable) {
        return interaction.reply({
          content: `${config.emojis.error} I cannot ban this user! They may have a higher role than me or are the server owner.`,
          ephemeral: true
        });
      }

      if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({
          content: `${config.emojis.error} You cannot ban this member because their role is equal to or higher than yours!`,
          ephemeral: true
        });
      }
    }

    try {
      // Send DM to user first before banning
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(config.errorColor)
          .setTitle(`🔨 You have been banned from ${interaction.guild.name}`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: interaction.user.tag }
          )
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (e) {
        // User may have DMs closed
      }

      await interaction.guild.bans.create(targetUser.id, {
        reason: `${interaction.user.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86400
      });

      const banEmbed = new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle(`${config.emojis.shield} Member Banned`)
        .setDescription(`Successfully banned **${targetUser.tag}** from the server.`)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setFooter({ text: `ID: ${targetUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [banEmbed] });
    } catch (err) {
      console.error('[BAN ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to ban user: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
