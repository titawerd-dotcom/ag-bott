const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage server giveaways and prizes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a new interactive giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('The prize to be won').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1m, 10m, 1h, 24h, 3d)').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20).setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Channel to host giveaway').addChannelTypes(ChannelType.GuildText).setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End an ongoing giveaway immediately')
        .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID of the giveaway').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Pick a new random winner for a finished giveaway')
        .addStringOption(opt => opt.setName('message_id').setDescription('The Message ID of the giveaway').setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'start') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration').toLowerCase().trim();
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      // Parse duration
      let ms = 0;
      const match = durationStr.match(/^(\d+)(s|m|h|d)$/);
      if (!match) {
        return interaction.reply({
          content: `${config.emojis.error} Invalid duration format! Use \`10m\` (minutes), \`2h\` (hours), \`1d\` (days).`,
          ephemeral: true
        });
      }

      const val = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === 's') ms = val * 1000;
      else if (unit === 'm') ms = val * 60 * 1000;
      else if (unit === 'h') ms = val * 3600 * 1000;
      else if (unit === 'd') ms = val * 86400 * 1000;

      const endsAt = Date.now() + ms;
      const endsTimestamp = Math.floor(endsAt / 1000);

      const giveawayEmbed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`🎉 GIVEAWAY: ${prize}`)
        .setDescription(
          `Click the **🎉 Enter** button below to participate!\n\n` +
          `• **Winners:** \`${winnerCount}\`\n` +
          `• **Hosted by:** ${interaction.user}\n` +
          `• **Ends:** <t:${endsTimestamp}:R> (<t:${endsTimestamp}:f>)\n` +
          `• **Entries:** \`0\``
        )
        .setFooter({ text: 'Giveaway System • Good Luck!' })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter_btn')
          .setLabel('🎉 Enter (0)')
          .setStyle(ButtonStyle.Primary)
      );

      const giveawayMsg = await targetChannel.send({ embeds: [giveawayEmbed], components: [row] });

      db.saveGiveaway(guildId, giveawayMsg.id, {
        channelId: targetChannel.id,
        prize: prize,
        winnerCount: winnerCount,
        endsAt: endsAt,
        hostedBy: interaction.user.id,
        entries: [],
        ended: false,
        winners: []
      });

      await interaction.reply({
        content: `${config.emojis.success} Giveaway started in ${targetChannel}!`,
        ephemeral: true
      });

      // End timer
      setTimeout(async () => {
        const ga = db.getGiveaway(guildId, giveawayMsg.id);
        if (ga && !ga.ended) {
          endGiveawayHelper(interaction.client, guildId, giveawayMsg.id);
        }
      }, ms);

      return;
    }

    if (subcommand === 'end') {
      const messageId = interaction.options.getString('message_id');
      const ga = db.getGiveaway(guildId, messageId);

      if (!ga) {
        return interaction.reply({
          content: `${config.emojis.error} No giveaway found with Message ID \`${messageId}\`!`,
          ephemeral: true
        });
      }

      if (ga.ended) {
        return interaction.reply({
          content: `${config.emojis.warning} This giveaway has already ended!`,
          ephemeral: true
        });
      }

      await endGiveawayHelper(interaction.client, guildId, messageId);
      return interaction.reply({
        content: `${config.emojis.success} Giveaway \`${messageId}\` ended successfully!`,
        ephemeral: true
      });
    }

    if (subcommand === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const ga = db.getGiveaway(guildId, messageId);

      if (!ga) {
        return interaction.reply({
          content: `${config.emojis.error} Giveaway not found!`,
          ephemeral: true
        });
      }

      if (!ga.entries || ga.entries.length === 0) {
        return interaction.reply({
          content: `${config.emojis.warning} Cannot reroll: No users entered this giveaway.`,
          ephemeral: true
        });
      }

      const randomWinnerId = ga.entries[Math.floor(Math.random() * ga.entries.length)];
      const channel = interaction.guild.channels.cache.get(ga.channelId);

      if (channel) {
        await channel.send({
          content: `🎉 **New Winner Rerolled!** Congratulations <@${randomWinnerId}>! You won **${ga.prize}**!`
        });
      }

      return interaction.reply({
        content: `${config.emojis.success} New winner rerolled: <@${randomWinnerId}>!`,
        ephemeral: true
      });
    }
  }
};

async function endGiveawayHelper(client, guildId, messageId) {
  const ga = db.getGiveaway(guildId, messageId);
  if (!ga || ga.ended) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(ga.channelId);
  if (!channel) return;

  let message;
  try {
    message = await channel.messages.fetch(messageId);
  } catch (e) {
    return;
  }

  const entries = ga.entries || [];
  let winners = [];

  if (entries.length > 0) {
    const shuffled = [...entries].sort(() => 0.5 - Math.random());
    winners = shuffled.slice(0, Math.min(ga.winnerCount, entries.length));
  }

  db.saveGiveaway(guildId, messageId, {
    ...ga,
    ended: true,
    winners: winners
  });

  const winnersString = winners.length > 0
    ? winners.map(id => `<@${id}>`).join(', ')
    : 'No valid entries';

  const endEmbed = new EmbedBuilder()
    .setColor(winners.length > 0 ? config.successColor : config.errorColor)
    .setTitle(`🎉 GIVEAWAY ENDED: ${ga.prize}`)
    .setDescription(
      `• **Winner(s):** ${winnersString}\n` +
      `• **Hosted by:** <@${ga.hostedBy}>\n` +
      `• **Total Entries:** \`${entries.length}\``
    )
    .setFooter({ text: 'Giveaway Ended' })
    .setTimestamp();

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_ended_btn')
      .setLabel(`Ended (${entries.length})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  await message.edit({ embeds: [endEmbed], components: [disabledRow] }).catch(() => {});

  if (winners.length > 0) {
    await channel.send({
      content: `🎉 Congratulations ${winnersString}! You won **${ga.prize}**!`
    });
  } else {
    await channel.send({
      content: `⚠️ Giveaway for **${ga.prize}** ended with no entries.`
    });
  }
}
