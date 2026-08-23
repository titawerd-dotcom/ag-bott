const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Configure welcome messages for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel where welcome messages will be sent')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable or disable the welcome system')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('use_embed')
        .setDescription('Send as a Rich Embed (True) or Plain Text (False)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Custom message. Placeholders: {user}, {userName}, {server}, {memberCount}')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Embed Hex Color (e.g., #57F287 or #5865F2)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image_url')
        .setDescription('Direct image/banner URL to show at bottom of embed')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');
    const useEmbed = interaction.options.getBoolean('use_embed') ?? true;
    const message = interaction.options.getString('message');
    const color = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image_url');

    const updateData = {
      enabled: enabled,
      channelId: channel.id,
      isEmbed: useEmbed
    };

    if (message) updateData.message = message;
    if (color) updateData.color = color;
    if (imageUrl) updateData.image = imageUrl;

    db.updateGuildConfig(interaction.guild.id, 'welcome', updateData);

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle(`${config.emojis.welcome} Welcome System Updated`)
      .setDescription(`Welcome settings for **${interaction.guild.name}** have been saved successfully!`)
      .addFields(
        { name: '📢 Channel', value: `${channel}`, inline: true },
        { name: '🔘 Status', value: enabled ? '`Enabled`' : '`Disabled`', inline: true },
        { name: '🎨 Format', value: useEmbed ? '`Rich Embed`' : '`Plain Text`', inline: true },
        { name: '📝 Message Template', value: `\`\`\`${updateData.message || db.getGuildConfig(interaction.guild.id).welcome.message}\`\`\``, inline: false }
      )
      .setFooter({ text: 'Use /testwelcome to preview your welcome message' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
