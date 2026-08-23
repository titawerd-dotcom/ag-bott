const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create an interactive button role panel for self-assigning roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the role panel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('title').setDescription('Title for the role panel').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Description / Instructions').setRequired(true))
    .addRoleOption(opt => opt.setName('role1').setDescription('First Role').setRequired(true))
    .addStringOption(opt => opt.setName('label1').setDescription('Button Label for Role 1').setRequired(true))
    .addRoleOption(opt => opt.setName('role2').setDescription('Second Role').setRequired(false))
    .addStringOption(opt => opt.setName('label2').setDescription('Button Label for Role 2').setRequired(false))
    .addRoleOption(opt => opt.setName('role3').setDescription('Third Role').setRequired(false))
    .addStringOption(opt => opt.setName('label3').setDescription('Button Label for Role 3').setRequired(false))
    .addRoleOption(opt => opt.setName('role4').setDescription('Fourth Role').setRequired(false))
    .addStringOption(opt => opt.setName('label4').setDescription('Button Label for Role 4').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');

    const rolesData = [];
    for (let i = 1; i <= 4; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const label = interaction.options.getString(`label${i}`);
      if (role && label) {
        rolesData.push({ role, label });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🎭 ${title}`)
      .setDescription(description + '\n\n' + rolesData.map(r => `• Click below to toggle ${r.role}`).join('\n'))
      .setFooter({ text: `${interaction.guild.name} • Self Role System` })
      .setTimestamp();

    const row = new ActionRowBuilder();
    const buttonStyles = [ButtonStyle.Primary, ButtonStyle.Success, ButtonStyle.Secondary, ButtonStyle.Danger];

    rolesData.forEach((r, idx) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_role_${r.role.id}`)
          .setLabel(r.label)
          .setStyle(buttonStyles[idx % buttonStyles.length])
      );
    });

    try {
      await channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({
        content: `${config.emojis.success} Button role panel successfully sent to ${channel}!`,
        ephemeral: true
      });
    } catch (err) {
      console.error('[REACTION ROLE ERROR]', err);
      await interaction.reply({
        content: `${config.emojis.error} Failed to send button role panel: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
