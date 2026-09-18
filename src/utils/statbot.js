const { ChannelType, PermissionsBitField } = require('discord.js');
const db = require('../database/db');

/**
 * Compute real-time server statistics for a guild
 */
async function getGuildStats(guild) {
  if (!guild) {
    return {
      totalMembers: 0,
      humans: 0,
      bots: 0,
      online: 0,
      voice: 0,
      boosts: 0,
      boostTier: 0,
      channels: 0,
      roles: 0
    };
  }

  // Try to fetch members if cache is small
  try {
    if (guild.memberCount && guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch().catch(() => {});
    }
  } catch (e) {}

  const members = guild.members.cache;
  const totalMembers = guild.memberCount || members.size;
  const bots = members.filter(m => m.user?.bot).size;
  const humans = Math.max(0, totalMembers - bots);

  // Online count
  let online = 0;
  if (guild.presences && guild.presences.cache.size > 0) {
    online = guild.presences.cache.filter(p => p.status && p.status !== 'offline').size;
  } else {
    online = members.filter(m => m.presence && m.presence.status !== 'offline').size;
  }

  // Voice users count
  let voice = 0;
  if (guild.voiceStates && guild.voiceStates.cache) {
    voice = guild.voiceStates.cache.filter(vs => vs.channelId).size;
  }

  const boosts = guild.premiumSubscriptionCount || 0;
  const boostTier = guild.premiumTier || 0;
  const channels = guild.channels?.cache ? guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size : 0;
  const roles = guild.roles?.cache ? guild.roles.cache.size : 0;

  return {
    totalMembers,
    humans,
    bots,
    online,
    voice,
    boosts,
    boostTier,
    channels,
    roles
  };
}

/**
 * Format channel name template with actual count
 */
function formatTemplate(template, count) {
  if (!template) return `Count: ${count}`;
  const formattedCount = Number(count).toLocaleString();
  return template.replace(/{count}/g, formattedCount);
}

/**
 * Synchronize / Update all StatBot voice channels for a guild
 */
