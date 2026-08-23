const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all bot features, systems, and slash commands'),

  async execute(interaction, client) {
    const totalCommands = client.commands.size;

    const mainEmbed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🤖 ${client.user.username} • Command Center`)
      .setDescription(
        `Welcome to the command dashboard! This bot is equipped with full-featured **Moderation**, **Ticket Management**, **Welcome & Goodbye System**, **Embed Builders & Plain Text Messaging**, and **Server Utilities**.\n\n` +
        `📊 **Bot Statistics:**\n` +
        `• Total Commands: \`${totalCommands}\`\n` +
        `• Servers: \`${client.guilds.cache.size}\`\n` +
        `• Discord.js: \`v14.18.0\`\n\n` +
        `👇 **Select a category from the dropdown menu below to view specific commands:**`
      )
      .addFields(
        { name: '🛡️ Moderation', value: '`/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/lock`, ...', inline: true },
        { name: '🎫 Ticket System', value: '`/ticket-setup`, `/ticket add/remove/close/claim`', inline: true },
        { name: '👋 Welcome / Goodbye', value: '`/setwelcome`, `/setgoodbye`, `/autorole`, ...', inline: true },
        { name: '🎨 Embeds & Text', value: '`/embed-builder`, `/say`, `/embed-say`, `/announce`', inline: true },
        { name: '⚙️ Utilities', value: '`/serverinfo`, `/userinfo`, `/avatar`, `/poll`, `/ping`', inline: true }
      )
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('📂 Choose a command category to browse...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Moderation System')
          .setDescription('Ban, kick, timeout, warn, lock, slowmode, purge, etc.')
          .setValue('moderation')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Ticket System')
          .setDescription('Interactive button tickets, permissions, claim & close')
          .setValue('tickets')
          .setEmoji('🎫'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Welcome & Goodbye')
          .setDescription('Greetings, autorole, plain text & embed templates')
          .setValue('welcome')
          .setEmoji('👋'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Embed Builder & Text')
          .setDescription('Modal embed builder, say plain text, announcements')
          .setValue('embed')
          .setEmoji('🎨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('General & Utility')
          .setDescription('Server & user info, avatar, polls, latency')
          .setValue('utility')
          .setEmoji('⚙️')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [mainEmbed], components: [row] });
  }
};
