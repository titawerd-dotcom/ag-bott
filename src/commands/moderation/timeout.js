const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mute/timeout a member for a specified duration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The member to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of timeout (e.g., 60s, 5m, 10m, 1h, 1d, 1w)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('The reason for timing out')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration').toLowerCase().trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) {
      return interaction.reply({
        content: `${config.emojis.error} That user is not in this server!`,
        ephemeral: true
      });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: `${config.emojis.error} I cannot timeout this user! Their role may be higher than mine.`,
        ephemeral: true
      });
    }

    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot timeout this member because their role is equal to or higher than yours!`,
        ephemeral: true
      });
    }

    // Parse duration
    let ms = 0;
    const match = durationInput.match(/^(\d+)(s|m|h|d|w)$/);
    if (!match) {
      return interaction.reply({
        content: `${config.emojis.error} Invalid duration format! Examples: \`60s\` (seconds), \`10m\` (minutes), \`2h\` (hours), \`1d\` (days), \`1w\` (weeks).`,
        ephemeral: true
      });
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': ms = value * 1000; break;
      case 'm': ms = value * 60 * 1000; break;
      case 'h': ms = value * 60 * 60 * 1000; break;
      case 'd': ms = value * 24 * 60 * 60 * 1000; break;
      case 'w': ms = value * 7 * 24 * 60 * 60 * 1000; break;
    }

    // Discord max timeout is 28 days
    if (ms > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: `${config.emojis.error} Timeout duration cannot exceed 28 days!`,
        ephemeral: true
      });
    }

    try {
      await member.timeout(ms, `${interaction.user.tag}: ${reason}`);

      const timeoutEmbed = new EmbedBuilder()
        .setColor(config.warningColor)
        .setTitle(`${config.emojis.shield} Member Timed Out`)
        .setDescription(`Successfully timed out **${targetUser.tag}**.`)
        .addFields(
          { name: '👤 User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
          { name: '⏱️ Duration', value: durationInput, inline: true },
          { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [timeoutEmbed] });
    } catch (err) {
      console.error('[TIMEOUT ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to timeout user: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
