const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1 - 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Only delete messages from a specific user')
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('target');

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });

      let filtered;
      if (targetUser) {
        filtered = messages.filter(m => m.author.id === targetUser.id);
      } else {
        filtered = messages;
      }

      if (filtered.size === 0) {
        return interaction.editReply({
          content: `${config.emojis.warning} No messages found to delete (messages older than 14 days cannot be bulk deleted by Discord).`
        });
      }

      const deleted = await interaction.channel.bulkDelete(filtered, true);

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.trash} Messages Purged`)
        .setDescription(`Successfully purged **${deleted.size}** message(s)${targetUser ? ` from **${targetUser.tag}**` : ''}.`)
        .setFooter({ text: 'Note: Messages older than 14 days cannot be bulk-deleted due to Discord limitations.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[PURGE ERROR]', err);
      await interaction.editReply({
        content: `${config.emojis.error} Failed to purge messages: ${err.message}`
      });
    }
  }
};
