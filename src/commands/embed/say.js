const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a plain text message through the bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The plain text message you want the bot to send')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Target channel (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await targetChannel.send({ content: message });
      await interaction.reply({
        content: `${config.emojis.success} Plain text message sent to ${targetChannel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[SAY ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send message: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
