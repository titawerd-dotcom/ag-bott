const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a server member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Give a role to a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to give').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) {
      return interaction.reply({
        content: `${config.emojis.error} User is not in this server!`,
        ephemeral: true
      });
    }

    // Role hierarchy checks
    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `${config.emojis.error} I cannot manage the role **${role.name}** because it is equal to or higher than my highest role!`,
        ephemeral: true
      });
    }

    if (role.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot manage the role **${role.name}** because it is equal to or higher than your highest role!`,
        ephemeral: true
      });
    }

    try {
      if (subcommand === 'add') {
        if (member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `${config.emojis.warning} **${targetUser.tag}** already has the role ${role}!`,
            ephemeral: true
          });
        }
        await member.roles.add(role);
        const embed = new EmbedBuilder()
          .setColor(config.successColor)
          .setTitle(`${config.emojis.success} Role Added`)
          .setDescription(`Successfully added ${role} to **${targetUser.tag}**.`)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `${config.emojis.warning} **${targetUser.tag}** does not have the role ${role}!`,
            ephemeral: true
          });
        }
        await member.roles.remove(role);
        const embed = new EmbedBuilder()
          .setColor(config.warningColor)
          .setTitle(`${config.emojis.success} Role Removed`)
          .setDescription(`Successfully removed ${role} from **${targetUser.tag}**.`)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[ROLE ERROR]', err);
      return interaction.reply({
        content: `${config.emojis.error} Failed to manage role: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
