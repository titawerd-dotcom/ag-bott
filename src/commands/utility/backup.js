const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
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
    )
    .addSubcommand(sub =>
      sub.setName('load')
        .setDescription('Restore channels, categories, and roles from a backup')
        .addStringOption(opt => opt.setName('backup_id').setDescription('The ID of the backup to restore').setRequired(true))
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

    if (subcommand === 'load') {
      const backupId = interaction.options.getString('backup_id');
      const b = db.getBackup(guild.id, backupId);

      if (!b) {
        return interaction.reply({
          content: `❌ Backup with ID \`${backupId}\` was not found in the database. Use \`/backup list\` to view available backups.`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      let restoredRolesCount = 0;
      let restoredCategoriesCount = 0;
      let restoredChannelsCount = 0;

      // 1. Recreate missing Roles
      if (b.roles && Array.isArray(b.roles)) {
        for (const roleData of b.roles) {
          try {
            const exists = guild.roles.cache.find(r => r.name.toLowerCase() === roleData.name.toLowerCase());
            if (!exists) {
              await guild.roles.create({
                name: roleData.name,
                color: roleData.color || '#99aab5',
                permissions: roleData.permissions ? BigInt(roleData.permissions) : undefined,
                reason: `[AG Backup Restore] Restoring from backup ${backupId}`
              });
              restoredRolesCount++;
            }
          } catch (e) {
            console.error(`[BACKUP RESTORE] Failed to create role ${roleData.name}:`, e.message);
          }
        }
      }

      // 2. Identify & Recreate Categories
      const categoryMap = new Map(); // Key: Category Name (lowercase), Value: Discord Category Channel Object
      guild.channels.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildCategory) {
          categoryMap.set(ch.name.toLowerCase(), ch);
        }
      });

      if (b.channels && Array.isArray(b.channels)) {
        // First pass: Create missing categories
        for (const chData of b.channels) {
          if (chData.type === ChannelType.GuildCategory || chData.type === 4) {
            const catNameKey = chData.name.toLowerCase();
            if (!categoryMap.has(catNameKey)) {
              try {
                const createdCat = await guild.channels.create({
                  name: chData.name,
                  type: ChannelType.GuildCategory,
                  reason: `[AG Backup Restore] Restoring category from ${backupId}`
                });
                categoryMap.set(catNameKey, createdCat);
                restoredCategoriesCount++;
              } catch (e) {
                console.error(`[BACKUP RESTORE] Failed to create category ${chData.name}:`, e.message);
              }
            }
          }
        }

        // Second pass: Create Text, Voice, Announcement Channels under their categories
        for (const chData of b.channels) {
          if (chData.type === ChannelType.GuildCategory || chData.type === 4) continue;

          try {
            const parentCat = chData.parent ? categoryMap.get(chData.parent.toLowerCase()) : null;
            const channelType = chData.type || ChannelType.GuildText;

            await guild.channels.create({
              name: chData.name,
              type: channelType,
              parent: parentCat ? parentCat.id : undefined,
              reason: `[AG Backup Restore] Restoring channel from ${backupId}`
            });
            restoredChannelsCount++;
          } catch (e) {
            console.error(`[BACKUP RESTORE] Failed to create channel ${chData.name}:`, e.message);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(config.successColor || '#57F287')
        .setTitle('✅ Server Backup Restored Successfully')
        .setDescription(`Restoration from backup \`${backupId}\` completed for **${guild.name}**.`)
        .addFields(
          { name: '📁 Restored Channels', value: `\`${restoredChannelsCount} channel(s)\``, inline: true },
          { name: '📂 Restored Categories', value: `\`${restoredCategoriesCount} category(s)\``, inline: true },
          { name: '🎭 Restored Roles', value: `\`${restoredRolesCount} role(s)\``, inline: true }
        )
        .setFooter({ text: 'All server structures and categories have been recreated.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
