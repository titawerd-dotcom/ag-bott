const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const dbFilePath = path.join(dataDir, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial DB template
const defaultData = {
  guilds: {}
};

// In-memory cache & log buffer
let database = { ...defaultData };
const consoleLogsBuffer = [];

// Log buffer helper
function addLog(type, message) {
  const entry = {
    timestamp: Date.now(),
    type: type || 'INFO',
    message: message || ''
  };
  consoleLogsBuffer.unshift(entry);
  if (consoleLogsBuffer.length > 200) {
    consoleLogsBuffer.pop();
  }
}

function getRecentLogs() {
  return consoleLogsBuffer;
}

function clearConsoleLogs() {
  consoleLogsBuffer.length = 0;
  return true;
}

// Load database from file
function loadDatabase() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      database = JSON.parse(raw);
    } else {
      saveDatabase();
    }
  } catch (error) {
    console.error('[DB] Error loading database:', error);
    database = { ...defaultData };
  }
}

// Save database to file
function saveDatabase() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(database, null, 2), 'utf8');
  } catch (error) {
    console.error('[DB] Error saving database:', error);
  }
}

// Ensure guild structure
function ensureGuild(guildId) {
  if (!database.guilds) {
    database.guilds = {};
  }
  if (!database.guilds[guildId]) {
    database.guilds[guildId] = {
      welcome: {
        enabled: false,
        channelId: null,
        message: 'Welcome {user} to **{server}**! You are member #{memberCount}.',
        isEmbed: true,
        color: '#57F287',
        image: null
      },
      goodbye: {
        enabled: false,
        channelId: null,
        message: '{user} has left the server. We now have {memberCount} members.',
        isEmbed: true,
        color: '#ED4245'
      },
      autorole: {
        enabled: false,
        roleId: null
      },
      ticket: {
        enabled: true,
        categoryId: null,
        staffRoleId: null,
        counter: 0,
        panel: {
          title: '📩 Support & Help Desk',
          description: 'Need assistance, want to report an issue, or talk to our staff team?\n\nClick the **Create Ticket** button below to open a private support room with our staff.',
          color: '#5865F2',
          banner: '',
          thumbnail: '',
          footer: '{server} • Official Support System',
          buttonLabel: 'Create Ticket',
          buttonStyle: 'Primary',
          buttonEmoji: '📩',
          channelId: null
        },
        insideWelcome: {
          title: '📩 Support Ticket #{ticketNumber}',
          description: 'Hello {user}, welcome to your support ticket!\n\n• Please describe your issue or question in detail.\n• Our support team will assist you shortly.\n\n**Ticket Controls:** Use the buttons below to manage this ticket.',
          color: '#5865F2',
          banner: '',
          thumbnail: '',
          footer: 'Support Ticket System',
          pingStaff: true
        }
      },
      statbot: {
        enabled: false,
        categoryId: null,
        updateInterval: 10,
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
      },
      automod: {
        enabled: false,
        antiInvite: true,
        antiLinks: false,
        antiCaps: false,
        antiSpam: true,
        badWords: ['discord.gg/', 'badword1', 'scam'],
        punishment: 'delete',
        logChannelId: null
      },
      leveling: {
        enabled: true,
        channelId: null,
        message: '🎉 Congratulations {user}! You just leveled up to **Level {level}**!',
        users: {}
      },
      logs: {
        enabled: false,
        channelId: null,
        msgChannelId: null,
        memberChannelId: null,
        voiceChannelId: null,
        modChannelId: null,
        serverChannelId: null,
        events: {
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
      },
      auditLogs: [],
      giveaways: {},
      reactionRoles: {},
      backups: {},
      warns: {},
      tickets: {}
    };
    saveDatabase();
  }

  // Ensure missing sub-objects for existing guilds
  const g = database.guilds[guildId];
  if (!g.logs) {
    g.logs = {
      enabled: false,
      channelId: null,
      msgChannelId: null,
      memberChannelId: null,
      voiceChannelId: null,
      modChannelId: null,
      serverChannelId: null,
      events: {
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
    };
  }
  if (!g.auditLogs) g.auditLogs = [];
  if (!g.automod) {
    g.automod = {
      enabled: false,
      antiInvite: true,
      antiLinks: false,
      antiCaps: false,
      antiSpam: true,
      badWords: ['discord.gg/', 'badword1', 'scam'],
      punishment: 'delete',
      logChannelId: null
    };
  }
  if (!g.leveling) {
    g.leveling = {
      enabled: true,
      channelId: null,
      message: '🎉 Congratulations {user}! You just leveled up to **Level {level}**!',
      users: {}
    };
  }
  if (!g.giveaways) g.giveaways = {};
  if (!g.reactionRoles) g.reactionRoles = {};
  if (!g.backups) g.backups = {};
  if (!g.warns) g.warns = {};
  if (!g.tickets) g.tickets = {};
  if (!g.ticket) {
    g.ticket = {
      enabled: true,
      categoryId: null,
      staffRoleId: null,
      counter: 0,
      panel: {
        title: '📩 Support & Help Desk',
        description: 'Need assistance, want to report an issue, or talk to our staff team?\n\nClick the **Create Ticket** button below to open a private support room with our staff.',
        color: '#5865F2',
        banner: '',
        thumbnail: '',
        footer: '{server} • Official Support System',
        buttonLabel: 'Create Ticket',
        buttonStyle: 'Primary',
        buttonEmoji: '📩',
        channelId: null
      },
      insideWelcome: {
        title: '📩 Support Ticket #{ticketNumber}',
        description: 'Hello {user}, welcome to your support ticket!\n\n• Please describe your issue or question in detail.\n• Our support team will assist you shortly.\n\n**Ticket Controls:** Use the buttons below to manage this ticket.',
        color: '#5865F2',
        banner: '',
        thumbnail: '',
        footer: 'Support Ticket System',
        pingStaff: true
      }
    };
  }
  if (!g.ticket.panel) {
    g.ticket.panel = {
      title: '📩 Support & Help Desk',
      description: 'Need assistance, want to report an issue, or talk to our staff team?\n\nClick the **Create Ticket** button below to open a private support room with our staff.',
      color: '#5865F2',
      banner: '',
      thumbnail: '',
      footer: '{server} • Official Support System',
      buttonLabel: 'Create Ticket',
      buttonStyle: 'Primary',
      buttonEmoji: '📩',
      channelId: null
    };
  }
  if (!g.ticket.insideWelcome) {
    g.ticket.insideWelcome = {
      title: '📩 Support Ticket #{ticketNumber}',
      description: 'Hello {user}, welcome to your support ticket!\n\n• Please describe your issue or question in detail.\n• Our support team will assist you shortly.\n\n**Ticket Controls:** Use the buttons below to manage this ticket.',
      color: '#5865F2',
      banner: '',
      thumbnail: '',
      footer: 'Support Ticket System',
      pingStaff: true
    };
  }
  if (!g.statbot) {
    g.statbot = {
      enabled: false,
      categoryId: null,
      updateInterval: 10,
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
    };
  }
  if (!g.userStats) g.userStats = {};
  if (!g.autoresponders) g.autoresponders = {};
  if (!g.tiktokTrackers) g.tiktokTrackers = {};

  return g;
}

// Get full guild config
function getGuildConfig(guildId) {
  return ensureGuild(guildId);
}

// Update guild config section
function updateGuildConfig(guildId, key, data) {
  const guild = ensureGuild(guildId);
  guild[key] = { ...guild[key], ...data };
  saveDatabase();
  return guild[key];
}

// Warning system methods
function addWarn(guildId, userId, moderatorId, reason) {
  const guild = ensureGuild(guildId);
  if (!guild.warns[userId]) {
    guild.warns[userId] = [];
  }
  const warnEntry = {
    id: (Date.now() + Math.floor(Math.random() * 1000)).toString(36),
    moderatorId,
    reason: reason || 'No reason provided',
    timestamp: Date.now()
  };
  guild.warns[userId].push(warnEntry);
  saveDatabase();
  addLog('WARN', `User ${userId} was warned by ${moderatorId}: ${reason}`);
  return warnEntry;
}

function getWarns(guildId, userId) {
  const guild = ensureGuild(guildId);
  return guild.warns[userId] || [];
}

function clearWarns(guildId, userId) {
  const guild = ensureGuild(guildId);
  guild.warns[userId] = [];
  saveDatabase();
  addLog('MOD', `Cleared warnings for user ${userId} in guild ${guildId}`);
  return true;
}

// Ticket methods
function saveTicket(guildId, channelId, data) {
  const guild = ensureGuild(guildId);
  guild.tickets[channelId] = {
    ...data,
    updatedAt: Date.now()
  };
  saveDatabase();
  addLog('TICKET', `Ticket updated/saved in channel ${channelId}`);
}

function getTicket(guildId, channelId) {
  const guild = ensureGuild(guildId);
  return guild.tickets[channelId] || null;
}

function deleteTicket(guildId, channelId) {
  const guild = ensureGuild(guildId);
  if (guild.tickets && guild.tickets[channelId]) {
    delete guild.tickets[channelId];
    saveDatabase();
    addLog('TICKET', `Ticket in channel ${channelId} was deleted`);
  }
}

// Increment ticket counter
function getNextTicketNumber(guildId) {
  const guild = ensureGuild(guildId);
  if (!guild.ticket) {
    guild.ticket = { counter: 0 };
  }
  guild.ticket.counter = (guild.ticket.counter || 0) + 1;
  saveDatabase();
  return guild.ticket.counter;
}

// Leveling methods
function addXP(guildId, userId, amount) {
  const guild = ensureGuild(guildId);
  if (!guild.leveling.users[userId]) {
    guild.leveling.users[userId] = { xp: 0, level: 0, lastMessageTimestamp: 0 };
  }

  const userObj = guild.leveling.users[userId];
  const now = Date.now();

  // 45 second cooldown between XP gains
  if (now - userObj.lastMessageTimestamp < 45000) {
    return { leveledUp: false, userObj };
  }

  userObj.xp += amount;
  userObj.lastMessageTimestamp = now;

  // Level formula: level = floor(0.1 * sqrt(xp))
  const newLevel = Math.floor(0.1 * Math.sqrt(userObj.xp));
  let leveledUp = false;

  if (newLevel > userObj.level) {
    userObj.level = newLevel;
    leveledUp = true;
    addLog('LEVEL', `User ${userId} leveled up to Level ${newLevel}!`);
  }

  saveDatabase();
  return { leveledUp, level: newLevel, userObj };
}

function getUserLevel(guildId, userId) {
  const guild = ensureGuild(guildId);
  return guild.leveling.users[userId] || { xp: 0, level: 0 };
}

function getLeaderboard(guildId, limit = 10) {
  const guild = ensureGuild(guildId);
  const users = Object.entries(guild.leveling.users || {})
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
  return users;
}

function setUserXP(guildId, userId, xp, level) {
  const guild = ensureGuild(guildId);
  guild.leveling.users[userId] = {
    xp: xp || 0,
    level: level !== undefined ? level : Math.floor(0.1 * Math.sqrt(xp || 0)),
    lastMessageTimestamp: Date.now()
  };
  saveDatabase();
  return guild.leveling.users[userId];
}

// Giveaways methods
function saveGiveaway(guildId, messageId, data) {
  const guild = ensureGuild(guildId);
  guild.giveaways[messageId] = {
    ...data,
    updatedAt: Date.now()
  };
  saveDatabase();
  addLog('GIVEAWAY', `Giveaway saved on message ${messageId}`);
}

function getGiveaway(guildId, messageId) {
  const guild = ensureGuild(guildId);
  return guild.giveaways[messageId] || null;
}

function getAllGiveaways(guildId) {
  const guild = ensureGuild(guildId);
  return guild.giveaways || {};
}

// Backups methods
function saveBackup(guildId, backupId, data) {
  const guild = ensureGuild(guildId);
  guild.backups[backupId] = {
    ...data,
    createdAt: Date.now()
  };
  saveDatabase();
  addLog('BACKUP', `Server backup ${backupId} created.`);
}

function getBackup(guildId, backupId) {
  const guild = ensureGuild(guildId);
  return guild.backups[backupId] || null;
}

function getAllBackups(guildId) {
  const guild = ensureGuild(guildId);
  return guild.backups || {};
}

// Server Audit Logs methods
function addServerLog(guildId, logData) {
  const guild = ensureGuild(guildId);
  if (!guild.auditLogs) guild.auditLogs = [];
  const entry = {
    id: (Date.now() + Math.floor(Math.random() * 1000)).toString(36),
    timestamp: Date.now(),
    type: logData.type || 'SERVER',
    title: logData.title || '',
    description: logData.description || '',
    user: logData.user || null,
    channel: logData.channel || null,
    details: logData.details || null
  };
  guild.auditLogs.unshift(entry);
  if (guild.auditLogs.length > 500) {
    guild.auditLogs.pop();
  }
  saveDatabase();
  return entry;
}

function getServerLogs(guildId, category = null, limit = 100) {
  const guild = ensureGuild(guildId);
  let list = guild.auditLogs || [];
  if (category && category !== 'ALL') {
    list = list.filter(item => item.type.toUpperCase() === category.toUpperCase());
  }
  return list.slice(0, limit);
}

function clearServerLogs(guildId) {
  const guild = ensureGuild(guildId);
  guild.auditLogs = [];
  saveDatabase();
  return true;
}

function getStatBotConfig(guildId) {
  const guild = ensureGuild(guildId);
  return guild.statbot;
}

function updateStatBotConfig(guildId, data) {
  const guild = ensureGuild(guildId);
  guild.statbot = { ...guild.statbot, ...data };
  saveDatabase();
  return guild.statbot;
}

function getAllGuildTickets(guildId) {
  const guild = ensureGuild(guildId);
  return guild.tickets || {};
}

// -------------------------------------------------------------
// USER ACTIVITY & VOICE TRACKING (STATBOT STYLE)
// -------------------------------------------------------------
function getUserStats(guildId, userId) {
  const guild = ensureGuild(guildId);
  if (!guild.userStats) guild.userStats = {};
  if (!guild.userStats[userId]) {
    guild.userStats[userId] = {
      voiceSeconds: 0,
      voiceSessions: 0,
      messagesCount: 0,
      lastVoiceTimestamp: 0,
      lastMessageTimestamp: 0
    };
  }
  return guild.userStats[userId];
}

function addVoiceTime(guildId, userId, seconds, isNewSession = false) {
  const guild = ensureGuild(guildId);
  if (!guild.userStats) guild.userStats = {};
  if (!guild.userStats[userId]) {
    guild.userStats[userId] = {
      voiceSeconds: 0,
      voiceSessions: 0,
      messagesCount: 0,
      lastVoiceTimestamp: 0,
      lastMessageTimestamp: 0
    };
  }
  const u = guild.userStats[userId];
  u.voiceSeconds = (u.voiceSeconds || 0) + Math.max(0, Math.round(seconds));
  if (isNewSession) {
    u.voiceSessions = (u.voiceSessions || 0) + 1;
  }
  u.lastVoiceTimestamp = Date.now();
  saveDatabase();
  return u;
}

function incrementUserMessages(guildId, userId) {
  const guild = ensureGuild(guildId);
  if (!guild.userStats) guild.userStats = {};
  if (!guild.userStats[userId]) {
    guild.userStats[userId] = {
      voiceSeconds: 0,
      voiceSessions: 0,
      messagesCount: 0,
      lastVoiceTimestamp: 0,
      lastMessageTimestamp: 0
    };
  }
  const u = guild.userStats[userId];
  u.messagesCount = (u.messagesCount || 0) + 1;
  u.lastMessageTimestamp = Date.now();
  saveDatabase();
  return u;
}

function getVoiceLeaderboard(guildId, limit = 10) {
  const guild = ensureGuild(guildId);
  const stats = guild.userStats || {};
  const entries = Object.entries(stats)
    .filter(([_, data]) => (data.voiceSeconds || 0) > 0)
    .map(([userId, data]) => ({
      userId,
      voiceSeconds: data.voiceSeconds || 0,
      voiceSessions: data.voiceSessions || 0,
      messagesCount: data.messagesCount || 0,
      lastVoiceTimestamp: data.lastVoiceTimestamp || 0
    }))
    .sort((a, b) => b.voiceSeconds - a.voiceSeconds);

  return entries.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function getMessagesLeaderboard(guildId, limit = 10) {
  const guild = ensureGuild(guildId);
  const stats = guild.userStats || {};
  const entries = Object.entries(stats)
    .filter(([_, data]) => (data.messagesCount || 0) > 0)
    .map(([userId, data]) => ({
      userId,
      messagesCount: data.messagesCount || 0,
      voiceSeconds: data.voiceSeconds || 0,
      voiceSessions: data.voiceSessions || 0,
      lastMessageTimestamp: data.lastMessageTimestamp || 0
    }))
    .sort((a, b) => b.messagesCount - a.messagesCount);

  return entries.slice(0, limit).map((item, idx) => ({ ...item, rank: idx + 1 }));
}

function resetUserStats(guildId, userId, type = 'all') {
  const guild = ensureGuild(guildId);
  if (guild.userStats && guild.userStats[userId]) {
    if (type === 'all') {
      delete guild.userStats[userId];
    } else if (type === 'voice') {
      guild.userStats[userId].voiceSeconds = 0;
      guild.userStats[userId].voiceSessions = 0;
    } else if (type === 'messages') {
      guild.userStats[userId].messagesCount = 0;
    }
    saveDatabase();
  }
  return true;
}

function resetGuildStats(guildId, type = 'all') {
  const guild = ensureGuild(guildId);
  if (type === 'all') {
    guild.userStats = {};
  } else if (type === 'voice') {
    Object.values(guild.userStats || {}).forEach(u => {
      u.voiceSeconds = 0;
      u.voiceSessions = 0;
    });
  } else if (type === 'messages') {
    Object.values(guild.userStats || {}).forEach(u => {
      u.messagesCount = 0;
    });
  }
  saveDatabase();
  return true;
}

// -------------------------------------------------------------
// TRIGGER AUTO-RESPONDER ENGINE
// -------------------------------------------------------------
function getAutoResponders(guildId) {
  const guild = ensureGuild(guildId);
  return guild.autoresponders || {};
}

function saveAutoResponder(guildId, id, data) {
  const guild = ensureGuild(guildId);
  if (!guild.autoresponders) guild.autoresponders = {};

  const responderId = id || (Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
  guild.autoresponders[responderId] = {
    id: responderId,
    trigger: data.trigger ? data.trigger.trim() : '',
    matchType: data.matchType || 'contains', // 'exact', 'contains', 'startswith', 'endswith'
    replyType: data.replyType || 'embed', // 'text', 'embed'
    response: data.response || '',
    embedTitle: data.embedTitle || '',
    embedColor: data.embedColor || '#5865F2',
    thumbnail: data.thumbnail || '',
    banner: data.banner || '',
    footer: data.footer || '',
    mentionRoleId: data.mentionRoleId || null,
    deleteTrigger: Boolean(data.deleteTrigger),
    cooldown: Number(data.cooldown) || 5,
    enabled: data.enabled !== false,
    createdAt: data.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  saveDatabase();
  return guild.autoresponders[responderId];
}

function deleteAutoResponder(guildId, id) {
  const guild = ensureGuild(guildId);
  if (guild.autoresponders && guild.autoresponders[id]) {
    delete guild.autoresponders[id];
    saveDatabase();
    return true;
  }
  return false;
}

function toggleAutoResponder(guildId, id, enabled) {
  const guild = ensureGuild(guildId);
  if (guild.autoresponders && guild.autoresponders[id]) {
    guild.autoresponders[id].enabled = enabled !== undefined ? Boolean(enabled) : !guild.autoresponders[id].enabled;
// -------------------------------------------------------------
// TIKTOK NOTIFYME ENGINE
// -------------------------------------------------------------
function getTikTokTrackers(guildId) {
  const guild = ensureGuild(guildId);
  return guild.tiktokTrackers || {};
}

function saveTikTokTracker(guildId, id, data) {
  const guild = ensureGuild(guildId);
  if (!guild.tiktokTrackers) guild.tiktokTrackers = {};

  const cleanHandle = data.tiktokUsername ? data.tiktokUsername.replace(/^@/, '').trim() : '';
  const trackerId = id || (`tt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`);

  guild.tiktokTrackers[trackerId] = {
    id: trackerId,
    tiktokUsername: cleanHandle,
    channelId: data.channelId || null,
    mentionRoleId: data.mentionRoleId || null,
    customMessage: data.customMessage || '🔥 **{author}** is now **LIVE** on TikTok! Join the stream: {url}',
    notifyLive: data.notifyLive !== false,
    notifyVideo: data.notifyVideo !== false,
    embedTitle: data.embedTitle || '🔴 TikTok Live Stream Alert!',
    embedColor: data.embedColor || '#FE2C55',
    banner: data.banner || '',
    enabled: data.enabled !== false,
    lastLive: Boolean(data.lastLive),
    lastVideoId: data.lastVideoId || '',
    lastChecked: Date.now(),
    createdAt: data.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  saveDatabase();
  return guild.tiktokTrackers[trackerId];
}

function deleteTikTokTracker(guildId, id) {
  const guild = ensureGuild(guildId);
  if (guild.tiktokTrackers && guild.tiktokTrackers[id]) {
    delete guild.tiktokTrackers[id];
    saveDatabase();
    return true;
  }
  return false;
}

function toggleTikTokTracker(guildId, id, enabled) {
  const guild = ensureGuild(guildId);
  if (guild.tiktokTrackers && guild.tiktokTrackers[id]) {
    guild.tiktokTrackers[id].enabled = enabled !== undefined ? Boolean(enabled) : !guild.tiktokTrackers[id].enabled;
    guild.tiktokTrackers[id].updatedAt = Date.now();
    saveDatabase();
    return guild.tiktokTrackers[id];
  }
  return null;
}

// Initialize on require
loadDatabase();

module.exports = {
  getGuildConfig,
  updateGuildConfig,
  addWarn,
  getWarns,
  clearWarns,
  saveTicket,
  getTicket,
  deleteTicket,
  getNextTicketNumber,
  getAllGuildTickets,
  getStatBotConfig,
  updateStatBotConfig,
  addXP,
  getUserLevel,
  getLeaderboard,
  setUserXP,
  saveGiveaway,
  getGiveaway,
  getAllGiveaways,
  saveBackup,
  getBackup,
  getAllBackups,
  addLog,
  getRecentLogs,
  addServerLog,
  getServerLogs,
  clearServerLogs,
  clearConsoleLogs,
  // User Stats (StatBot style)
  getUserStats,
  addVoiceTime,
  incrementUserMessages,
  getVoiceLeaderboard,
  getMessagesLeaderboard,
  resetUserStats,
  resetGuildStats,
  // Trigger Auto-Responder Engine
  getAutoResponders,
  saveAutoResponder,
  deleteAutoResponder,
  toggleAutoResponder,
  // TikTok NotifyMe Engine
  getTikTokTrackers,
  saveTikTokTracker,
  deleteTikTokTracker,
  toggleTikTokTracker
};
