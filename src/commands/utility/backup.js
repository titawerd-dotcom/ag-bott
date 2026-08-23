const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Create and manage server structure backups (channels, roles, categories)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new backup of server channels, categories and roles')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all saved backups for this server')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View details of a specific backup')
        .addStringOption(opt => opt.setName('backup_id').setDescription('Backup ID').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'create') {
      await interaction.deferReply();

      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => ({ name: r.name, color: r.hexColor, permissions: r.permissions.bitfield.toString() }));

      const channels = guild.channels.cache.map(c => ({
        name: c.name,
        type: c.type,
        parent: c.parent ? c.parent.name : null
      }));

      const backupId = `bk_${Date.now().toString(36)}`;
      const backupData = {
        name: guild.name,
        guildId: guild.id,
        createdAt: Date.now(),
        rolesCount: roles.length,
        channelsCount: channels.length,
        roles: roles,
        channels: channels
      };

      db.saveBackup(guild.id, backupId, backupData);

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle('💾 Server Backup Created')
        .setDescription(`Successfully created a snapshot backup of **${guild.name}**.`)
        .addFields(
          { name: '🆔 Backup ID', value: `\`${backupId}\``, inline: true },
          { name: '🎭 Roles Backed Up', value: `\`${roles.length}\``, inline: true },
          { name: '📁 Channels Backed Up', value: `\`${channels.length}\``, inline: true }
        )
        .setFooter({ text: 'Backups are safely stored in local database.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'list') {
      const all = db.getAllBackups(guild.id);
      const entries = Object.entries(all);

      if (entries.length === 0) {
        return interaction.reply({
          content: '📂 No backups found for this server. Use `/backup create` to make one!',
          ephemeral: true
        });
      }

      const listStr = entries.map(([id, b]) => {
        return `• **ID:** \`${id}\` — **${b.channelsCount}** channels, **${b.rolesCount}** roles (<t:${Math.floor(b.createdAt / 1000)}:R>)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`📂 Server Backups [${entries.length}]`)
        .setDescription(listStr)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'info') {
      const backupId = interaction.options.getString('backup_id');
      const b = db.getBackup(guild.id, backupId);

      if (!b) {
        return interaction.reply({
          content: `${config.emojis.error} Backup \`${backupId}\` not found!`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`💾 Backup Info: \`${backupId}\``)
        .addFields(
          { name: '🌐 Server Name', value: b.name, inline: true },
          { name: '📅 Date Created', value: `<t:${Math.floor(b.createdAt / 1000)}:F>`, inline: true },
          { name: '📁 Channels', value: `\`${b.channelsCount || b.channels?.length || 0}\``, inline: true },
          { name: '🎭 Roles', value: `\`${b.rolesCount || b.roles?.length || 0}\``, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
