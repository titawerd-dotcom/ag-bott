const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bulkchannel')
    .setDescription('Perform bulk actions on multiple channels (delete, nuke, lock, unlock, slowmode)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // SUBCOMMAND: DELETE
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Bulk delete all channels within a category or of a specific type')
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Target category to delete all channels from')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('delete_category_too')
            .setDescription('Also delete the category itself (default: false)')
        )
    )
    // SUBCOMMAND: NUKE
    .addSubcommand(sub =>
      sub.setName('nuke')
        .setDescription('Bulk nuke (wipe all message history and recreate) channels in a category')
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Target category to nuke channels in')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    // SUBCOMMAND: LOCK
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('Bulk lock text channels (prevent @everyone from sending messages)')
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Target category (leave empty for ALL server text channels)')
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    // SUBCOMMAND: UNLOCK
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Bulk unlock text channels (allow @everyone to send messages)')
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Target category (leave empty for ALL server text channels)')
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    // SUBCOMMAND: SLOWMODE
    .addSubcommand(sub =>
      sub.setName('slowmode')
        .setDescription('Set slowmode cooldown on multiple channels simultaneously')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Slowmode cooldown in seconds (0 to disable)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(21600)
        )
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Target category (leave empty for ALL server text channels)')
            .addChannelTypes(ChannelType.GuildCategory)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    await interaction.deferReply();

    // -------------------------------------------------------------
    // SUBCOMMAND: DELETE
    // -------------------------------------------------------------
    if (subcommand === 'delete') {
      const category = interaction.options.getChannel('category');
      const deleteCatToo = interaction.options.getBoolean('delete_category_too') || false;

      const children = guild.channels.cache.filter(c => c.parentId === category.id);
      let deletedCount = 0;

      for (const [_, ch] of children) {
        try {
          await ch.delete(`Bulk deleted by ${interaction.user.tag}`);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete channel ${ch.name}:`, e.message);
        }
      }

      if (deleteCatToo) {
        try {
          await category.delete(`Bulk deleted category by ${interaction.user.tag}`);
          deletedCount++;
        } catch (e) {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.successColor || '#57F287')
        .setTitle('🗑️ Bulk Channel Deletion Complete')
        .setDescription(`Successfully deleted **${deletedCount}** channel(s) from category **${category.name}**.`)
        .setFooter({ text: `Action executed by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: NUKE
    // -------------------------------------------------------------
    if (subcommand === 'nuke') {
      const category = interaction.options.getChannel('category');
      const textChannels = guild.channels.cache.filter(c => c.parentId === category.id && c.type === ChannelType.GuildText);

      if (textChannels.size === 0) {
        return interaction.editReply({ content: `❌ No text channels found in category **${category.name}**.` });
      }

      let nukedCount = 0;
      for (const [_, ch] of textChannels) {
        try {
          const position = ch.position;
          const topic = ch.topic;
          const newChan = await ch.clone({
            name: ch.name,
            permissions: ch.permissionOverwrites.cache,
            topic: topic,
            position: position,
            parent: category.id,
            reason: `Bulk nuked by ${interaction.user.tag}`
          });
          await ch.delete(`Bulk nuked by ${interaction.user.tag}`);
          await newChan.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.errorColor || '#ED4245')
                .setTitle('💥 Channel Nuked!')
                .setDescription(`This channel was completely wiped and recreated as part of a bulk operation by ${interaction.user}.`)
                .setTimestamp()
            ]
          }).catch(() => {});
          nukedCount++;
        } catch (e) {
          console.error(`Failed to nuke channel ${ch.name}:`, e.message);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(config.errorColor || '#ED4245')
        .setTitle('💥 Bulk Channel Nuke Completed')
        .setDescription(`Successfully nuked and cleaned **${nukedCount}** text channel(s) in category **${category.name}**.`)
        .setFooter({ text: `Executed by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: LOCK
    // -------------------------------------------------------------
    if (subcommand === 'lock') {
      const category = interaction.options.getChannel('category');
      let targetChannels;

      if (category) {
        targetChannels = guild.channels.cache.filter(c => c.parentId === category.id && c.type === ChannelType.GuildText);
      } else {
        targetChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      }

      let lockedCount = 0;
      for (const [_, ch] of targetChannels) {
        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false
          });
          lockedCount++;
        } catch (e) {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.errorColor || '#ED4245')
        .setTitle('🔒 Bulk Channel Lockdown')
        .setDescription(`Successfully **locked** **${lockedCount}** channel(s)${category ? ` in category **${category.name}**` : ' across the entire server'}.`)
        .setFooter({ text: `Locked by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: UNLOCK
    // -------------------------------------------------------------
    if (subcommand === 'unlock') {
      const category = interaction.options.getChannel('category');
      let targetChannels;

      if (category) {
        targetChannels = guild.channels.cache.filter(c => c.parentId === category.id && c.type === ChannelType.GuildText);
      } else {
        targetChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      }

      let unlockedCount = 0;
      for (const [_, ch] of targetChannels) {
        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: null,
            AddReactions: null
          });
          unlockedCount++;
        } catch (e) {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.successColor || '#57F287')
        .setTitle('🔓 Bulk Channel Unlock')
        .setDescription(`Successfully **unlocked** **${unlockedCount}** channel(s)${category ? ` in category **${category.name}**` : ' across the entire server'}.`)
        .setFooter({ text: `Unlocked by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: SLOWMODE
    // -------------------------------------------------------------
    if (subcommand === 'slowmode') {
      const seconds = interaction.options.getInteger('seconds');
      const category = interaction.options.getChannel('category');
      let targetChannels;

      if (category) {
        targetChannels = guild.channels.cache.filter(c => c.parentId === category.id && c.type === ChannelType.GuildText);
      } else {
        targetChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      }

      let updatedCount = 0;
      for (const [_, ch] of targetChannels) {
        try {
          await ch.setRateLimitPerUser(seconds, `Bulk slowmode by ${interaction.user.tag}`);
          updatedCount++;
        } catch (e) {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle('⏳ Bulk Slowmode Updated')
        .setDescription(`Successfully set slowmode to **${seconds}s** on **${updatedCount}** channel(s)${category ? ` in category **${category.name}**` : ''}.`)
        .setFooter({ text: `Updated by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
