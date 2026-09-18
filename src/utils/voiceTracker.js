const db = require('../database/db');

// In-memory active voice sessions map
// Key: `${guildId}_${userId}`, Value: { guildId, userId, channelId, joinTime, isMuted, isDeaf }
const activeVoiceSessions = new Map();

/**
 * Format duration in seconds into a clean, human-readable string
 * e.g., "3d 4h 15m 30s" or "2h 45m" or "35s"
 */
function formatVoiceTime(totalSeconds) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Handle Discord VoiceStateUpdate event for a member
 */
async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guildId = (newState.guild || oldState.guild).id;
  const userId = member.user.id;
  const sessionKey = `${guildId}_${userId}`;
  const now = Date.now();

  // 1. Joined a Voice Channel
  if (!oldState.channelId && newState.channelId) {
    activeVoiceSessions.set(sessionKey, {
      guildId,
      userId,
      channelId: newState.channelId,
      joinTime: now,
      isMuted: newState.mute || newState.selfMute,
      isDeaf: newState.deaf || newState.selfDeaf
    });
    return;
  }

  // 2. Left Voice Channel
  if (oldState.channelId && !newState.channelId) {
    const session = activeVoiceSessions.get(sessionKey);
    if (session) {
      const durationSeconds = Math.max(0, (now - session.joinTime) / 1000);
      db.addVoiceTime(guildId, userId, durationSeconds, true);
      activeVoiceSessions.delete(sessionKey);
    }
    return;
  }

  // 3. Switched Voice Channel
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const session = activeVoiceSessions.get(sessionKey);
    if (session) {
      const durationSeconds = Math.max(0, (now - session.joinTime) / 1000);
      db.addVoiceTime(guildId, userId, durationSeconds, true);
    }
    // Start new session in target channel
    activeVoiceSessions.set(sessionKey, {
      guildId,
      userId,
      channelId: newState.channelId,
      joinTime: now,
      isMuted: newState.mute || newState.selfMute,
      isDeaf: newState.deaf || newState.selfDeaf
    });
    return;
  }

  // 4. Mute / Deafen state changes
  if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
    const session = activeVoiceSessions.get(sessionKey);
    if (session) {
      session.isMuted = newState.mute || newState.selfMute;
      session.isDeaf = newState.deaf || newState.selfDeaf;
    }
  }
}

/**
 * Scan all guilds and active voice channels on bot startup
 */
function initGuildVoiceMembers(client) {
  if (!client.guilds || !client.guilds.cache) return;
  const now = Date.now();
  let trackedCount = 0;

  client.guilds.cache.forEach(guild => {
    if (!guild.channels || !guild.channels.cache) return;

    guild.channels.cache.forEach(channel => {
      if (channel.isVoiceBased && channel.isVoiceBased() && channel.members) {
        channel.members.forEach(member => {
          if (!member.user.bot) {
            const sessionKey = `${guild.id}_${member.user.id}`;
            activeVoiceSessions.set(sessionKey, {
              guildId: guild.id,
              userId: member.user.id,
              channelId: channel.id,
              joinTime: now,
              isMuted: member.voice.mute || member.voice.selfMute,
              isDeaf: member.voice.deaf || member.voice.selfDeaf
            });
            trackedCount++;
          }
        });
      }
    });
  });

  if (trackedCount > 0) {
    console.log(`🎙️ [VOICE TRACKER] Initialized tracking for ${trackedCount} active voice member(s).`);
  }
}

/**
 * Periodic flush (every 60 seconds) to save ongoing voice sessions incrementally to database
 */
function startVoiceTrackerScheduler(client) {
  // Initialize current members immediately
  initGuildVoiceMembers(client);

  setInterval(() => {
    try {
      const now = Date.now();
      activeVoiceSessions.forEach((session, key) => {
        const elapsedSec = (now - session.joinTime) / 1000;
        if (elapsedSec >= 20) {
          // Increment cumulative voice time
          db.addVoiceTime(session.guildId, session.userId, elapsedSec, false);
          // Advance joinTime to now
          session.joinTime = now;
        }
      });
    } catch (err) {
      console.error('[VOICE TRACKER] Error during periodic flush:', err);
    }
  }, 60 * 1000);

  console.log('🎙️ [VOICE TRACKER] Voice activity tracking scheduler running (flush every 60s)...');
}

/**
 * Get active voice session info for a member if currently in voice
 */
function getActiveVoiceSession(guildId, userId) {
  const session = activeVoiceSessions.get(`${guildId}_${userId}`);
  if (!session) return null;
  const currentDurationSec = (Date.now() - session.joinTime) / 1000;
  return {
    ...session,
    currentSessionSeconds: currentDurationSec
  };
}

module.exports = {
  formatVoiceTime,
  handleVoiceStateUpdate,
  initGuildVoiceMembers,
  startVoiceTrackerScheduler,
  getActiveVoiceSession
};
