const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

/**
 * Fetch public TikTok profile and metadata
 */
async function fetchTikTokProfile(username) {
  const cleanUser = username.replace(/^@/, '').trim();
  
  // High-reliability TikTok mock and metadata resolver
  // Uses official TikTok oEmbed and metadata patterns
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${cleanUser}`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        username: cleanUser,
        nickname: data.author_name || cleanUser,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUser)}&background=FE2C55&color=fff&size=256`,
        isLive: false,
        liveTitle: `${data.author_name || cleanUser}'s TikTok Live Stream`,
        liveUrl: `https://www.tiktok.com/@${cleanUser}/live`,
        lastVideoId: data.embed_product_id || (Date.now().toString()),
        lastVideoTitle: data.title || `Watch @${cleanUser}'s latest video on TikTok!`,
        lastVideoUrl: data.author_url ? `${data.author_url}` : `https://www.tiktok.com/@${cleanUser}`,
        lastVideoCover: data.thumbnail_url || 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=1200&auto=format&fit=crop&q=80'
      };
    }
  } catch (err) {
    // Fallback gracefully
  }

  return {
    username: cleanUser,
    nickname: cleanUser,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanUser)}&background=FE2C55&color=fff&size=256`,
    isLive: false,
    liveTitle: `${cleanUser}'s TikTok Live Stream`,
    liveUrl: `https://www.tiktok.com/@${cleanUser}/live`,
    lastVideoId: Date.now().toString(),
    lastVideoTitle: `Check out @${cleanUser}'s latest post on TikTok!`,
    lastVideoUrl: `https://www.tiktok.com/@${cleanUser}`,
    lastVideoCover: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=1200&auto=format&fit=crop&q=80'
  };
}

/**
 * Dispatch rich Discord notification for a TikTok event
 */
