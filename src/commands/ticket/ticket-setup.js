const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Create and send the interactive ticket support panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel where the ticket creation panel will be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Category under which new ticket channels will be created')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('staff_role')
        .setDescription('Role that has permission to view and answer tickets')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Custom title for the ticket panel')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Custom description/instructions for the ticket panel')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('category');
    const staffRole = interaction.options.getRole('staff_role');
    const title = interaction.options.getString('title') || '📩 Support & Help Desk';
    const description = interaction.options.getString('description') ||
      'Need assistance, want to report an issue, or talk to our staff team?\n\n' +
      'Click the **Create Ticket** button below to open a private support room with our staff.';

    // Save ticket configuration
    db.updateGuildConfig(interaction.guild.id, 'ticket', {
      categoryId: category ? category.id : null,
      staffRoleId: staffRole ? staffRole.id : null
    });

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: '🔒 Private & Secure', value: 'Only you and server staff can view your ticket.', inline: true },
        { name: '⚡ Fast Support', value: 'A staff member will respond as soon as possible.', inline: true }
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }) || undefined)
      .setFooter({ text: `${interaction.guild.name} • Official Support System`, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_btn')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📩')
    );

    try {
      await channel.send({ embeds: [embed], components: [row] });

      const replyEmbed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.success} Ticket Panel Created`)
        .setDescription(`The ticket panel has been successfully posted to ${channel}!`)
        .addFields(
          { name: '📁 Category', value: category ? `${category.name}` : '`None (Root)`', inline: true },
          { name: '🛡️ Staff Role', value: staffRole ? `${staffRole}` : '`Administrator Only`', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    } catch (err) {
      console.error('[TICKET SETUP ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send ticket panel: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
