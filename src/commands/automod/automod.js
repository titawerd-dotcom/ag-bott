const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automated protection (Anti-Link, Anti-Spam, Bad Words, etc.)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(opt =>
      opt.setName('enabled')
        .setDescription('Enable or disable AutoMod protection')
        .setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName('anti_invite')
        .setDescription('Block other Discord server invite links')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('anti_links')
        .setDescription('Block all external http/https web links')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('anti_spam')
        .setDescription('Block mass mentions of users/roles')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('anti_caps')
        .setDescription('Block messages with excessive capital letters')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('punishment')
        .setDescription('Punishment for violators')
        .addChoices(
          { name: 'Delete Message Only', value: 'delete' },
          { name: 'Delete & Warn User', value: 'warn' },
          { name: 'Delete & 5-Min Timeout', value: 'timeout' }
        )
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt.setName('log_channel')
        .setDescription('Channel to send AutoMod violation logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const enabled = interaction.options.getBoolean('enabled');
    const antiInvite = interaction.options.getBoolean('anti_invite');
    const antiLinks = interaction.options.getBoolean('anti_links');
    const antiSpam = interaction.options.getBoolean('anti_spam');
    const antiCaps = interaction.options.getBoolean('anti_caps');
    const punishment = interaction.options.getString('punishment');
    const logChannel = interaction.options.getChannel('log_channel');

    const currentConfig = db.getGuildConfig(interaction.guild.id).automod || {};

    const updateData = {
      enabled: enabled,
      antiInvite: antiInvite !== null ? antiInvite : currentConfig.antiInvite,
      antiLinks: antiLinks !== null ? antiLinks : currentConfig.antiLinks,
      antiSpam: antiSpam !== null ? antiSpam : currentConfig.antiSpam,
      antiCaps: antiCaps !== null ? antiCaps : currentConfig.antiCaps,
      punishment: punishment || currentConfig.punishment || 'delete',
      logChannelId: logChannel ? logChannel.id : currentConfig.logChannelId
    };

    db.updateGuildConfig(interaction.guild.id, 'automod', updateData);

    const embed = new EmbedBuilder()
      .setColor(enabled ? config.successColor : config.errorColor)
      .setTitle('🛡️ AutoMod Configuration Updated')
      .setDescription(`Automated moderation settings for **${interaction.guild.name}** have been saved.`)
      .addFields(
        { name: '🔘 Master Status', value: enabled ? '`Enabled`' : '`Disabled`', inline: true },
        { name: '🔗 Anti-Invite Links', value: updateData.antiInvite ? '`ON`' : '`OFF`', inline: true },
        { name: '🌐 Anti-All Links', value: updateData.antiLinks ? '`ON`' : '`OFF`', inline: true },
        { name: '📢 Anti-Mass Mentions', value: updateData.antiSpam ? '`ON`' : '`OFF`', inline: true },
        { name: '🔠 Anti-Caps', value: updateData.antiCaps ? '`ON`' : '`OFF`', inline: true },
        { name: '⚖️ Action / Punishment', value: `\`${updateData.punishment.toUpperCase()}\``, inline: true },
        { name: '📑 Log Channel', value: updateData.logChannelId ? `<#${updateData.logChannelId}>` : '`None`', inline: false }
      )
      .setFooter({ text: 'You can also manage AutoMod filters and blacklist words in the Web Dashboard!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