async function updateGuildStats(guild, force = false) {
  try {
    if (!guild) return { success: false, error: 'Guild not found' };

    const conf = db.getStatBotConfig(guild.id);
    if (!conf || !conf.enabled) {
      return { success: false, message: 'StatBot is not enabled for this server' };
    }

    const now = Date.now();
    // Prevent spam updates faster than 3 minutes unless forced
    if (!force && conf.lastUpdated && (now - conf.lastUpdated < 3 * 60 * 1000)) {
      return { success: true, message: 'Updated recently (cooldown active to prevent Discord rate limits)' };
    }

    const stats = await getGuildStats(guild);
    const updatedChannels = [];
    const channelsConf = conf.channels || {};

    const statMapping = {
      totalMembers: stats.totalMembers,
      humans: stats.humans,
      bots: stats.bots,
      online: stats.online,
      voice: stats.voice,
      boosts: stats.boosts,
      channels: stats.channels,
      roles: stats.roles
    };

    for (const [key, item] of Object.entries(channelsConf)) {
      if (!item || !item.enabled || !item.channelId) continue;

      const channel = guild.channels.cache.get(item.channelId);
      if (!channel) continue;

      const count = statMapping[key] !== undefined ? statMapping[key] : 0;
      const targetName = formatTemplate(item.template, count);

      if (channel.name !== targetName) {
        try {
          await channel.setName(targetName, 'StatBot Counter Update');
          updatedChannels.push({ key, name: targetName });
        } catch (err) {
          console.warn(`[STATBOT] Failed to rename channel ${channel.id} in ${guild.name}:`, err.message);
        }
      }
    }

    db.updateStatBotConfig(guild.id, { lastUpdated: now });
    db.addLog('STATBOT', `Updated stat channels for server ${guild.name}`);

    return {
      success: true,
      stats,
      updatedChannelsCount: updatedChannels.length
    };
  } catch (err) {
    console.error(`[STATBOT ERROR] updateGuildStats in ${guild?.name}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Setup and Auto-Create StatBot Category & Voice Channels
 */
async function setupStatChannels(guild, customConfig = {}) {
  try {
    if (!guild) throw new Error('Guild not found');

    const stats = await getGuildStats(guild);
    const existingConf = db.getStatBotConfig(guild.id) || {};
    const channelsConf = customConfig.channels || existingConf.channels || {
      totalMembers: { enabled: true, template: '👥 Total Members: {count}' },
      humans: { enabled: true, template: '👤 Humans: {count}' },
      bots: { enabled: true, template: '🤖 Bots: {count}' },
      online: { enabled: true, template: '🟢 Online: {count}' },
      voice: { enabled: false, template: '🎙️ In Voice: {count}' },
      boosts: { enabled: false, template: '🚀 Boosts: {count}' },
      channels: { enabled: false, template: '📁 Channels: {count}' },
      roles: { enabled: false, template: '🎭 Roles: {count}' }
    };

    // 1. Create or find category "📊 SERVER STATS"
    let category = null;
    if (existingConf.categoryId) {
      category = guild.channels.cache.get(existingConf.categoryId);
    }

    if (!category) {
      category = await guild.channels.create({
        name: '📊 SERVER STATS',
        type: ChannelType.GuildCategory,
        position: 0,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
            deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
          }
        ]
      });
    }

    const statMapping = {
      totalMembers: stats.totalMembers,
      humans: stats.humans,
      bots: stats.bots,
      online: stats.online,
      voice: stats.voice,
      boosts: stats.boosts,
      channels: stats.channels,
      roles: stats.roles
    };

    const newChannelsData = {};

    for (const [key, item] of Object.entries(channelsConf)) {
      if (!item.enabled) {
        newChannelsData[key] = {
          enabled: false,
          channelId: null,
          template: item.template || `Count: {count}`
        };
        continue;
      }

      const count = statMapping[key] !== undefined ? statMapping[key] : 0;
      const channelName = formatTemplate(item.template, count);

      let channel = item.channelId ? guild.channels.cache.get(item.channelId) : null;

      if (!channel) {
        channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionsBitField.Flags.ViewChannel],
              deny: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak]
            }
          ]
        });
      } else {
        if (channel.name !== channelName) {
          await channel.setName(channelName, 'StatBot Setup');
        }
        if (channel.parentId !== category.id) {
          await channel.setParent(category.id).catch(() => {});
        }
      }

      newChannelsData[key] = {
        enabled: true,
        channelId: channel.id,
        template: item.template
      };
    }

    const updatedConf = db.updateStatBotConfig(guild.id, {
      enabled: true,
      categoryId: category.id,
      channels: newChannelsData,
      lastUpdated: Date.now()
    });

    db.addLog('STATBOT', `Created and setup StatBot channels in ${guild.name}`);

    return {
      success: true,
      categoryId: category.id,
      config: updatedConf,
      stats
    };
  } catch (err) {
    console.error('[STATBOT SETUP ERROR]', err);
    throw err;
  }
}

/**
 * Delete all StatBot channels and category
 */
async function deleteStatChannels(guild) {
  try {
    if (!guild) return { success: false, error: 'Guild not found' };

    const conf = db.getStatBotConfig(guild.id);
    if (!conf) return { success: true };

    if (conf.channels) {
      for (const item of Object.values(conf.channels)) {
        if (item.channelId) {
          const ch = guild.channels.cache.get(item.channelId);
          if (ch) {
            await ch.delete('StatBot reset/deletion').catch(() => {});
          }
        }
      }
    }

    if (conf.categoryId) {
      const cat = guild.channels.cache.get(conf.categoryId);
      if (cat) {
        await cat.delete('StatBot reset/deletion').catch(() => {});
      }
    }

    db.updateStatBotConfig(guild.id, {
      enabled: false,
      categoryId: null,
      channels: {
        totalMembers: { enabled: true, channelId: null, template: '👥 Total Members: {count}' },
        humans: { enabled: true, channelId: null, template: '👤 Humans: {count}' },
        bots: { enabled: true, channelId: null, template: '🤖 Bots: {count}' },
        online: { enabled: true, channelId: null, template: '🟢 Online: {count}' },
        voice: { enabled: false, channelId: null, template: '🎙️ In Voice: {count}' },
        boosts: { enabled: false, channelId: null, template: '🚀 Boosts: {count}' },
        channels: { enabled: false, channelId: null, template: '📁 Channels: {count}' },
        roles: { enabled: false, channelId: null, template: '🎭 Roles: {count}' }
      },
      lastUpdated: 0
    });

    db.addLog('STATBOT', `Deleted and reset StatBot channels in ${guild.name}`);
    return { success: true };
  } catch (err) {
    console.error('[STATBOT DELETE ERROR]', err);
    throw err;
  }
}

/**
 * Background recurring scheduler for StatBot updates
 */
let schedulerInterval = null;

function startStatBotScheduler(client) {
  if (schedulerInterval) clearInterval(schedulerInterval);

  console.log('📊 [STATBOT] Background StatBot counter scheduler started (every 7 minutes)...');

  // Run initial pass after 15 seconds
  setTimeout(async () => {
    if (!client.guilds?.cache) return;
    for (const guild of client.guilds.cache.values()) {
      const conf = db.getStatBotConfig(guild.id);
      if (conf?.enabled) {
        await updateGuildStats(guild, false).catch(() => {});
      }
    }
  }, 15000);

  // Every 7 minutes
  schedulerInterval = setInterval(async () => {
    if (!client.guilds?.cache) return;
    for (const guild of client.guilds.cache.values()) {
      const conf = db.getStatBotConfig(guild.id);
      if (conf?.enabled) {
        await updateGuildStats(guild, false).catch(() => {});
      }
    }
  }, 7 * 60 * 1000);
}

module.exports = {
  getGuildStats,
  formatTemplate,
  updateGuildStats,
  setupStatChannels,
  deleteStatChannels,
  startStatBotScheduler
};
