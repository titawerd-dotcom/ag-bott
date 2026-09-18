const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');
const { sendGuildLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure and view Discord server audit & event logging')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Set the server logging channels')
        .addChannelOption(opt =>
          opt
            .setName('general_channel')
            .setDescription('Default channel for all server logs')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('messages_channel')
            .setDescription('Dedicated channel for deleted & edited messages (Optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('members_channel')
            .setDescription('Dedicated channel for member joins, leaves & nickname changes (Optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('mod_channel')
            .setDescription('Dedicated channel for bans, kicks & warnings (Optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('voice_channel')
            .setDescription('Dedicated channel for voice join/leave/switch logs (Optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('server_channel')
            .setDescription('Dedicated channel for roles & channels changes (Optional)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View current server logging status and channel assignments')
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable specific log event categories')
        .addStringOption(opt =>
          opt
            .setName('event_category')
            .setDescription('Event category to toggle')
            .setRequired(true)
            .addChoices(
              { name: '🗑️ Message Deletes & Edits', value: 'messages' },
              { name: '👥 Member Joins & Leaves', value: 'members' },
              { name: '✏️ Member Role & Nick Updates', value: 'member_updates' },
              { name: '🔊 Voice Join / Leave / Switch', value: 'voice' },
              { name: '🔨 Ban & Unban Events', value: 'bans' },
              { name: '📁 Channel & Role Changes', value: 'server' }
            )
        )
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Whether this category should be enabled or disabled')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Send a test log embed to verify your logging channels')
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable server audit logging')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guildConfig = db.getGuildConfig(guildId);
    const logsConfig = guildConfig.logs || {};

    // 1. SETUP
    if (sub === 'setup') {
      const general = interaction.options.getChannel('general_channel');
      const messagesChan = interaction.options.getChannel('messages_channel');
      const membersChan = interaction.options.getChannel('members_channel');
      const modChan = interaction.options.getChannel('mod_channel');
      const voiceChan = interaction.options.getChannel('voice_channel');
      const serverChan = interaction.options.getChannel('server_channel');

      const updated = db.updateGuildConfig(guildId, 'logs', {
        enabled: true,
        channelId: general.id,
        msgChannelId: messagesChan ? messagesChan.id : null,
        memberChannelId: membersChan ? membersChan.id : null,
        modChannelId: modChan ? modChan.id : null,
        voiceChannelId: voiceChan ? voiceChan.id : null,
        serverChannelId: serverChan ? serverChan.id : null,
        events: logsConfig.events || {
          messageDelete: true,
          messageUpdate: true,
          memberAdd: true,
          memberRemove: true,
          memberUpdate: true,
          channelCreate: true,
          channelDelete: true,
          channelUpdate: true,
          roleCreate: true,
          roleDelete: true,
          roleUpdate: true,
          voiceStateUpdate: true,
          guildBanAdd: true,
          guildBanRemove: true
        }
      });

      const embed = new EmbedBuilder()
        .setColor(config.successColor || '#57F287')
        .setTitle('✅ Server Logging Configured')
        .setDescription('Server audit and activity logging is now **Active**!')
        .addFields(
          { name: '📜 General / Default Channel', value: `${general} (\`#${general.name}\`)`, inline: true },
          { name: '💬 Messages Channel', value: messagesChan ? `${messagesChan}` : '*(Uses General)*', inline: true },
          { name: '👥 Members Channel', value: membersChan ? `${membersChan}` : '*(Uses General)*', inline: true },
          { name: '🛡️ Moderation Channel', value: modChan ? `${modChan}` : '*(Uses General)*', inline: true },
          { name: '🔊 Voice Channel', value: voiceChan ? `${voiceChan}` : '*(Uses General)*', inline: true },
          { name: '⚙️ Server / Roles Channel', value: serverChan ? `${serverChan}` : '*(Uses General)*', inline: true }
        )
        .setFooter({ text: 'You can also customize and view live logs in the Web Dashboard!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 2. STATUS
    if (sub === 'status') {
      const isEnabled = Boolean(logsConfig.enabled);
      const genChan = logsConfig.channelId ? `<#${logsConfig.channelId}>` : '`Not Set`';
      const msgChan = logsConfig.msgChannelId ? `<#${logsConfig.msgChannelId}>` : '*(General)*';
      const memChan = logsConfig.memberChannelId ? `<#${logsConfig.memberChannelId}>` : '*(General)*';
      const modChan = logsConfig.modChannelId ? `<#${logsConfig.modChannelId}>` : '*(General)*';
      const vcChan = logsConfig.voiceChannelId ? `<#${logsConfig.voiceChannelId}>` : '*(General)*';
      const srvChan = logsConfig.serverChannelId ? `<#${logsConfig.serverChannelId}>` : '*(General)*';

      const events = logsConfig.events || {};

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? (config.successColor || '#57F287') : (config.errorColor || '#ED4245'))
        .setTitle('📜 Server Logging Status')
        .setDescription(`System Status: **${isEnabled ? '🟢 Active & Logging' : '🔴 Disabled'}**`)
        .addFields(
          { name: '📌 Default Channel', value: genChan, inline: true },
          { name: '💬 Message Logs', value: msgChan, inline: true },
          { name: '👥 Member Logs', value: memChan, inline: true },
          { name: '🛡️ Mod Logs', value: modChan, inline: true },
          { name: '🔊 Voice Logs', value: vcChan, inline: true },
          { name: '⚙️ Server / Role Logs', value: srvChan, inline: true },
          {
            name: '⚡ Event Toggles',
            value: [
              `🗑️ Messages (Delete/Edit): **${events.messageDelete !== false ? '✅ On' : '❌ Off'}**`,
              `👥 Members (Join/Leave): **${events.memberAdd !== false ? '✅ On' : '❌ Off'}**`,
              `✏️ Member Updates: **${events.memberUpdate !== false ? '✅ On' : '❌ Off'}**`,
              `🔊 Voice Events: **${events.voiceStateUpdate !== false ? '✅ On' : '❌ Off'}**`,
              `🔨 Bans & Unbans: **${events.guildBanAdd !== false ? '✅ On' : '❌ Off'}**`,
              `📁 Channels & Roles: **${events.channelCreate !== false ? '✅ On' : '❌ Off'}**`
            ].join('\n'),
            inline: false
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 3. TOGGLE
    if (sub === 'toggle') {
      const category = interaction.options.getString('event_category');
      const isEnabled = interaction.options.getBoolean('enabled');

      const events = { ...(logsConfig.events || {}) };

      if (category === 'messages') {
        events.messageDelete = isEnabled;
        events.messageUpdate = isEnabled;
        events.messageDeleteBulk = isEnabled;
      } else if (category === 'members') {
        events.memberAdd = isEnabled;
        events.memberRemove = isEnabled;
      } else if (category === 'member_updates') {
        events.memberUpdate = isEnabled;
      } else if (category === 'voice') {
        events.voiceStateUpdate = isEnabled;
      } else if (category === 'bans') {
        events.guildBanAdd = isEnabled;
        events.guildBanRemove = isEnabled;
      } else if (category === 'server') {
        events.channelCreate = isEnabled;
        events.channelDelete = isEnabled;
        events.channelUpdate = isEnabled;
        events.roleCreate = isEnabled;
        events.roleDelete = isEnabled;
        events.roleUpdate = isEnabled;
      }

      db.updateGuildConfig(guildId, 'logs', { events });

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle('⚙️ Logging Event Updated')
        .setDescription(`Category **${category}** has been **${isEnabled ? 'Enabled ✅' : 'Disabled ❌'}**.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 4. TEST
    if (sub === 'test') {
      if (!logsConfig.enabled || !logsConfig.channelId) {
        return interaction.reply({
          content: '⚠️ Logging is not enabled or no general log channel is configured. Run `/logs setup` first!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      await sendGuildLog(interaction.guild, 'command', {
        title: '🧪 Test Log Embed',
        description: `This is a test log message initiated by <@${interaction.user.id}> via \`/logs test\`.`,
        color: config.defaultColor || '#5865F2',
        fields: [
          { name: '👤 Triggered By', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
          { name: '💬 Current Channel', value: `${interaction.channel}`, inline: true },
          { name: '⚡ Status', value: '`All Logging Pipelines Operational`', inline: false }
        ],
        user: { id: interaction.user.id, tag: interaction.user.tag },
        channel: { id: interaction.channel.id, name: interaction.channel.name }
      });

      await interaction.followUp({ content: '✅ Test log embed dispatched to your configured log channel(s)!' });
      return;
    }

    // 5. DISABLE
    if (sub === 'disable') {
      db.updateGuildConfig(guildId, 'logs', { enabled: false });

      const embed = new EmbedBuilder()
        .setColor(config.errorColor || '#ED4245')
        .setTitle('🔴 Server Logging Disabled')
        .setDescription('Server audit logging to Discord channels has been stopped. You can re-enable it at any time with `/logs setup`.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
};
