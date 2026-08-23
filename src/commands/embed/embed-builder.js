const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-builder')
    .setDescription('Open an interactive form modal to design and send a custom embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send the created embed to (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const modal = new ModalBuilder()
      .setCustomId(`embed_builder_modal_${targetChannel.id}`)
      .setTitle('🎨 Discord Embed Builder');

    const titleInput = new TextInputBuilder()
      .setCustomId('embed_title')
      .setLabel('Embed Title (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter your embed title...')
      .setRequired(false)
      .setMaxLength(256);

    const descInput = new TextInputBuilder()
      .setCustomId('embed_description')
      .setLabel('Embed Description / Content (Required)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the main body of your message here (Supports Markdown **bold**, *italic*, [links](url))...')
      .setRequired(true)
      .setMaxLength(4000);

    const colorInput = new TextInputBuilder()
      .setCustomId('embed_color')
      .setLabel('Hex Color Code (Optional, e.g. #5865F2)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('#5865F2')
      .setRequired(false)
      .setMaxLength(7);

    const imageInput = new TextInputBuilder()
      .setCustomId('embed_image')
      .setLabel('Image / Banner URL (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://example.com/banner.png')
      .setRequired(false);

    const footerInput = new TextInputBuilder()
      .setCustomId('embed_footer')
      .setLabel('Footer Text (Optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Custom footer notes...')
      .setRequired(false)
      .setMaxLength(2048);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(footerInput)
    );

    await interaction.showModal(modal);
  }
};
