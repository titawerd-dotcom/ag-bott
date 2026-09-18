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
    .setDescription('Create and deploy the interactive ticket support panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel where the ticket creation panel will be posted')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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
    )
    .addStringOption(option =>
      option.setName('banner')
        .setDescription('Banner image URL for the panel embed')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('thumbnail')
        .setDescription('Thumbnail image URL for the panel embed')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Hex color code (e.g. #5865F2)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('Custom footer text')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('button_label')
        .setDescription('Custom text on the Create Ticket button')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('button_emoji')
        .setDescription('Emoji for the button (e.g. 📩 or 🎫)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('button_style')
        .setDescription('Style/Color of the button')
        .addChoices(
          { name: 'Blurple / Primary', value: 'Primary' },
          { name: 'Green / Success', value: 'Success' },
          { name: 'Red / Danger', value: 'Danger' },
          { name: 'Gray / Secondary', value: 'Secondary' }
        )
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
    const banner = interaction.options.getString('banner') || null;
    const thumbnail = interaction.options.getString('thumbnail') || null;
    let color = interaction.options.getString('color') || config.defaultColor;
    if (!color.startsWith('#')) color = `#${color}`;
    if (!/^#[0-9A-F]{6}$/i.test(color)) color = config.defaultColor;

    const footer = interaction.options.getString('footer') || `${interaction.guild.name} • Official Support System`;
    const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
    const buttonEmoji = interaction.options.getString('button_emoji') || '📩';
    const buttonStyleName = interaction.options.getString('button_style') || 'Primary';

    const styleMap = {
      Primary: ButtonStyle.Primary,
      Success: ButtonStyle.Success,
      Danger: ButtonStyle.Danger,
      Secondary: ButtonStyle.Secondary
    };

    // Save ticket configuration
    const currentTicketConf = db.getGuildConfig(interaction.guild.id).ticket || {};
    db.updateGuildConfig(interaction.guild.id, 'ticket', {
      ...currentTicketConf,
      enabled: true,
      categoryId: category ? category.id : currentTicketConf.categoryId,
      staffRoleId: staffRole ? staffRole.id : currentTicketConf.staffRoleId,
      panel: {
        title,
        description,
        color,
        banner: banner || '',
        thumbnail: thumbnail || '',
        footer,
        buttonLabel,
        buttonStyle: buttonStyleName,
        buttonEmoji,
        channelId: channel.id
      }
    });

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: '🔒 Private & Secure', value: 'Only you and server staff can view your ticket.', inline: true },
        { name: '⚡ Fast Support', value: 'A staff member will respond as soon as possible.', inline: true }
      )
      .setFooter({ text: footer, iconURL: interaction.guild.iconURL() || undefined })
      .setTimestamp();

    if (thumbnail) {
      try { embed.setThumbnail(thumbnail); } catch (e) {}
    } else {
      embed.setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 256 }) || undefined);
    }

    if (banner) {
      try { embed.setImage(banner); } catch (e) {}
    }

    const btn = new ButtonBuilder()
      .setCustomId('create_ticket_btn')
      .setLabel(buttonLabel)
      .setStyle(styleMap[buttonStyleName] || ButtonStyle.Primary);

    if (buttonEmoji) {
      try { btn.setEmoji(buttonEmoji); } catch (e) {}
    }

    const row = new ActionRowBuilder().addComponents(btn);

    try {
      await channel.send({ embeds: [embed], components: [row] });

      const replyEmbed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.success} Ticket Panel Created`)
        .setDescription(`The ticket panel has been successfully posted to ${channel}!`)
        .addFields(
          { name: '📁 Category', value: category ? `${category.name}` : '`None (Root)`', inline: true },
          { name: '🛡️ Staff Role', value: staffRole ? `${staffRole}` : '`Administrator Only`', inline: true },
          { name: '🎨 Banner & Style', value: banner ? '`Custom Banner Active`' : '`Standard`', inline: true }
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
