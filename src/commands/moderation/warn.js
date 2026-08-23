const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for warning')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (targetUser.bot) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot warn bots!`,
        ephemeral: true
      });
    }

    const member = interaction.guild.members.cache.get(targetUser.id);
    if (member && interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot warn a member with equal or higher role!`,
        ephemeral: true
      });
    }

    // Save warning to DB
    const warnEntry = db.addWarn(interaction.guild.id, targetUser.id, interaction.user.id, reason);
    const allWarns = db.getWarns(interaction.guild.id, targetUser.id);

    // Send DM to user
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(config.warningColor)
        .setTitle(`⚠️ Warning from ${interaction.guild.name}`)
        .setDescription(`You have received an official warning on **${interaction.guild.name}**.`)
        .addFields(
          { name: '📝 Reason', value: reason },
          { name: '🛡️ Moderator', value: interaction.user.tag },
          { name: '🔢 Total Warnings', value: `${allWarns.length}` }
        )
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] });
    } catch (e) {}

    const replyEmbed = new EmbedBuilder()
      .setColor(config.warningColor)
      .setTitle(`${config.emojis.warning} User Warned`)
      .setDescription(`Successfully warned **${targetUser.tag}**.`)
      .addFields(
        { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
        { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
        { name: '🔢 Total Warnings', value: `\`${allWarns.length}\``, inline: true },
        { name: '📝 Reason', value: reason, inline: false },
        { name: '🆔 Warning ID', value: `\`${warnEntry.id}\``, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [replyEmbed] });
  }
};
