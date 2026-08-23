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
        categoryId: null,
        staffRoleId: null,
        counter: 0
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
  getRecentLogs
};
