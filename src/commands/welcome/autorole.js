const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Automatically assign a role to new members when they join')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to automatically give to new members')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable or disable autorole')
        .setRequired(true)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const enabled = interaction.options.getBoolean('enabled');

    // Check bot role hierarchy
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `${config.emojis.error} I cannot assign the role **${role.name}** because it is equal to or higher than my highest role! Please drag my bot role above **${role.name}** in Server Settings -> Roles.`,
        ephemeral: true
      });
    }

    db.updateGuildConfig(interaction.guild.id, 'autorole', {
      enabled: enabled,
      roleId: role.id
    });

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle(`${config.emojis.tools} Autorole Configuration`)
      .setDescription(`Autorole settings have been updated.`)
      .addFields(
        { name: '🎭 Role', value: `${role}`, inline: true },
        { name: '🔘 Status', value: enabled ? '`Enabled`' : '`Disabled`', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
