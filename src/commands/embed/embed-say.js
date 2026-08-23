const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-say')
    .setDescription('Quickly send a rich embed message')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('description')
        .setDescription('The content / description of the embed')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Title for the embed')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Hex color code (e.g. #5865F2, #57F287, #ED4245)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send embed to (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image_url')
        .setDescription('Optional image URL')
        .setRequired(false)
    ),

  async execute(interaction) {
    const description = interaction.options.getString('description');
    const title = interaction.options.getString('title');
    let color = interaction.options.getString('color') || config.defaultColor;
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const imageUrl = interaction.options.getString('image_url');

    if (!color.startsWith('#')) color = `#${color}`;
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(color)) color = config.defaultColor;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description)
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (imageUrl) {
      try {
        embed.setImage(imageUrl);
      } catch (e) {}
    }

    try {
      await targetChannel.send({ embeds: [embed] });
      await interaction.reply({
        content: `${config.emojis.success} Embed message sent to ${targetChannel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[EMBED-SAY ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send embed: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
