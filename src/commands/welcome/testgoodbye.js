const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testgoodbye')
    .setDescription('Simulate and preview the goodbye message in the configured channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildConfig = db.getGuildConfig(interaction.guild.id);
    const goodbyeConfig = guildConfig.goodbye;

    if (!goodbyeConfig?.channelId) {
      return interaction.reply({
        content: `${config.emojis.error} Goodbye channel is not configured yet! Use \`/setgoodbye\` first.`,
        ephemeral: true
      });
    }

    const channel = interaction.guild.channels.cache.get(goodbyeConfig.channelId);
    if (!channel) {
      return interaction.reply({
        content: `${config.emojis.error} Configured goodbye channel was not found! Please reconfigure with \`/setgoodbye\`.`,
        ephemeral: true
      });
    }

    const rawMessage = goodbyeConfig.message || '{user} has left **{server}**. We now have {memberCount} members.';
    const formattedMessage = rawMessage
      .replace(/{user}/g, `**${interaction.user.tag}**`)
      .replace(/{userName}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild.name)
      .replace(/{memberCount}/g, interaction.guild.memberCount.toString());

    try {
      if (goodbyeConfig.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(goodbyeConfig.color || config.errorColor)
          .setTitle(`${config.emojis.goodbye} Goodbye! (TEST PREVIEW)`)
          .setDescription(formattedMessage)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 Member', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: '🔢 Remaining Members', value: `${interaction.guild.memberCount}`, inline: true }
          )
          .setFooter({ text: `Test preview executed by ${interaction.user.tag}` })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: `[TEST PREVIEW] ${formattedMessage}` });
      }

      await interaction.reply({
        content: `${config.emojis.success} Test goodbye message sent to ${channel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[TEST GOODBYE ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send test goodbye message: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
