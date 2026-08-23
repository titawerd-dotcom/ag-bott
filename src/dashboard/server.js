const express = require('express');
const path = require('path');
const os = require('os');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const config = require('../../config.json');

function startDashboard(client) {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

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
      const { channelId, title, message, ping, imageUrl } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`📢 ${title}`)
        .setDescription(message)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined })
        .setFooter({ text: 'Official Announcement via Dashboard' })
        .setTimestamp();

      if (imageUrl) {
        try { embed.setImage(imageUrl); } catch (e) {}
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

  // 16. DEPLOY TICKET PANEL
  app.post('/api/guild/:guildId/action/ticket-setup', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { channelId, categoryId, staffRoleId, title, description } = req.body;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      db.updateGuildConfig(guildId, 'ticket', {
        categoryId: categoryId || null,
        staffRoleId: staffRoleId || null
      });

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(title || '📩 Support & Help Desk')
        .setDescription(description || 'Click the **Create Ticket** button below to open a private support room with our staff team.')
        .addFields(
          { name: '🔒 Private & Secure', value: 'Only you and server staff can view your ticket.', inline: true },
          { name: '⚡ Fast Support', value: 'A staff member will assist you shortly.', inline: true }
        )
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || undefined)
        .setFooter({ text: `${guild.name} • Official Support System` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket_btn')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩')
      );

      await channel.send({ embeds: [embed], components: [row] });
      db.addLog('TICKET', `Ticket panel posted in #${channel.name}`);
      res.json({ success: true, message: `Ticket panel deployed to #${channel.name}` });
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
      const { channelId, prize, durationMinutes, winnerCount } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const ms = (parseInt(durationMinutes, 10) || 10) * 60 * 1000;
      const endsAt = Date.now() + ms;
      const endsTimestamp = Math.floor(endsAt / 1000);
      const winners = parseInt(winnerCount, 10) || 1;

      const giveawayEmbed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`🎉 GIVEAWAY: ${prize}`)
        .setDescription(
          `Click the **🎉 Enter** button below to participate!\n\n` +
          `• **Winners:** \`${winners}\`\n` +
          `• **Hosted via:** Web Dashboard\n` +
          `• **Ends:** <t:${endsTimestamp}:R> (<t:${endsTimestamp}:f>)\n` +
          `• **Entries:** \`0\``
        )
        .setFooter({ text: 'Giveaway System • Good Luck!' })
        .setTimestamp(endsAt);

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
      const { channelId, title, description, roles } = req.body;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ error: 'Guild not found' });

      const channel = guild.channels.cache.get(channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle(`🎭 ${title}`)
        .setDescription(description + '\n\n' + roles.map(r => `• Click below to toggle <@&${r.roleId}>`).join('\n'))
        .setFooter({ text: `${guild.name} • Self Role System` })
        .setTimestamp();

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

  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`🌐 [DASHBOARD] Web Dashboard running live at http://${HOST}:${PORT}`);
  });
}

module.exports = { startDashboard };
