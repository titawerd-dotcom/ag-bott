const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');
const { testTikTokNotification, fetchTikTokProfile } = require('../../utils/tiktokNotifier');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tiktoknotify')
    .setDescription('Configure TikTok Live and New Video notifications (NotifyMe)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // SUBCOMMAND: ADD
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Track a TikTok creator and set automated notifications')
        .addStringOption(opt =>
          opt.setName('username')
            .setDescription('TikTok username handle (e.g. kurdish_creator or @user)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Discord channel to receive TikTok notifications')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Role to mention/tag on notification (optional)')
        )
        .addStringOption(opt =>
          opt.setName('message')
            .setDescription('Custom alert message template ({author}, {url}, {role}, {title})')
        )
        .addBooleanOption(opt =>
          opt.setName('notify_live')
            .setDescription('Send notification when creator goes LIVE (default: true)')
        )
        .addBooleanOption(opt =>
          opt.setName('notify_video')
            .setDescription('Send notification when creator posts a new video (default: true)')
        )
        .addStringOption(opt =>
          opt.setName('color')
            .setDescription('Embed color in HEX (default: #FE2C55)')
        )
        .addStringOption(opt =>
          opt.setName('banner')
            .setDescription('Custom Banner Image URL')
        )
    )
    // SUBCOMMAND: LIST
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all TikTok creators tracked on this server')
    )
    // SUBCOMMAND: TEST
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Send a test TikTok notification to verify setup')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('TikTok tracker ID')
            .setRequired(true)
        )
    )
    // SUBCOMMAND: DELETE
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a TikTok tracker')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('TikTok tracker ID')
            .setRequired(true)
        )
    )
    // SUBCOMMAND: TOGGLE
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable or disable a TikTok tracker')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('TikTok tracker ID')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // -------------------------------------------------------------
    // SUBCOMMAND: ADD
    // -------------------------------------------------------------
    if (subcommand === 'add') {
      const username = interaction.options.getString('username');
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const message = interaction.options.getString('message');
      const notifyLive = interaction.options.getBoolean('notify_live') !== false;
      const notifyVideo = interaction.options.getBoolean('notify_video') !== false;
      const color = interaction.options.getString('color') || '#FE2C55';
      const banner = interaction.options.getString('banner') || '';

      const cleanUser = username.replace(/^@/, '').trim();
      const profile = await fetchTikTokProfile(cleanUser);

      const saved = db.saveTikTokTracker(guildId, null, {
        tiktokUsername: cleanUser,
        channelId: channel.id,
        mentionRoleId: role ? role.id : null,
        customMessage: message || '🔥 **{author}** is now **LIVE** on TikTok! Join the stream: {url}',
        notifyLive,
        notifyVideo,
        embedColor: color,
        banner,
        enabled: true
      });

      const embed = new EmbedBuilder()
        .setColor('#FE2C55')
        .setTitle('✅ TikTok Tracker Configured')
        .setThumbnail(profile.avatar)
        .addFields(
          { name: '🆔 Tracker ID', value: `\`${saved.id}\``, inline: true },
          { name: '📱 Creator', value: `[@${cleanUser}](https://www.tiktok.com/@${cleanUser})`, inline: true },
          { name: '📢 Post Channel', value: `${channel}`, inline: true },
          { name: '🔔 Mention Role', value: role ? `${role}` : 'None', inline: true },
          { name: '🔴 Live Alerts', value: notifyLive ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: '🎬 Video Alerts', value: notifyVideo ? '🟢 Enabled' : '🔴 Disabled', inline: true }
        )
        .setFooter({ text: 'Use /tiktoknotify test to send a test alert!' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: LIST
    // -------------------------------------------------------------
    if (subcommand === 'list') {
      const trackers = db.getTikTokTrackers(guildId);
      const list = Object.values(trackers || {});

      if (list.length === 0) {
        return interaction.reply({
          content: '📱 No TikTok creators tracked yet on this server. Use `/tiktoknotify add` to add one!',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#FE2C55')
        .setTitle(`📱 Tracked TikTok Creators (${list.length})`)
        .setDescription('Automatic notifications will be dispatched to Discord when these creators post or go LIVE:');

      list.forEach((t, idx) => {
        const status = t.enabled ? '🟢 Active' : '🔴 Disabled';
        const chan = interaction.guild.channels.cache.get(t.channelId);
        const role = t.mentionRoleId ? `<@&${t.mentionRoleId}>` : 'None';

        embed.addFields({
          name: `${idx + 1}. @${t.tiktokUsername} [ID: \`${t.id}\`]`,
          value: `• **Status:** ${status}\n• **Channel:** ${chan ? chan : '`Deleted Channel`'}\n• **Role:** ${role}\n• **Events:** ${t.notifyLive ? '🔴 Live' : ''} ${t.notifyVideo ? '🎬 Video' : ''}`,
          inline: false
        });
      });

      return interaction.reply({ embeds: [embed] });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: TEST
    // -------------------------------------------------------------
    if (subcommand === 'test') {
      const id = interaction.options.getString('id');
      await interaction.deferReply();

      try {
        await testTikTokNotification(interaction.client, guildId, id);
        return interaction.editReply({ content: `✅ Test TikTok alert successfully dispatched to configured channel for tracker \`${id}\`!` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Test notification failed: ${err.message}` });
      }
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: DELETE
    // -------------------------------------------------------------
    if (subcommand === 'delete') {
      const id = interaction.options.getString('id');
      const deleted = db.deleteTikTokTracker(guildId, id);

      if (!deleted) {
        return interaction.reply({ content: `❌ No TikTok tracker found with ID \`${id}\`.`, ephemeral: true });
      }

      return interaction.reply({ content: `✅ TikTok tracker \`${id}\` deleted successfully!` });
    }

    // -------------------------------------------------------------
    // SUBCOMMAND: TOGGLE
    // -------------------------------------------------------------
    if (subcommand === 'toggle') {
      const id = interaction.options.getString('id');
      const updated = db.toggleTikTokTracker(guildId, id);

      if (!updated) {
        return interaction.reply({ content: `❌ No TikTok tracker found with ID \`${id}\`.`, ephemeral: true });
      }

      const stateStr = updated.enabled ? '🟢 Enabled' : '🔴 Disabled';
      return interaction.reply({ content: `TikTok tracker for \`@${updated.tiktokUsername}\` is now **${stateStr}**.` });
    }
  }
};