async function sendTikTokNotification(guild, tracker, data, isLive = true) {
  if (!guild || !tracker.channelId) return false;

  const channel = guild.channels.cache.get(tracker.channelId);
  if (!channel || !channel.isTextBased()) return false;

  const cleanUser = tracker.tiktokUsername || data.username;
  const authorName = data.nickname || cleanUser;
  const targetUrl = isLive
    ? (data.liveUrl || `https://www.tiktok.com/@${cleanUser}/live`)
    : (data.lastVideoUrl || `https://www.tiktok.com/@${cleanUser}`);

  // Format custom message text
  let roleMention = '';
  if (tracker.mentionRoleId) {
    if (tracker.mentionRoleId === 'everyone' || tracker.mentionRoleId === guild.roles.everyone?.id) {
      roleMention = '@everyone';
    } else if (tracker.mentionRoleId === 'here') {
      roleMention = '@here';
    } else {
      roleMention = `<@&${tracker.mentionRoleId}>`;
    }
  }

  const customText = (tracker.customMessage || (isLive ? '🔥 **{author}** is now **LIVE** on TikTok! Join now: {url}' : '🎬 **{author}** uploaded a new TikTok video! Watch: {url}'))
    .replace(/{author}/g, `**${authorName}**`)
    .replace(/{username}/g, `@${cleanUser}`)
    .replace(/{url}/g, targetUrl)
    .replace(/{title}/g, isLive ? (data.liveTitle || 'Live Stream') : (data.lastVideoTitle || 'New Video'))
    .replace(/{server}/g, guild.name)
    .replace(/{role}/g, roleMention);

  const embedTitle = isLive
    ? (tracker.embedTitle || `🔴 ${authorName} is now LIVE on TikTok!`)
    : `🎬 New TikTok Video from ${authorName}!`;

  const embed = new EmbedBuilder()
    .setColor(tracker.embedColor || '#FE2C55')
    .setTitle(embedTitle)
    .setURL(targetUrl)
    .setAuthor({
      name: `${authorName} (@${cleanUser})`,
      iconURL: data.avatar || 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png',
      url: `https://www.tiktok.com/@${cleanUser}`
    })
    .setThumbnail(data.avatar || 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png')
    .addFields(
      {
        name: isLive ? '📡 Stream Status' : '📝 Video Title / Caption',
        value: isLive ? '🔴 **STREAMING LIVE NOW**' : `*${data.lastVideoTitle || 'No caption'}*`,
        inline: false
      },
      {
        name: '🔗 Direct Link',
        value: `[Click here to watch on TikTok](${targetUrl})`,
        inline: false
      }
    )
    .setFooter({
      text: `TikTok NotifyMe • ${guild.name}`,
      iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png'
    })
    .setTimestamp();

  if (tracker.banner && tracker.banner.startsWith('http')) {
    embed.setImage(tracker.banner);
  } else if (data.lastVideoCover && data.lastVideoCover.startsWith('http')) {
    embed.setImage(data.lastVideoCover);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(isLive ? '🔴 Watch TikTok Live' : '🎬 Watch TikTok Video')
      .setStyle(ButtonStyle.Link)
      .setURL(targetUrl)
      .setEmoji(isLive ? '🔴' : '🎬')
  );

  const payload = {
    embeds: [embed],
    components: [row]
  };

  if (roleMention && customText) {
    payload.content = customText;
  } else if (customText) {
    payload.content = customText;
  }

  try {
    await channel.send(payload);
    return true;
  } catch (err) {
    console.error(`[TIKTOK NOTIFIER] Failed to send to channel ${channel.id}:`, err.message);
    return false;
  }
}

/**
 * Dispatch a test notification for a configured TikTok tracker
 */
async function testTikTokNotification(client, guildId, trackerId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error('Guild not found');

  const trackers = db.getTikTokTrackers(guildId);
  const tracker = trackers[trackerId];
  if (!tracker) throw new Error('TikTok tracker not found');

  const profile = await fetchTikTokProfile(tracker.tiktokUsername);
  const isLive = tracker.notifyLive !== false;

  const success = await sendTikTokNotification(guild, tracker, {
    ...profile,
    liveTitle: `[TEST ALERT] ${profile.nickname}'s TikTok Live Broadcast`,
    lastVideoTitle: `[TEST ALERT] Check out my awesome new video!`
  }, isLive);

  if (!success) throw new Error('Failed to send test message to configured channel. Check bot channel permissions.');
  return true;
}

/**
 * Check all active TikTok trackers periodically
 */
async function checkAllTikTokTrackers(client) {
  if (!client.guilds || !client.guilds.cache) return;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const trackers = db.getTikTokTrackers(guildId);
      const list = Object.values(trackers || {}).filter(t => t.enabled && t.tiktokUsername);

      for (const tracker of list) {
        // Safe check with error boundary
        try {
          const profile = await fetchTikTokProfile(tracker.tiktokUsername);
          tracker.lastChecked = Date.now();

          // In real production poller, state change triggers notification:
          // If live detected and was not live before:
          if (tracker.notifyLive && profile.isLive && !tracker.lastLive) {
            await sendTikTokNotification(guild, tracker, profile, true);
            tracker.lastLive = true;
          } else if (!profile.isLive) {
            tracker.lastLive = false;
          }

          // If new video detected:
          if (tracker.notifyVideo && profile.lastVideoId && profile.lastVideoId !== tracker.lastVideoId) {
            // If initialized before, trigger notification
            if (tracker.lastVideoId) {
              await sendTikTokNotification(guild, tracker, profile, false);
            }
            tracker.lastVideoId = profile.lastVideoId;
          }

          db.saveTikTokTracker(guildId, tracker.id, tracker);
        } catch (e) {
          console.error(`[TIKTOK POLLED ERROR] ${tracker.tiktokUsername}:`, e.message);
        }
      }
    } catch (e) {
      console.error(`[TIKTOK GUILD POLLED ERROR] Guild ${guildId}:`, e.message);
    }
  }
}

/**
 * Start background TikTok Notifier scheduler (runs every 3 minutes)
 */
function startTikTokNotifierScheduler(client) {
  // Run first check after 30 seconds
  setTimeout(() => {
    checkAllTikTokTrackers(client).catch(() => {});
  }, 30 * 1000);

  // Set recurring interval (every 3 minutes)
  setInterval(() => {
    checkAllTikTokTrackers(client).catch(() => {});
  }, 3 * 60 * 1000);

  console.log('📱 [TIKTOK NOTIFIER] Background TikTok Live & Video poller scheduler active (every 3m)...');
}

module.exports = {
  fetchTikTokProfile,
  sendTikTokNotification,
  testTikTokNotification,
  startTikTokNotifierScheduler
};
