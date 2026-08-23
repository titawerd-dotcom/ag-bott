const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testwelcome')
    .setDescription('Simulate and preview the welcome message in the configured channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildConfig = db.getGuildConfig(interaction.guild.id);
    const welcomeConfig = guildConfig.welcome;

    if (!welcomeConfig?.channelId) {
      return interaction.reply({
        content: `${config.emojis.error} Welcome channel is not configured yet! Use \`/setwelcome\` first.`,
        ephemeral: true
      });
    }

    const channel = interaction.guild.channels.cache.get(welcomeConfig.channelId);
    if (!channel) {
      return interaction.reply({
        content: `${config.emojis.error} Configured welcome channel was not found! Please reconfigure with \`/setwelcome\`.`,
        ephemeral: true
      });
    }

    const rawMessage = welcomeConfig.message || 'Welcome {user} to **{server}**! You are member #{memberCount}.';
    const formattedMessage = rawMessage
      .replace(/{user}/g, `<@${interaction.user.id}>`)
      .replace(/{userName}/g, interaction.user.username)
      .replace(/{server}/g, interaction.guild.name)
      .replace(/{memberCount}/g, interaction.guild.memberCount.toString());

    try {
      if (welcomeConfig.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(welcomeConfig.color || config.successColor)
          .setTitle(`${config.emojis.welcome} Welcome to ${interaction.guild.name}! (TEST PREVIEW)`)
          .setDescription(formattedMessage)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 Member', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
            { name: '🔢 Member Count', value: `#${interaction.guild.memberCount}`, inline: true },
            { name: '📅 Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: `Test preview executed by ${interaction.user.tag}` })
          .setTimestamp();

        if (welcomeConfig.image) {
          embed.setImage(welcomeConfig.image);
        }

        await channel.send({ content: `<@${interaction.user.id}> [TEST PREVIEW]`, embeds: [embed] });
      } else {
        await channel.send({ content: `[TEST PREVIEW] ${formattedMessage}` });
      }

      await interaction.reply({
        content: `${config.emojis.success} Test welcome message sent to ${channel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[TEST WELCOME ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send test welcome message: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
