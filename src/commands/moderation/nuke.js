const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nuke/Re-create the current channel to completely purge all messages and history')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.channel;
    const position = channel.position;
    const topic = channel.topic;

    try {
      await interaction.reply({
        content: '💣 Nuking channel in 3 seconds...',
        ephemeral: true
      });

      const newChannel = await channel.clone({
        name: channel.name,
        permissions: channel.permissionOverwrites.cache,
        topic: topic,
        position: position,
        reason: `Channel nuked by ${interaction.user.tag}`
      });

      await channel.delete(`Nuked by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle('💥 Channel Nuked!')
        .setDescription(`This channel was completely nuked and recreated by ${interaction.user}.`)
        .setImage('https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif')
        .setTimestamp();

      await newChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[NUKE ERROR]', err);
      await interaction.followUp({
        content: `${config.emojis.error} Failed to nuke channel: ${err.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};
