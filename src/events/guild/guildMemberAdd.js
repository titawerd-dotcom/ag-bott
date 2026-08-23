const { Events, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const guildId = member.guild.id;
    const guildConfig = db.getGuildConfig(guildId);

    // 1. Autorole handling
    if (guildConfig.autorole?.enabled && guildConfig.autorole?.roleId) {
      try {
        const role = member.guild.roles.cache.get(guildConfig.autorole.roleId);
        if (role) {
          await member.roles.add(role);
        }
      } catch (err) {
        console.error(`[AUTOROLE ERROR] Could not add role to ${member.user.tag}:`, err);
      }
    }

    // 2. Welcome Message handling
    const welcomeConfig = guildConfig.welcome;
    if (!welcomeConfig?.enabled || !welcomeConfig?.channelId) return;

    const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
    if (!channel) return;

    // Format placeholders
    const rawMessage = welcomeConfig.message || 'Welcome {user} to **{server}**! You are member #{memberCount}.';
    const formattedMessage = rawMessage
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{userName}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount.toString());

    try {
      if (welcomeConfig.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(welcomeConfig.color || config.successColor)
          .setTitle(`${config.emojis.welcome} Welcome to ${member.guild.name}!`)
          .setDescription(formattedMessage)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 Member', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
            { name: '🔢 Member Count', value: `#${member.guild.memberCount}`, inline: true },
            { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: `User ID: ${member.id}`, iconURL: member.guild.iconURL() || undefined })
          .setTimestamp();

        if (welcomeConfig.image) {
          embed.setImage(welcomeConfig.image);
        }

        await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
      } else {
        // Plain text welcome message
        await channel.send({ content: formattedMessage });
      }
    } catch (err) {
      console.error(`[WELCOME ERROR] Could not send welcome message in ${member.guild.name}:`, err);
    }
  }
};
