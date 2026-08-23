const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed information and statistics about this server'),

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const rolesCount = guild.roles.cache.size;
    const emojisCount = guild.emojis.cache.size;

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🌐 ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '👑 Server Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
        { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
        { name: '👥 Total Members', value: `\`${guild.memberCount}\``, inline: true },
        { name: '🎭 Roles', value: `\`${rolesCount}\``, inline: true },
        { name: '😀 Emojis', value: `\`${emojisCount}\``, inline: true },
        { name: '💬 Text Channels', value: `\`${textChannels}\``, inline: true },
        { name: '🔊 Voice Channels', value: `\`${voiceChannels}\``, inline: true },
        { name: '📁 Categories', value: `\`${categories}\``, inline: true },
        { name: '🚀 Boost Level', value: `Tier ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`, inline: false }
      )
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
