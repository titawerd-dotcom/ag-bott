const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to unlock (defaults to current channel)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for unlocking channel')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null // Reset to default/allow
      }, { reason: `${interaction.user.tag}: ${reason}` });

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.unlock} Channel Unlocked`)
        .setDescription(`Channel ${targetChannel} has been unlocked. Members can now send messages.`)
        .addFields(
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[UNLOCK ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to unlock channel: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
