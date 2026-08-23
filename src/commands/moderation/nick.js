const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change or reset a member\'s nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target member')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('nickname')
        .setDescription('New nickname (leave empty to reset to default username)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const newNick = interaction.options.getString('nickname');
    const member = interaction.guild.members.cache.get(targetUser.id);

    if (!member) {
      return interaction.reply({
        content: `${config.emojis.error} That user is not in this server!`,
        ephemeral: true
      });
    }

    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({
        content: `${config.emojis.error} You cannot change the nickname of someone with an equal or higher role!`,
        ephemeral: true
      });
    }

    try {
      await member.setNickname(newNick || null);

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setTitle(`${config.emojis.tools} Nickname Updated`)
        .setDescription(
          newNick
            ? `Changed nickname of **${targetUser.tag}** to **${newNick}**.`
            : `Reset nickname of **${targetUser.tag}** to default username.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('[NICK ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to change nickname: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
