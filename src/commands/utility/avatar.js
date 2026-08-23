const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display a member\'s avatar in high resolution')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target user (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    const pngUrl = user.displayAvatarURL({ extension: 'png', size: 2048 });
    const jpgUrl = user.displayAvatarURL({ extension: 'jpg', size: 2048 });
    const webpUrl = user.displayAvatarURL({ extension: 'webp', size: 2048 });
    const gifUrl = user.avatar?.startsWith('a_') ? user.displayAvatarURL({ extension: 'gif', size: 2048 }) : null;

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🖼️ Avatar of ${user.tag}`)
      .setImage(pngUrl)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('PNG').setStyle(ButtonStyle.Link).setURL(pngUrl),
      new ButtonBuilder().setLabel('JPG').setStyle(ButtonStyle.Link).setURL(jpgUrl),
      new ButtonBuilder().setLabel('WEBP').setStyle(ButtonStyle.Link).setURL(webpUrl)
    );

    if (gifUrl) {
      row.addComponents(
        new ButtonBuilder().setLabel('GIF').setStyle(ButtonStyle.Link).setURL(gifUrl)
      );
    }

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
