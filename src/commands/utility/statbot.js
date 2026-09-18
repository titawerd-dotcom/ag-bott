const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const config = require('../../../config.json');
const {
  getGuildStats,
  updateGuildStats,
  setupStatChannels,
  deleteStatChannels
} = require('../../utils/statbot');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statbot')
    .setDescription('Manage server statistics and dynamic counter channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Automatically create the StatBot category and voice counter channels')
    )
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Force refresh and sync all StatBot counter channel names now')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current server statistics and StatBot channel status')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete all StatBot counter channels and category')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await setupStatChannels(guild);
        const embed = new EmbedBuilder()
          .setColor(config.successColor || '#57F287')
          .setTitle('📊 StatBot Setup Complete')
          .setDescription(
            `Successfully created the **📊 SERVER STATS** category and counter channels!\n\n` +
            `• **Total Members:** \`${result.stats.totalMembers.toLocaleString()}\`\n` +
            `• **Humans:** \`${result.stats.humans.toLocaleString()}\`\n` +
            `• **Bots:** \`${result.stats.bots.toLocaleString()}\`\n` +
            `• **Online:** \`${result.stats.online.toLocaleString()}\`\n\n` +
            `*Channels will automatically update when members join, leave, or periodically every few minutes.*`
          )
          .setFooter({ text: `${guild.name} • StatBot System`, iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[STATBOT SETUP ERROR]', err);
        return interaction.editReply({
          content: `${config.emojis?.error || '❌'} Failed to setup StatBot channels: ${err.message}`
        });
      }
    }

    if (subcommand === 'update') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await updateGuildStats(guild, true);
        if (!result.success) {
          return interaction.editReply({
            content: `${config.emojis?.warning || '⚠️'} ${result.error || result.message || 'Could not update stats.'}`
          });
        }

        const embed = new EmbedBuilder()
          .setColor(config.successColor || '#57F287')
          .setTitle('🔄 StatBot Counters Synchronized')
          .setDescription(`All active StatBot channels have been forcefully updated!`)
          .addFields(
            { name: '👥 Total Members', value: `\`${result.stats.totalMembers.toLocaleString()}\``, inline: true },
            { name: '👤 Humans', value: `\`${result.stats.humans.toLocaleString()}\``, inline: true },
            { name: '🤖 Bots', value: `\`${result.stats.bots.toLocaleString()}\``, inline: true },
            { name: '🟢 Online', value: `\`${result.stats.online.toLocaleString()}\``, inline: true },
            { name: '🎙️ In Voice', value: `\`${result.stats.voice.toLocaleString()}\``, inline: true },
            { name: '🚀 Boosts', value: `\`${result.stats.boosts.toLocaleString()}\``, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `${config.emojis?.error || '❌'} Failed to update StatBot: ${err.message}`
        });
      }
    }

    if (subcommand === 'status') {
      const stats = await getGuildStats(guild);
      const conf = db.getStatBotConfig(guild.id);

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle(`📊 StatBot & Server Analytics — ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || undefined)
        .addFields(
          { name: '👥 Total Members', value: `\`${stats.totalMembers.toLocaleString()}\``, inline: true },
          { name: '👤 Humans', value: `\`${stats.humans.toLocaleString()}\``, inline: true },
          { name: '🤖 Bots', value: `\`${stats.bots.toLocaleString()}\``, inline: true },
          { name: '🟢 Online Members', value: `\`${stats.online.toLocaleString()}\``, inline: true },
          { name: '🎙️ In Voice Channels', value: `\`${stats.voice.toLocaleString()}\``, inline: true },
          { name: '🚀 Server Boosts', value: `\`${stats.boosts}\` (Tier ${stats.boostTier})`, inline: true },
          { name: '📁 Total Channels', value: `\`${stats.channels}\``, inline: true },
          { name: '🎭 Total Roles', value: `\`${stats.roles}\``, inline: true },
          { name: '⚙️ StatBot Status', value: conf?.enabled ? '`🟢 ACTIVE`' : '`🔴 DISABLED`', inline: true }
        )
        .setFooter({ text: 'StatBot System • Use Dashboard or /statbot for more settings' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      try {
        await deleteStatChannels(guild);
        const embed = new EmbedBuilder()
          .setColor(config.errorColor || '#ED4245')
          .setTitle('🗑️ StatBot Deleted')
          .setDescription('Successfully removed all StatBot counter channels and reset configuration.')
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `${config.emojis?.error || '❌'} Failed to delete StatBot channels: ${err.message}`
        });
      }
    }
  }
};
