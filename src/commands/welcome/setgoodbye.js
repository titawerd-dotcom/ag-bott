const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setgoodbye')
    .setDescription('Configure goodbye messages when members leave')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel where goodbye messages will be sent')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable or disable goodbye system')
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
        .setDescription('Embed Hex Color (e.g., #ED4245)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const enabled = interaction.options.getBoolean('enabled');
    const useEmbed = interaction.options.getBoolean('use_embed') ?? true;
    const message = interaction.options.getString('message');
    const color = interaction.options.getString('color');

    const updateData = {
      enabled: enabled,
      channelId: channel.id,
      isEmbed: useEmbed
    };

    if (message) updateData.message = message;
    if (color) updateData.color = color;

    db.updateGuildConfig(interaction.guild.id, 'goodbye', updateData);

    const embed = new EmbedBuilder()
      .setColor(config.successColor)
      .setTitle(`${config.emojis.goodbye} Goodbye System Updated`)
      .setDescription(`Goodbye settings for **${interaction.guild.name}** have been saved!`)
      .addFields(
        { name: '📢 Channel', value: `${channel}`, inline: true },
        { name: '🔘 Status', value: enabled ? '`Enabled`' : '`Disabled`', inline: true },
        { name: '🎨 Format', value: useEmbed ? '`Rich Embed`' : '`Plain Text`', inline: true },
        { name: '📝 Message Template', value: `\`\`\`${updateData.message || db.getGuildConfig(interaction.guild.id).goodbye.message}\`\`\``, inline: false }
      )
      .setFooter({ text: 'Use /testgoodbye to preview your goodbye message' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
