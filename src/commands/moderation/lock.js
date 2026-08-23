const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock the channel to prevent @everyone from sending messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to lock (defaults to current channel)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for locking channel')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      }, { reason: `${interaction.user.tag}: ${reason}` });

      const embed = new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle(`${config.emojis.lock} Channel Locked`)
        .setDescription(`Channel ${targetChannel} has been locked. Regular members cannot send messages.`)
        .addFields(
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[LOCK ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to lock channel: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
