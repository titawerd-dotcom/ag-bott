const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for kicking')
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

    if (!member.kickable) {
      return interaction.reply({
        content: `${config.emojis.error} I cannot kick this user! They may have a higher role than me or are the server owner.`,
        ephemeral: true
      });
    }

    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot kick this member because their role is equal to or higher than yours!`,
        ephemeral: true
      });
    }

    try {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(config.warningColor)
          .setTitle(`👢 You have been kicked from ${interaction.guild.name}`)
          .addFields(
            { name: 'Reason', value: reason },
            { name: 'Moderator', value: interaction.user.tag }
          )
          .setTimestamp();
        await targetUser.send({ embeds: [dmEmbed] });
      } catch (e) {}

      await member.kick(`${interaction.user.tag}: ${reason}`);

      const kickEmbed = new EmbedBuilder()
        .setColor(config.warningColor)
        .setTitle(`${config.emojis.shield} Member Kicked`)
        .setDescription(`Successfully kicked **${targetUser.tag}** from the server.`)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setFooter({ text: `ID: ${targetUser.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [kickEmbed] });
    } catch (err) {
      console.error('[KICK ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to kick user: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
