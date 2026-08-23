const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode cooldown for the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Slowmode duration in seconds (0 to disable, max 21600 seconds / 6 hours)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for changing slowmode')
        .setRequired(false)
    ),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.channel.setRateLimitPerUser(seconds, `${interaction.user.tag}: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`⏱️ Channel Slowmode Updated`)
        .setDescription(
          seconds === 0
            ? `Slowmode has been **disabled** for ${interaction.channel}.`
            : `Slowmode for ${interaction.channel} has been set to **${seconds} second(s)** per message.`
        )
        .addFields(
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[SLOWMODE ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to set slowmode: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
