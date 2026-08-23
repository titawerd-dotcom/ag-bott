const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an official announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Announcement channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Announcement Title')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Announcement Content')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('ping')
        .setDescription('Mention audience')
        .addChoices(
          { name: '@everyone', value: '@everyone' },
          { name: '@here', value: '@here' },
          { name: 'No Ping', value: 'none' }
        )
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image_url')
        .setDescription('Banner image URL')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const ping = interaction.options.getString('ping') || 'none';
    const imageUrl = interaction.options.getString('image_url');

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setAuthor({
        name: interaction.guild.name,
        iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
      })
      .setFooter({
        text: `Announced by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    if (imageUrl) {
      try {
        embed.setImage(imageUrl);
      } catch (e) {}
    }

    try {
      let content = undefined;
      if (ping === '@everyone') content = '@everyone';
      if (ping === '@here') content = '@here';

      await channel.send({ content, embeds: [embed] });

      await interaction.reply({
        content: `${config.emojis.success} Announcement published to ${channel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[ANNOUNCE ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send announcement: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
