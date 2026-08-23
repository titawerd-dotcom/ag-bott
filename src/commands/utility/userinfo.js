const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display detailed information about a member or yourself')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target member (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor || config.defaultColor)
      .setTitle(`👤 User Info: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '🤖 Is Bot', value: user.bot ? '`Yes`' : '`No`', inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false }
      );

    if (member) {
      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.toString());

      embed.addFields(
        { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: false },
        { name: '⭐ Highest Role', value: `${member.roles.highest}`, inline: true },
        { name: `🎭 Roles [${roles.length}]`, value: roles.length > 0 ? (roles.length > 15 ? `${roles.slice(0, 15).join(' ')} and ${roles.length - 15} more...` : roles.join(' ')) : 'None', inline: false }
      );
    }

    embed.setFooter({ text: `Requested by ${interaction.user.tag}` }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
