const express = require('express');
const path = require('path');
const os = require('os');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const config = require('../../config.json');
const { sendGuildLog } = require('../utils/logger');
const { getGuildStats, updateGuildStats, setupStatChannels, deleteStatChannels } = require('../utils/statbot');
const { formatVoiceTime, getActiveVoiceSession } = require('../utils/voiceTracker');
const { testTikTokNotification, fetchTikTokProfile } = require('../utils/tiktokNotifier');

function startDashboard(client) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Health check endpoint for uptime monitoring & hosting health checks
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), botStatus: client.isReady() ? 'connected' : 'connecting' });
  });

  // -------------------------------------------------------------
  // API: BOT GENERAL STATS
  // -------------------------------------------------------------
  app.get('/api/stats', (req, res) => {
    try {
      const uptimeSec = Math.floor((client.uptime || 0) / 1000);
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;

      let totalWarnsCount = 0;
      let totalTicketsCount = 0;
      let totalGiveawaysCount = 0;

      if (client.guilds && client.guilds.cache) {
        client.guilds.cache.forEach(g => {
          const gConf = db.getGuildConfig(g.id);
          if (gConf && gConf.warns) {
            Object.values(gConf.warns).forEach(arr => totalWarnsCount += arr.length);
          }
          if (gConf && gConf.tickets) {
            totalTicketsCount += Object.keys(gConf.tickets).length;
          }
          if (gConf && gConf.giveaways) {
            totalGiveawaysCount += Object.keys(gConf.giveaways).length;
          }
        });
      }

      const guildsCount = client.guilds?.cache?.size || 0;
      const usersCount = client.guilds?.cache ? client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) : 0;

      res.json({
        botName: client.user?.username || 'Discord Bot',
        botTag: client.user?.tag || 'Bot#0000',
        botAvatar: client.user?.displayAvatarURL ? client.user.displayAvatarURL({ size: 256 }) : 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
        status: client.ws?.status === 0 ? 'online' : 'connecting',
        ping: client.ws?.ping ? Math.round(client.ws.ping) : 0,
        uptime: `${days}d ${hours}h ${minutes}m ${seconds}s`,
        guildsCount: guildsCount,
        usersCount: usersCount,
        memoryUsedMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
        totalMemoryGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(1),
        totalTickets: totalTicketsCount,
        totalWarns: totalWarnsCount,
        totalGiveaways: totalGiveawaysCount
      });
    } catch (err) {
      console.error('[STATS API ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: GUILDS LIST
  // -------------------------------------------------------------
  app.get('/api/guilds', (req, res) => {
    try {
      if (!client.guilds || !client.guilds.cache) {
        return res.json([]);
      }

      const guilds = client.guilds.cache.map(guild => {
        const textChannels = guild.channels?.cache
          ? guild.channels.cache
              .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
              .map(c => ({ id: c.id, name: c.name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];

        const categories = guild.channels?.cache
          ? guild.channels.cache
              .filter(c => c.type === ChannelType.GuildCategory)
              .map(c => ({ id: c.id, name: c.name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];

        const roles = guild.roles?.cache
          ? guild.roles.cache
              .filter(r => r.id !== guild.id)
              .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];

        return {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL ? guild.iconURL({ dynamic: true, size: 128 }) : null,
          memberCount: guild.memberCount || 0,
          channels: textChannels,
          categories: categories,
          roles: roles
        };
      });

      res.json(guilds);
    } catch (err) {
      console.error('[GUILDS API ERROR]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: GET SPECIFIC GUILD CONFIG & DATA
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/config', (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const guildConfig = db.getGuildConfig(guildId);
      res.json({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL ? guild.iconURL({ dynamic: true, size: 128 }) : null,
        memberCount: guild.memberCount,
        config: guildConfig
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================================
  // COMMAND ACTIONS API (FULL DISCORD COMMANDS FROM WEB)
  // =============================================================

  // 1. BAN ACTION
  app.post('/api/guild/:guildId/action/ban', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, reason, deleteDays } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      await guild.bans.create(userId, {
        reason: `Dashboard: ${reason || 'Banned via Web Dashboard'}`,
        deleteMessageSeconds: (parseInt(deleteDays, 10) || 0) * 86400
      });

      db.addLog('MOD', `Banned user ${userId} via Dashboard: ${reason || 'No reason'}`);
      res.json({ success: true, message: `Successfully banned user ${userId}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. UNBAN ACTION
  app.post('/api/guild/:guildId/action/unban', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, reason } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      await guild.bans.remove(userId, `Dashboard: ${reason || 'Unbanned via Web Dashboard'}`);
      db.addLog('MOD', `Unbanned user ${userId} via Dashboard`);
      res.json({ success: true, message: `Successfully unbanned user ${userId}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. KICK ACTION
  app.post('/api/guild/:guildId/action/kick', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, reason } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found in server' });

      await member.kick(`Dashboard: ${reason || 'Kicked via Web Dashboard'}`);
      db.addLog('MOD', `Kicked user ${member.user.tag} via Dashboard`);
      res.json({ success: true, message: `Successfully kicked ${member.user.tag}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. TIMEOUT / MUTE ACTION
  app.post('/api/guild/:guildId/action/timeout', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, durationMinutes, reason } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const ms = (parseInt(durationMinutes, 10) || 5) * 60 * 1000;
      await member.timeout(ms, `Dashboard: ${reason || 'Timeout via Web Dashboard'}`);
      db.addLog('MOD', `Timed out ${member.user.tag} for ${durationMinutes} minutes`);
      res.json({ success: true, message: `Timed out ${member.user.tag} for ${durationMinutes}m` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. UNTIMEOUT ACTION
  app.post('/api/guild/:guildId/action/untimeout', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      await member.timeout(null, 'Removed timeout via Web Dashboard');
      db.addLog('MOD', `Removed timeout for ${member.user.tag}`);
      res.json({ success: true, message: `Removed timeout for ${member.user.tag}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. WARN ACTION
  app.post('/api/guild/:guildId/action/warn', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, reason } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const warn = db.addWarn(guildId, userId, client.user.id, `Dashboard: ${reason || 'Warning via Web Dashboard'}`);
      res.json({ success: true, message: `Issued warning to user ${userId} (ID: ${warn.id})` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. PURGE MESSAGES
  app.post('/api/guild/:guildId/action/purge', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, amount } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const count = Math.min(100, Math.max(1, parseInt(amount, 10) || 10));
      const deleted = await channel.bulkDelete(count, true);

      db.addLog('MOD', `Purged ${deleted.size} messages in #${channel.name}`);
      res.json({ success: true, message: `Purged ${deleted.size} messages in #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. LOCK CHANNEL
  app.post('/api/guild/:guildId/action/lock', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, reason } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      }, { reason: `Dashboard: ${reason || 'Channel locked via Web Dashboard'}` });

      db.addLog('MOD', `Locked channel #${channel.name}`);
      res.json({ success: true, message: `Channel #${channel.name} is now locked!` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. UNLOCK CHANNEL
  app.post('/api/guild/:guildId/action/unlock', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      }, { reason: 'Channel unlocked via Web Dashboard' });

      db.addLog('MOD', `Unlocked channel #${channel.name}`);
      res.json({ success: true, message: `Channel #${channel.name} is now unlocked!` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. SLOWMODE
  app.post('/api/guild/:guildId/action/slowmode', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, seconds } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const sec = parseInt(seconds, 10) || 0;
      await channel.setRateLimitPerUser(sec, 'Set via Web Dashboard');

      db.addLog('MOD', `Set slowmode to ${sec}s in #${channel.name}`);
      res.json({ success: true, message: `Slowmode set to ${sec}s for #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. NUKE CHANNEL
  app.post('/api/guild/:guildId/action/nuke', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const pos = channel.position;
      const topic = channel.topic;

      const newChannel = await channel.clone({
        name: channel.name,
        permissions: channel.permissionOverwrites.cache,
        topic: topic,
        position: pos,
        reason: 'Nuked via Web Dashboard'
      });

      await channel.delete('Nuked via Web Dashboard');

      const embed = new EmbedBuilder()
        .setColor(config.errorColor)
        .setTitle('💥 Channel Nuked!')
        .setDescription('This channel was completely nuked and recreated via Web Dashboard.')
        .setImage('https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif')
        .setTimestamp();

      await newChannel.send({ embeds: [embed] });
      db.addLog('MOD', `Nuked and recreated channel #${newChannel.name}`);
      res.json({ success: true, message: `Nuked and recreated #${newChannel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. ROLE MANAGE (ADD/REMOVE)
  app.post('/api/guild/:guildId/action/role', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, roleId, action } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      const role = guild.roles.cache.get(roleId);
      if (!role) return res.status(404).json({ error: 'Role not found' });

      if (action === 'add') {
        await member.roles.add(role);
        db.addLog('MOD', `Added role @${role.name} to ${member.user.tag}`);
        res.json({ success: true, message: `Added @${role.name} to ${member.user.tag}` });
      } else {
        await member.roles.remove(role);
        db.addLog('MOD', `Removed role @${role.name} from ${member.user.tag}`);
        res.json({ success: true, message: `Removed @${role.name} from ${member.user.tag}` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. NICKNAME CHANGE
  app.post('/api/guild/:guildId/action/nick', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, nickname } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });

      await member.setNickname(nickname || null, 'Changed via Web Dashboard');
      db.addLog('MOD', `Updated nickname for ${member.user.tag} to ${nickname || '(default)'}`);
      res.json({ success: true, message: `Nickname updated for ${member.user.tag}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. CREATE COMMUNITY POLL
  app.post('/api/guild/:guildId/action/poll', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, question, optionsRaw } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      if (!optionsRaw || optionsRaw.trim() === '') {
        const embed = new EmbedBuilder()
          .setColor(config.defaultColor)
          .setTitle('📊 Community Poll')
          .setDescription(`**${question}**\n\n👍 = Yes / بەڵێ\n👎 = No / نەخێر`)
          .setFooter({ text: 'Community Poll via Dashboard' })
          .setTimestamp();

        const pollMsg = await channel.send({ embeds: [embed] });
        await pollMsg.react('👍');
        await pollMsg.react('👎');
      } else {
        const options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);
        const formatted = options.map((opt, i) => `${numberEmojis[i]} **${opt}**`).join('\n\n');

        const embed = new EmbedBuilder()
          .setColor(config.defaultColor)
          .setTitle('📊 Community Poll')
          .setDescription(`**${question}**\n\n${formatted}`)
          .setFooter({ text: 'Community Poll via Dashboard' })
          .setTimestamp();

        const pollMsg = await channel.send({ embeds: [embed] });
        for (let i = 0; i < options.length; i++) {
          await pollMsg.react(numberEmojis[i]);
        }
      }

      db.addLog('POLL', `Created poll in #${channel.name}`);
      res.json({ success: true, message: `Poll posted to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. OFFICIAL ANNOUNCEMENT
  app.post('/api/guild/:guildId/action/announce', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, title, message, ping, imageUrl, thumbnailUrl, color, footer } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      let validColor = color || config.defaultColor;
      if (!validColor.startsWith('#')) validColor = `#${validColor}`;

      const embed = new EmbedBuilder()
        .setColor(validColor)
        .setTitle(`📢 ${title}`)
        .setDescription(message)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined })
        .setFooter({ text: footer || 'Official Announcement via Dashboard' })
        .setTimestamp();

      if (imageUrl) {
        try { embed.setImage(imageUrl); } catch (e) {}
      }
      if (thumbnailUrl) {
        try { embed.setThumbnail(thumbnailUrl); } catch (e) {}
      }

      let content = undefined;
      if (ping === '@everyone') content = '@everyone';
      if (ping === '@here') content = '@here';

      await channel.send({ content, embeds: [embed] });
      db.addLog('ANNOUNCE', `Announcement published in #${channel.name}`);
      res.json({ success: true, message: `Announcement sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. DEPLOY TICKET PANEL (ENHANCED WITH BANNER, THUMBNAIL, COLOR, BUTTONS)
  app.post('/api/guild/:guildId/action/ticket-setup', async (req, res) => {
    try {
      const { guildId } = req.params;
      const {
        channelId,
        categoryId,
        staffRoleId,
        title,
        description,
        color,
        banner,
        thumbnail,
        footer,
        buttonLabel,
        buttonEmoji,
        buttonStyle
      } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const finalTitle = title || '📩 Support & Help Desk';
      const finalDesc = description || 'Need assistance, want to report an issue, or talk to our staff team?\n\nClick the **Create Ticket** button below to open a private support room with our staff.';
      let finalColor = color || config.defaultColor;
      if (!finalColor.startsWith('#')) finalColor = `#${finalColor}`;
      const finalFooter = footer || `${guild.name} • Official Support System`;
      const finalBtnLabel = buttonLabel || 'Create Ticket';
      const finalBtnEmoji = buttonEmoji || '📩';
      const finalBtnStyle = buttonStyle || 'Primary';

      const currentTicketConf = db.getGuildConfig(guildId).ticket || {};

      db.updateGuildConfig(guildId, 'ticket', {
        ...currentTicketConf,
        enabled: true,
        categoryId: categoryId || currentTicketConf.categoryId || null,
        staffRoleId: staffRoleId || currentTicketConf.staffRoleId || null,
        panel: {
          title: finalTitle,
          description: finalDesc,
          color: finalColor,
          banner: banner || '',
          thumbnail: thumbnail || '',
          footer: finalFooter,
          buttonLabel: finalBtnLabel,
          buttonEmoji: finalBtnEmoji,
          buttonStyle: finalBtnStyle,
          channelId: channel.id
        }
      });

      const embed = new EmbedBuilder()
        .setColor(finalColor)
        .setTitle(finalTitle)
        .setDescription(finalDesc)
        .addFields(
          { name: '🔒 Private & Secure', value: 'Only you and server staff can view your ticket.', inline: true },
          { name: '⚡ Fast Support', value: 'A staff member will assist you shortly.', inline: true }
        )
        .setFooter({ text: finalFooter, iconURL: guild.iconURL() || undefined })
        .setTimestamp();

      if (thumbnail) {
        try { embed.setThumbnail(thumbnail); } catch (e) {}
      } else {
        embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || undefined);
      }

      if (banner) {
        try { embed.setImage(banner); } catch (e) {}
      }

      const styleMap = {
        Primary: ButtonStyle.Primary,
        Success: ButtonStyle.Success,
        Danger: ButtonStyle.Danger,
        Secondary: ButtonStyle.Secondary
      };

      const btn = new ButtonBuilder()
        .setCustomId('create_ticket_btn')
        .setLabel(finalBtnLabel)
        .setStyle(styleMap[finalBtnStyle] || ButtonStyle.Primary);

      if (finalBtnEmoji) {
        try { btn.setEmoji(finalBtnEmoji); } catch (e) {}
      }

      const row = new ActionRowBuilder().addComponents(btn);

      await channel.send({ embeds: [embed], components: [row] });
      db.addLog('TICKET', `Ticket panel deployed to #${channel.name}`);
      res.json({ success: true, message: `Ticket panel deployed to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // TICKET CONFIGURATION (PANEL + INSIDE WELCOME)
  app.post('/api/guild/:guildId/ticket/config', (req, res) => {
    try {
      const { guildId } = req.params;
      const { categoryId, staffRoleId, panel, insideWelcome } = req.body;

      const current = db.getGuildConfig(guildId).ticket || {};
      const updated = db.updateGuildConfig(guildId, 'ticket', {
        ...current,
        categoryId: categoryId !== undefined ? categoryId : current.categoryId,
        staffRoleId: staffRoleId !== undefined ? staffRoleId : current.staffRoleId,
        panel: panel ? { ...current.panel, ...panel } : current.panel,
        insideWelcome: insideWelcome ? { ...current.insideWelcome, ...insideWelcome } : current.insideWelcome
      });

      db.addLog('CONFIG', `Updated ticket system configuration for guild ${guildId}`);
      res.json({ success: true, ticket: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET ALL TICKETS WITH RICH ENRICHED DATA
  app.get('/api/guild/:guildId/tickets', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      const rawTickets = db.getAllGuildTickets(guildId);

      const list = await Promise.all(
        Object.entries(rawTickets).map(async ([channelId, data]) => {
          let channelName = `ticket-${data.ticketNumber || '0000'}`;
          let existsOnDiscord = false;

          if (guild) {
            const ch = guild.channels.cache.get(channelId);
            if (ch) {
              channelName = ch.name;
              existsOnDiscord = true;
            }
          }

          let ownerTag = `User (${data.ownerId || 'N/A'})`;
          let ownerAvatar = null;
          if (data.ownerId) {
            try {
              const u = await client.users.fetch(data.ownerId).catch(() => null);
              if (u) {
                ownerTag = u.tag;
                ownerAvatar = u.displayAvatarURL({ size: 128 });
              }
            } catch (e) {}
          }

          let claimedByTag = null;
          if (data.claimedBy) {
            try {
              const cu = await client.users.fetch(data.claimedBy).catch(() => null);
              if (cu) claimedByTag = cu.tag;
            } catch (e) {}
          }

          return {
            channelId,
            channelName,
            existsOnDiscord,
            ownerId: data.ownerId,
            ownerTag,
            ownerAvatar,
            ticketNumber: data.ticketNumber || '#',
            status: data.status || (existsOnDiscord ? 'open' : 'closed'),
            claimedBy: data.claimedBy,
            claimedByTag,
            createdAt: data.createdAt || Date.now(),
            closedAt: data.closedAt || null
          };
        })
      );

      // Sort newest first
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // TICKET ACTIONS FROM DASHBOARD (CLOSE, REOPEN, CLAIM, DELETE, ADD-USER, REMOVE-USER, SEND-MESSAGE)
  app.post('/api/guild/:guildId/ticket/:channelId/action', async (req, res) => {
    try {
      const { guildId, channelId } = req.params;
      const { action, userId, message } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      const ticketData = db.getTicket(guildId, channelId) || {};

      if (action === 'close') {
        if (channel && ticketData.ownerId) {
          await channel.permissionOverwrites.edit(ticketData.ownerId, { SendMessages: false }).catch(() => {});
        }

        db.saveTicket(guildId, channelId, {
          ...ticketData,
          status: 'closed',
          closedBy: client.user.id,
          closedAt: Date.now()
        });

        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(config.warningColor || '#FEE75C')
            .setTitle('🔒 Ticket Closed via Dashboard')
            .setDescription('This ticket has been closed by server administrators from the Web Dashboard.')
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch(() => {});
        }

        db.addLog('TICKET', `Ticket in #${channel?.name || channelId} closed via Dashboard`);
        return res.json({ success: true, message: 'Ticket closed successfully' });
      }

      if (action === 'reopen') {
        if (channel && ticketData.ownerId) {
          await channel.permissionOverwrites.edit(ticketData.ownerId, { SendMessages: true, ViewChannel: true }).catch(() => {});
        }

        db.saveTicket(guildId, channelId, {
          ...ticketData,
          status: 'open'
        });

        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(config.successColor || '#57F287')
            .setTitle('🔓 Ticket Reopened via Dashboard')
            .setDescription('This ticket has been reopened from the Web Dashboard.')
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch(() => {});
        }

        db.addLog('TICKET', `Ticket in #${channel?.name || channelId} reopened via Dashboard`);
        return res.json({ success: true, message: 'Ticket reopened successfully' });
      }

      if (action === 'claim') {
        db.saveTicket(guildId, channelId, {
          ...ticketData,
          claimedBy: client.user.id
        });

        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(config.successColor || '#57F287')
            .setDescription(`📌 **Ticket Claimed**: Server Management Team via Dashboard will be handling this ticket.`)
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch(() => {});
        }

        db.addLog('TICKET', `Ticket in #${channel?.name || channelId} claimed via Dashboard`);
        return res.json({ success: true, message: 'Ticket claimed successfully' });
      }

      if (action === 'delete') {
        db.deleteTicket(guildId, channelId);
        if (channel) {
          await channel.delete('Deleted via Web Dashboard').catch(() => {});
        }
        db.addLog('TICKET', `Ticket channel #${channel?.name || channelId} deleted via Dashboard`);
        return res.json({ success: true, message: 'Ticket deleted successfully' });
      }

      if (action === 'send-message') {
        if (!channel) return res.status(404).json({ error: 'Ticket channel no longer exists on Discord' });
        if (!message || message.trim() === '') return res.status(400).json({ error: 'Message cannot be empty' });

        const embed = new EmbedBuilder()
          .setColor(config.defaultColor || '#5865F2')
          .setAuthor({ name: 'Staff Support (Dashboard)', iconURL: client.user.displayAvatarURL() })
          .setDescription(message)
          .setFooter({ text: 'Official Support Message' })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
        db.addLog('TICKET', `Sent staff message to #${channel.name} from Dashboard`);
        return res.json({ success: true, message: `Message sent to #${channel.name}` });
      }

      if (action === 'add-user') {
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        await channel.permissionOverwrites.edit(userId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        });

        const embed = new EmbedBuilder()
          .setColor(config.successColor)
          .setDescription(`➕ Added <@${userId}> to this ticket via Dashboard.`)
          .setTimestamp();
        await channel.send({ embeds: [embed] });

        return res.json({ success: true, message: `Added user ${userId} to ticket` });
      }

      if (action === 'remove-user') {
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        await channel.permissionOverwrites.edit(userId, { ViewChannel: false });

        const embed = new EmbedBuilder()
          .setColor(config.warningColor)
          .setDescription(`➖ Removed <@${userId}> from this ticket via Dashboard.`)
          .setTimestamp();
        await channel.send({ embeds: [embed] });

        return res.json({ success: true, message: `Removed user ${userId} from ticket` });
      }

      res.status(400).json({ error: 'Unknown ticket action' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. TEST WELCOME / TEST GOODBYE
  app.post('/api/guild/:guildId/action/testwelcome', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const conf = db.getGuildConfig(guildId).welcome;
      if (!conf?.channelId) return res.status(400).json({ error: 'Welcome channel not configured yet!' });

      const channel = guild.channels.cache.get(conf.channelId);
      if (!channel) return res.status(404).json({ error: 'Configured welcome channel not found!' });

      const raw = conf.message || 'Welcome {user} to **{server}**! You are member #{memberCount}.';
      const formatted = raw
        .replace(/{user}/g, `**${client.user.tag}**`)
        .replace(/{userName}/g, client.user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount.toString());

      if (conf.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(conf.color || config.successColor)
          .setTitle(`👋 Welcome to ${guild.name}! (TEST PREVIEW)`)
          .setDescription(formatted)
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: 'Welcome test preview triggered from Web Dashboard' })
          .setTimestamp();

        if (conf.image) embed.setImage(conf.image);
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: `[TEST PREVIEW] ${formatted}` });
      }

      db.addLog('CONFIG', `Triggered test welcome in #${channel.name}`);
      res.json({ success: true, message: `Test welcome sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/action/testgoodbye', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const conf = db.getGuildConfig(guildId).goodbye;
      if (!conf?.channelId) return res.status(400).json({ error: 'Goodbye channel not configured yet!' });

      const channel = guild.channels.cache.get(conf.channelId);
      if (!channel) return res.status(404).json({ error: 'Configured goodbye channel not found!' });

      const raw = conf.message || '{user} has left **{server}**. We now have {memberCount} members.';
      const formatted = raw
        .replace(/{user}/g, `**${client.user.tag}**`)
        .replace(/{userName}/g, client.user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount.toString());

      if (conf.isEmbed) {
        const embed = new EmbedBuilder()
          .setColor(conf.color || config.errorColor)
          .setTitle(`🚪 Goodbye! (TEST PREVIEW)`)
          .setDescription(formatted)
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: 'Goodbye test preview triggered from Web Dashboard' })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: `[TEST PREVIEW] ${formatted}` });
      }

      db.addLog('CONFIG', `Triggered test goodbye in #${channel.name}`);
      res.json({ success: true, message: `Test goodbye sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 18. SET MEMBER XP
  app.post('/api/guild/:guildId/action/setxp', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, xp, level } = req.body;

      const updated = db.setUserXP(guildId, userId, parseInt(xp, 10) || 0, level ? parseInt(level, 10) : undefined);
      db.addLog('LEVEL', `Updated XP for user ${userId} to ${updated.xp} (Level ${updated.level})`);
      res.json({ success: true, message: `Set user ${userId} to Level ${updated.level} (${updated.xp} XP)` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // OTHER CORE API ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/guild/:guildId/automod', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, antiInvite, antiLinks, antiSpam, antiCaps, punishment, badWords, logChannelId } = req.body;

      const updated = db.updateGuildConfig(guildId, 'automod', {
        enabled: Boolean(enabled),
        antiInvite: Boolean(antiInvite),
        antiLinks: Boolean(antiLinks),
        antiSpam: Boolean(antiSpam),
        antiCaps: Boolean(antiCaps),
        punishment: punishment || 'delete',
        badWords: Array.isArray(badWords) ? badWords : (badWords ? badWords.split(',').map(w => w.trim()).filter(Boolean) : []),
        logChannelId: logChannelId || null
      });

      db.addLog('AUTOMOD', `AutoMod settings updated for guild ${guildId}`);
      res.json({ success: true, automod: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/leveling', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, channelId, message } = req.body;

      const updated = db.updateGuildConfig(guildId, 'leveling', {
        enabled: Boolean(enabled),
        channelId: channelId || null,
        message: message || '🎉 Congratulations {user}! You just reached **Level {level}**!'
      });

      db.addLog('LEVEL', `Leveling settings updated for guild ${guildId}`);
      res.json({ success: true, leveling: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/guild/:guildId/leaderboard', async (req, res) => {
    try {
      const { guildId } = req.params;
      const topUsers = db.getLeaderboard(guildId, 25);

      const enriched = await Promise.all(topUsers.map(async u => {
        let tag = `User (${u.userId})`;
        let avatar = 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';
        try {
          const fetchedUser = await client.users.fetch(u.userId).catch(() => null);
          if (fetchedUser) {
            tag = fetchedUser.tag;
            avatar = fetchedUser.displayAvatarURL({ size: 128 });
          }
        } catch (e) {}
        return {
          userId: u.userId,
          username: tag,
          avatar: avatar,
          level: u.level || 0,
          xp: u.xp || 0
        };
      }));

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/giveaway', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, prize, durationMinutes, winnerCount, banner, thumbnail, color } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const ms = (parseInt(durationMinutes, 10) || 10) * 60 * 1000;
      const endsAt = Date.now() + ms;
      const endsTimestamp = Math.floor(endsAt / 1000);
      const winners = parseInt(winnerCount, 10) || 1;

      let validColor = color || config.defaultColor;
      if (!validColor.startsWith('#')) validColor = `#${validColor}`;

      const giveawayEmbed = new EmbedBuilder()
        .setColor(validColor)
        .setTitle(`🎉 GIVEAWAY: ${prize}`)
        .setDescription(
          `Click the **🎉 Enter** button below to participate!\n\n` +
          `• **Winners:** \`${winners}\`\n` +
          `• **Hosted via:** Web Dashboard\n` +
          `• **Ends:** <t:${endsTimestamp}:R> (<t:${endsTimestamp}:f>)\n` +
          `• **Entries:** \`0\``
        )
        .setFooter({ text: `${guild.name} • Giveaway System • Good Luck!` })
        .setTimestamp(endsAt);

      if (banner) {
        try { giveawayEmbed.setImage(banner); } catch (e) {}
      }
      if (thumbnail) {
        try { giveawayEmbed.setThumbnail(thumbnail); } catch (e) {}
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_enter_btn')
          .setLabel('🎉 Enter (0)')
          .setStyle(ButtonStyle.Primary)
      );

      const giveawayMsg = await channel.send({ embeds: [giveawayEmbed], components: [row] });

      db.saveGiveaway(guildId, giveawayMsg.id, {
        channelId: channel.id,
        prize: prize,
        winnerCount: winners,
        endsAt: endsAt,
        hostedBy: client.user.id,
        entries: [],
        ended: false,
        winners: []
      });

      res.json({ success: true, messageId: giveawayMsg.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/button-role', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, title, description, roles, banner, thumbnail, color } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      let validColor = color || config.defaultColor;
      if (!validColor.startsWith('#')) validColor = `#${validColor}`;

      const embed = new EmbedBuilder()
        .setColor(validColor)
        .setTitle(`🎭 ${title}`)
        .setDescription(description + '\n\n' + roles.map(r => `• Click below to toggle <@&${r.roleId}>`).join('\n'))
        .setFooter({ text: `${guild.name} • Self Role System` })
        .setTimestamp();

      if (banner) {
        try { embed.setImage(banner); } catch (e) {}
      }
      if (thumbnail) {
        try { embed.setThumbnail(thumbnail); } catch (e) {}
      }

      const row = new ActionRowBuilder();
      const styles = [ButtonStyle.Primary, ButtonStyle.Success, ButtonStyle.Secondary, ButtonStyle.Danger];

      roles.forEach((r, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_role_${r.roleId}`)
            .setLabel(r.label)
            .setStyle(styles[idx % styles.length])
        );
      });

      await channel.send({ embeds: [embed], components: [row] });
      res.json({ success: true, message: `Button role panel sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/guild/:guildId/backups', (req, res) => {
    try {
      const { guildId } = req.params;
      const all = db.getAllBackups(guildId);
      res.json(all);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/backup', (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => ({ name: r.name, color: r.hexColor, permissions: r.permissions.bitfield.toString() }));

      const channels = guild.channels.cache.map(c => ({
        name: c.name,
        type: c.type,
        parent: c.parent ? c.parent.name : null
      }));

      const backupId = `bk_${Date.now().toString(36)}`;
      const backupData = {
        name: guild.name,
        guildId: guild.id,
        createdAt: Date.now(),
        rolesCount: roles.length,
        channelsCount: channels.length,
        roles: roles,
        channels: channels
      };

      db.saveBackup(guild.id, backupId, backupData);
      res.json({ success: true, backupId, backupData });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/logs', (req, res) => {
    try {
      res.json(db.getRecentLogs());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/welcome', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, channelId, isEmbed, message, color, image } = req.body;

      const updated = db.updateGuildConfig(guildId, 'welcome', {
        enabled: Boolean(enabled),
        channelId: channelId || null,
        isEmbed: Boolean(isEmbed),
        message: message || '',
        color: color || '#57F287',
        image: image || null
      });

      db.addLog('CONFIG', `Welcome settings updated for guild ${guildId}`);
      res.json({ success: true, welcome: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/goodbye', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, channelId, isEmbed, message, color } = req.body;

      const updated = db.updateGuildConfig(guildId, 'goodbye', {
        enabled: Boolean(enabled),
        channelId: channelId || null,
        isEmbed: Boolean(isEmbed),
        message: message || '',
        color: color || '#ED4245'
      });

      db.addLog('CONFIG', `Goodbye settings updated for guild ${guildId}`);
      res.json({ success: true, goodbye: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/autorole', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, roleId } = req.body;

      const updated = db.updateGuildConfig(guildId, 'autorole', {
        enabled: Boolean(enabled),
        roleId: roleId || null
      });

      db.addLog('CONFIG', `Autorole settings updated for guild ${guildId}`);
      res.json({ success: true, autorole: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/send-embed', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, title, description, color, image, thumbnail, footer } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      let validColor = color || config.defaultColor;
      if (!validColor.startsWith('#')) validColor = `#${validColor}`;

      const embed = new EmbedBuilder()
        .setColor(validColor)
        .setDescription(description || '*(No content)*')
        .setTimestamp();

      if (title) embed.setTitle(title);
      if (image) {
        try { embed.setImage(image); } catch (e) {}
      }
      if (thumbnail) {
        try { embed.setThumbnail(thumbnail); } catch (e) {}
      }
      if (footer) {
        embed.setFooter({ text: footer });
      }

      await channel.send({ embeds: [embed] });
      db.addLog('EMBED', `Dispatched embed to #${channel.name}`);
      res.json({ success: true, message: `Embed sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/send-text', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, message } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      await channel.send({ content: message });
      db.addLog('TEXT', `Dispatched plain text to #${channel.name}`);
      res.json({ success: true, message: `Plain text sent to #${channel.name}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/clear-warns', (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId } = req.body;

      db.clearWarns(guildId, userId);
      res.json({ success: true, message: `Cleared warnings for user ${userId}` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/guild/:guildId/ticket/:channelId', async (req, res) => {
    try {
      const { guildId, channelId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      db.deleteTicket(guildId, channelId);

      if (guild) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Deleted from Web Dashboard').catch(() => {});
        }
      }

      res.json({ success: true, message: 'Ticket deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: STATBOT & SERVER STAT COUNTERS
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/statbot', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const conf = db.getStatBotConfig(guildId);
      const stats = await getGuildStats(guild);

      res.json({
        config: conf,
        stats: stats
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/statbot/config', (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled, channels } = req.body;

      const current = db.getStatBotConfig(guildId) || {};
      const updated = db.updateStatBotConfig(guildId, {
        enabled: enabled !== undefined ? Boolean(enabled) : current.enabled,
        channels: channels ? { ...current.channels, ...channels } : current.channels
      });

      db.addLog('STATBOT', `Updated StatBot config for guild ${guildId}`);
      res.json({ success: true, statbot: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/statbot/setup', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const result = await setupStatChannels(guild, req.body || {});
      res.json({ success: true, message: 'StatBot channels setup complete!', result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/statbot/update', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const result = await updateGuildStats(guild, true);
      res.json({ success: true, message: 'StatBot counters synchronized!', result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/statbot/delete', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      await deleteStatChannels(guild);
      res.json({ success: true, message: 'StatBot channels deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: GUILD LOGGING CONFIGURATION & AUDIT LOGS
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/logs/config', (req, res) => {
    try {
      const { guildId } = req.params;
      const guildConfig = db.getGuildConfig(guildId);
      res.json(guildConfig.logs || {});
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/logs/config', (req, res) => {
    try {
      const { guildId } = req.params;
      const {
        enabled,
        channelId,
        msgChannelId,
        memberChannelId,
        voiceChannelId,
        modChannelId,
        serverChannelId,
        events
      } = req.body;

      const updated = db.updateGuildConfig(guildId, 'logs', {
        enabled: Boolean(enabled),
        channelId: channelId || null,
        msgChannelId: msgChannelId || null,
        memberChannelId: memberChannelId || null,
        voiceChannelId: voiceChannelId || null,
        modChannelId: modChannelId || null,
        serverChannelId: serverChannelId || null,
        events: events || {}
      });

      db.addLog('CONFIG', `Logging settings updated for guild ${guildId}`);
      res.json({ success: true, logs: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/logs/test', async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const guildConfig = db.getGuildConfig(guildId);
      if (!guildConfig.logs?.channelId) {
        return res.status(400).json({ error: 'Please select at least a General / Default Log Channel first!' });
      }

      await sendGuildLog(guild, 'command', {
        title: '🧪 Dashboard Test Log',
        description: 'This is a test audit log dispatched from the **Web Dashboard** to verify Discord log channel routing.',
        color: config.defaultColor || '#5865F2',
        fields: [
          { name: '🌐 Source', value: 'Web Dashboard Control Panel', inline: true },
          { name: '⚡ Pipeline Status', value: '`100% Operational`', inline: true }
        ]
      });

      res.json({ success: true, message: 'Test log dispatched successfully to Discord!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/guild/:guildId/logs/audit', (req, res) => {
    try {
      const { guildId } = req.params;
      const category = req.query.category || 'ALL';
      const limit = parseInt(req.query.limit, 10) || 100;
      const logs = db.getServerLogs(guildId, category, limit);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/guild/:guildId/logs/audit', (req, res) => {
    try {
      const { guildId } = req.params;
      db.clearServerLogs(guildId);
      res.json({ success: true, message: 'Audit logs cleared successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: USER ACTIVITY & VOICE TRACKER (STATBOT STYLE)
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/user-stats', (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const topVoice = db.getVoiceLeaderboard(guildId, 50);
      const topMessages = db.getMessagesLeaderboard(guildId, 50);

      // Helper to enrich member item with Discord tag and avatar
      const enrichItem = (item) => {
        const member = guild.members.cache.get(item.userId);
        const active = getActiveVoiceSession(guildId, item.userId);
        const voiceChannel = active ? guild.channels.cache.get(active.channelId) : null;

        const effectiveVoiceSec = (item.voiceSeconds || 0) + (active?.currentSessionSeconds || 0);

        return {
          ...item,
          voiceSeconds: effectiveVoiceSec,
          formattedVoiceTime: formatVoiceTime(effectiveVoiceSec),
          username: member ? member.user.username : 'Unknown Member',
          tag: member ? member.user.tag : `User#${item.userId.slice(-4)}`,
          avatar: member ? member.user.displayAvatarURL({ dynamic: true, size: 128 }) : 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
          inVoice: Boolean(active),
          voiceChannelName: voiceChannel ? voiceChannel.name : null
        };
      };

      const enrichedVoice = topVoice.map(enrichItem);
      const enrichedMessages = topMessages.map(enrichItem);

      // Totals
      const fullConfig = db.getGuildConfig(guildId);
      const userStatsObj = fullConfig.userStats || {};
      let totalVoiceSec = 0;
      let totalMsgs = 0;

      Object.values(userStatsObj).forEach(u => {
        totalVoiceSec += (u.voiceSeconds || 0);
        totalMsgs += (u.messagesCount || 0);
      });

      // Active voice members count
      let currentActiveVoiceCount = 0;
      if (guild.channels && guild.channels.cache) {
        guild.channels.cache.forEach(ch => {
          if (ch.isVoiceBased && ch.isVoiceBased() && ch.members) {
            currentActiveVoiceCount += ch.members.filter(m => !m.user.bot).size;
          }
        });
      }

      res.json({
        totals: {
          totalVoiceSeconds: totalVoiceSec,
          formattedTotalVoice: formatVoiceTime(totalVoiceSec),
          totalMessages: totalMsgs,
          trackedUsersCount: Object.keys(userStatsObj).length,
          activeVoiceCount: currentActiveVoiceCount
        },
        topVoice: enrichedVoice,
        topMessages: enrichedMessages
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/guild/:guildId/user-stats/:userId', (req, res) => {
    try {
      const { guildId, userId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const stats = db.getUserStats(guildId, userId);
      const active = getActiveVoiceSession(guildId, userId);
      const member = guild.members.cache.get(userId);

      const effectiveVoiceSec = (stats.voiceSeconds || 0) + (active?.currentSessionSeconds || 0);

      res.json({
        userId,
        stats: {
          ...stats,
          voiceSeconds: effectiveVoiceSec,
          formattedVoiceTime: formatVoiceTime(effectiveVoiceSec)
        },
        inVoice: Boolean(active),
        member: member ? {
          username: member.user.username,
          tag: member.user.tag,
          avatar: member.user.displayAvatarURL({ dynamic: true, size: 256 })
        } : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/user-stats/reset', (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, type } = req.body;

      if (userId) {
        db.resetUserStats(guildId, userId, type || 'all');
        res.json({ success: true, message: `Statistics reset for user ${userId}.` });
      } else {
        db.resetGuildStats(guildId, type || 'all');
        res.json({ success: true, message: `Server statistics (${type || 'all'}) reset successfully.` });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: TRIGGER AUTO-RESPONDER ENGINE
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/autoresponders', (req, res) => {
    try {
      const { guildId } = req.params;
      const responders = db.getAutoResponders(guildId);
      res.json(responders);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/autoresponder', (req, res) => {
    try {
      const { guildId } = req.params;
      const {
        id,
        trigger,
        matchType,
        replyType,
        response,
        embedTitle,
        embedColor,
        thumbnail,
        banner,
        footer,
        mentionRoleId,
        deleteTrigger,
        cooldown,
        enabled
      } = req.body;

      if (!trigger || !trigger.trim()) {
        return res.status(400).json({ error: 'Trigger keyword/phrase is required.' });
      }
      if (!response || !response.trim()) {
        return res.status(400).json({ error: 'Response content is required.' });
      }

      const saved = db.saveAutoResponder(guildId, id, {
        trigger,
        matchType,
        replyType,
        response,
        embedTitle,
        embedColor,
        thumbnail,
        banner,
        footer,
        mentionRoleId,
        deleteTrigger,
        cooldown,
        enabled
      });

      res.json({ success: true, message: 'Auto-responder trigger saved successfully!', responder: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/autoresponder/:id/toggle', (req, res) => {
    try {
      const { guildId, id } = req.params;
      const { enabled } = req.body;
      const updated = db.toggleAutoResponder(guildId, id, enabled);
      if (!updated) return res.status(404).json({ error: 'Auto-responder not found.' });

      res.json({ success: true, message: `Auto-responder ${updated.enabled ? 'enabled' : 'disabled'}.`, responder: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: BULK CHANNEL OPERATIONS STUDIO
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/channels/detailed', (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channels = [];
      const categories = [];

      guild.channels.cache.forEach(ch => {
        if (ch.type === ChannelType.GuildCategory) {
          categories.push({
            id: ch.id,
            name: ch.name,
            position: ch.position,
            childrenCount: guild.channels.cache.filter(c => c.parentId === ch.id).size
          });
        }
      });

      guild.channels.cache.forEach(ch => {
        const parentCat = ch.parentId ? guild.channels.cache.get(ch.parentId) : null;
        let typeName = 'Text';
        let icon = '💬';

        if (ch.type === ChannelType.GuildVoice) {
          typeName = 'Voice';
          icon = '🎙️';
        } else if (ch.type === ChannelType.GuildAnnouncement) {
          typeName = 'Announcement';
          icon = '📢';
        } else if (ch.type === ChannelType.GuildCategory) {
          typeName = 'Category';
          icon = '📁';
        } else if (ch.type === ChannelType.GuildStageVoice) {
          typeName = 'Stage';
          icon = '🎭';
        }

        // Check if locked
        const overwrites = ch.permissionOverwrites?.cache?.get(guild.roles.everyone?.id);
        const isLocked = overwrites ? overwrites.deny?.has(PermissionsBitField.Flags.SendMessages) : false;
        const isHidden = overwrites ? overwrites.deny?.has(PermissionsBitField.Flags.ViewChannel) : false;

        channels.push({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          typeName,
          icon,
          parentId: ch.parentId || null,
          parentName: parentCat ? parentCat.name : 'No Category',
          position: ch.position,
          slowmode: ch.rateLimitPerUser || 0,
          isLocked: Boolean(isLocked),
          isHidden: Boolean(isHidden)
        });
      });

      // Sort categories then channels by position
      categories.sort((a, b) => a.position - b.position);
      channels.sort((a, b) => {
        if (a.parentId === b.parentId) return a.position - b.position;
        return (a.parentName || '').localeCompare(b.parentName || '');
      });

      res.json({
        totalChannels: channels.length,
        categories,
        channels
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/channels/bulk-action', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelIds, action, options } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
        return res.status(400).json({ error: 'No channels selected for bulk action.' });
      }

      let processedCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const channelId of channelIds) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
          failedCount++;
          continue;
        }

        try {
          // 1. DELETE
          if (action === 'delete') {
            await channel.delete('Bulk deleted via Web Dashboard');
            processedCount++;
          }
          // 2. NUKE
          else if (action === 'nuke') {
            if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
              const position = channel.position;
              const topic = channel.topic;
              const parentId = channel.parentId;

              const newChan = await channel.clone({
                name: channel.name,
                permissions: channel.permissionOverwrites.cache,
                topic: topic,
                position: position,
                parent: parentId,
                reason: 'Bulk nuked via Web Dashboard'
              });
              await channel.delete('Bulk nuked via Web Dashboard');
              await newChan.send({
                embeds: [
                  new EmbedBuilder()
                    .setColor(config.errorColor || '#ED4245')
                    .setTitle('💥 Channel Nuked & Cleared')
                    .setDescription('This channel was wiped and recreated via **Web Dashboard Bulk Channel Studio**.')
                    .setTimestamp()
                ]
              }).catch(() => {});
              processedCount++;
            }
          }
          // 3. LOCK
          else if (action === 'lock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
              SendMessages: false,
              AddReactions: false
            });
            processedCount++;
          }
          // 4. UNLOCK
          else if (action === 'unlock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
              SendMessages: null,
              AddReactions: null
            });
            processedCount++;
          }
          // 5. SLOWMODE
          else if (action === 'slowmode') {
            const seconds = Number(options?.slowmodeSeconds) || 0;
            if (channel.setRateLimitPerUser) {
              await channel.setRateLimitPerUser(seconds, 'Bulk slowmode via Web Dashboard');
              processedCount++;
            }
          }
          // 6. MOVE TO CATEGORY
          else if (action === 'move') {
            const targetCatId = options?.categoryId || null;
            await channel.setParent(targetCatId, { lockPermissions: false });
            processedCount++;
          }
          // 7. HIDE
          else if (action === 'hide') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
              ViewChannel: false
            });
            processedCount++;
          }
          // 8. UNHIDE
          else if (action === 'unhide') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
              ViewChannel: null
            });
            processedCount++;
          }
        } catch (err) {
          failedCount++;
          errors.push({ channelName: channel.name, error: err.message });
        }
      }

      // Add to server audit log
      db.addServerLog(guildId, {
        action: `BULK_CHANNEL_${(action || '').toUpperCase()}`,
        userId: 'DASHBOARD_ADMIN',
        details: `Bulk ${action} executed on ${processedCount} channels (${failedCount} failed).`,
        color: config.defaultColor
      });

      res.json({
        success: true,
        message: `Bulk ${action} completed successfully on ${processedCount} channel(s)!`,
        processedCount,
        failedCount,
        errors
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // API: TIKTOK NOTIFYME ENGINE
  // -------------------------------------------------------------
  app.get('/api/guild/:guildId/tiktok-trackers', (req, res) => {
    try {
      const { guildId } = req.params;
      const trackers = db.getTikTokTrackers(guildId);
      res.json(trackers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/tiktok-tracker', (req, res) => {
    try {
      const { guildId } = req.params;
      const {
        id,
        tiktokUsername,
        channelId,
        mentionRoleId,
        customMessage,
        notifyLive,
        notifyVideo,
        embedTitle,
        embedColor,
        banner,
        enabled
      } = req.body;

      if (!tiktokUsername || !tiktokUsername.trim()) {
        return res.status(400).json({ error: 'TikTok username handle is required.' });
      }
      if (!channelId) {
        return res.status(400).json({ error: 'Please select a Discord channel for notifications.' });
      }

      const saved = db.saveTikTokTracker(guildId, id, {
        tiktokUsername,
        channelId,
        mentionRoleId: mentionRoleId || null,
        customMessage,
        notifyLive: notifyLive !== false,
        notifyVideo: notifyVideo !== false,
        embedTitle,
        embedColor: embedColor || '#FE2C55',
        banner,
        enabled: enabled !== false
      });

      res.json({ success: true, message: 'TikTok NotifyMe tracker saved successfully!', tracker: saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/tiktok-tracker/:id/test', async (req, res) => {
    try {
      const { guildId, id } = req.params;
      await testTikTokNotification(client, guildId, id);
      res.json({ success: true, message: 'Test TikTok notification dispatched to Discord!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/guild/:guildId/tiktok-tracker/:id/toggle', (req, res) => {
    try {
      const { guildId, id } = req.params;
      const { enabled } = req.body;
      const updated = db.toggleTikTokTracker(guildId, id, enabled);
      if (!updated) return res.status(404).json({ error: 'TikTok tracker not found.' });

      res.json({ success: true, message: `TikTok tracker ${updated.enabled ? 'enabled' : 'disabled'}.`, tracker: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/guild/:guildId/tiktok-tracker/:id', (req, res) => {
    try {
      const { guildId, id } = req.params;
      const deleted = db.deleteTikTokTracker(guildId, id);
      if (!deleted) return res.status(404).json({ error: 'TikTok tracker not found.' });

      res.json({ success: true, message: 'TikTok tracker deleted successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`🌐 [DASHBOARD] Web Dashboard running live at http://${HOST}:${PORT}`);
  });
}

module.exports = { startDashboard };
