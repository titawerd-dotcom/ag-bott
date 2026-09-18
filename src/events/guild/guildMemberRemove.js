const { Events, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');
const { sendGuildLog } = require('../../utils/logger');
const { updateGuildStats } = require('../../utils/statbot');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const guildId = member.guild.id;
    const guildConfig = db.getGuildConfig(guildId);

    // StatBot Counter update
    updateGuildStats(member.guild, false).catch(() => {});

    // 0. Audit & Discord Logging
    await sendGuildLog(member.guild, 'memberRemove', {
      title: '📤 Member Left',
      description: `**${member.user.tag}** left or was kicked/banned from **${member.guild.name}**.`,
      color: config.errorColor || '#ED4245',
      fields: [
        { name: '👤 Member', value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
        { name: '🔢 Remaining Members', value: `#${member.guild.memberCount}`, inline: true }
      ],
      thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
      user: { id: member.id, tag: member.user.tag },
      details: { memberCount: member.guild.memberCount }
    });

    const goodbyeConfig = guildConfig.goodbye;
    if (!goodbyeConfig?.enabled || !goodbyeConfig?.channelId) return;

    const channel = member.guild.channels.cache.get(goodbyeConfig.channelId);
    if (!channel) return;

    // Format placeholders
    const rawMessage = goodbyeConfig.message || '{user} has left **{server}**. We now have {memberCount} members.';
    const formattedMessage = rawMessage
      .replace(/{user}/g, `**${member.user.tag}**`)
      .replace(/{userName}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{memberCount}/g, member.guild.memberCount.toString());

    try {
      if (goodbyeConfig.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(goodbyeConfig.color || config.errorColor)
          .setTitle(`${config.emojis.goodbye} Goodbye!`)
          .setDescription(formattedMessage)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤 Member', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: '🔢 Remaining Members', value: `${member.guild.memberCount}`, inline: true }
          )
          .setFooter({ text: `User ID: ${member.id}`, iconURL: member.guild.iconURL() || undefined })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } else {
        // Plain text goodbye message
        await channel.send({ content: formattedMessage });
      }
    } catch (err) {
      console.error(`[GOODBYE ERROR] Could not send goodbye message in ${member.guild.name}:`, err);
    }
  }
};
