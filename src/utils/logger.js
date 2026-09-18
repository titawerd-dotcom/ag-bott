const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const config = require('../../config.json');

/**
 * Event category to channel mapping helper
 */
function getTargetChannelId(logsConfig, eventType) {
  if (!logsConfig) return null;

  switch (eventType) {
    case 'messageDelete':
    case 'messageUpdate':
    case 'messageDeleteBulk':
      return logsConfig.msgChannelId || logsConfig.channelId;

    case 'memberAdd':
    case 'memberRemove':
    case 'memberUpdate':
      return logsConfig.memberChannelId || logsConfig.channelId;

    case 'voiceStateUpdate':
      return logsConfig.voiceChannelId || logsConfig.channelId;

    case 'guildBanAdd':
    case 'guildBanRemove':
    case 'modAction':
    case 'warn':
      return logsConfig.modChannelId || logsConfig.channelId;

    case 'channelCreate':
    case 'channelDelete':
    case 'channelUpdate':
    case 'roleCreate':
    case 'roleDelete':
    case 'roleUpdate':
      return logsConfig.serverChannelId || logsConfig.channelId;

    default:
      return logsConfig.channelId;
  }
}

/**
 * Event category label mapper for Dashboard
 */
function getCategoryFromEvent(eventType) {
  if (['messageDelete', 'messageUpdate', 'messageDeleteBulk'].includes(eventType)) return 'MESSAGE';
  if (['memberAdd', 'memberRemove', 'memberUpdate'].includes(eventType)) return 'MEMBER';
  if (['voiceStateUpdate'].includes(eventType)) return 'VOICE';
  if (['guildBanAdd', 'guildBanRemove', 'modAction', 'warn'].includes(eventType)) return 'MODERATION';
  if (['channelCreate', 'channelDelete', 'channelUpdate'].includes(eventType)) return 'CHANNEL';
  if (['roleCreate', 'roleDelete', 'roleUpdate'].includes(eventType)) return 'ROLE';
  if (['automod'].includes(eventType)) return 'AUTOMOD';
  if (['command'].includes(eventType)) return 'COMMAND';
  return 'SERVER';
}

/**
 * Central logger for Discord events & Dashboard audit recording
 */
async function sendGuildLog(guild, eventType, options = {}) {
  if (!guild) return;

  const guildConfig = db.getGuildConfig(guild.id);
  const logsConfig = guildConfig.logs || {};

  const category = options.category || getCategoryFromEvent(eventType);

  // 1. Always record in Database server audit log for Dashboard live stream
  try {
    db.addServerLog(guild.id, {
      type: category,
      title: options.title || eventType,
      description: options.description || '',
      user: options.user || null,
      channel: options.channel || null,
      details: options.details || null
    });
  } catch (err) {
    console.error('[LOGGER DB ERROR]', err);
  }

  // 2. Also record in console buffer
  try {
    db.addLog(category, `[${guild.name}] ${options.title || eventType}: ${options.description || ''}`.slice(0, 150));
  } catch (e) {}

  // 3. Send Discord Log Embed if enabled
  if (!logsConfig.enabled) return;
  if (logsConfig.events && logsConfig.events[eventType] === false) return;

  const targetChannelId = getTargetChannelId(logsConfig, eventType);
  if (!targetChannelId) return;

  const logChannel = guild.channels.cache.get(targetChannelId);
  if (!logChannel || !logChannel.isTextBased()) return;

  try {
    const embed = new EmbedBuilder()
      .setColor(options.color || config.defaultColor)
      .setTitle(options.title || '📜 Server Audit Log')
      .setTimestamp();

    if (options.description) {
      embed.setDescription(options.description);
    }

    if (options.fields && Array.isArray(options.fields) && options.fields.length > 0) {
      embed.addFields(options.fields);
    }

    if (options.thumbnail) {
      try { embed.setThumbnail(options.thumbnail); } catch (e) {}
    }

    if (options.image) {
      try { embed.setImage(options.image); } catch (e) {}
    }

    if (options.footer) {
      embed.setFooter({
        text: options.footer.text || `Server Log • ID: ${guild.id}`,
        iconURL: options.footer.iconURL || guild.iconURL() || undefined
      });
    } else {
      embed.setFooter({ text: `Server Log • ${guild.name}`, iconURL: guild.iconURL() || undefined });
    }

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`[DISCORD LOG SEND ERROR in ${guild.name}]`, error);
  }
}

module.exports = {
  sendGuildLog,
  getTargetChannelId,
  getCategoryFromEvent
};
