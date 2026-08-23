const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and Discord API websocket heartbeat'),

  async execute(interaction, client) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 Bot Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '💓 API WebSocket', value: `\`${wsPing}ms\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
