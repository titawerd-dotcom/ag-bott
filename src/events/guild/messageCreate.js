const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const guildConfig = db.getGuildConfig(guildId);

    // =============================================================
    // 1. AUTOMOD SYSTEM
    // =============================================================
    const automod = guildConfig.automod;
    const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
                    message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

    if (automod?.enabled && !isStaff) {
      let violated = false;
      let reason = '';

      const content = message.content.toLowerCase();

      // Anti Discord Invites
      if (automod.antiInvite) {
        const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;
        if (inviteRegex.test(message.content)) {
          violated = true;
          reason = 'Posting unauthorized Discord invite link';
        }
      }

      // Anti External Links
      if (!violated && automod.antiLinks) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        if (linkRegex.test(message.content)) {
          violated = true;
          reason = 'Posting unauthorized external links';
        }
      }

      // Anti Mass Mentions
      if (!violated && automod.antiSpam) {
        if (message.mentions.users.size > 4 || message.mentions.roles.size > 3) {
          violated = true;
          reason = 'Mass mentioning users or roles';
        }
      }

      // Anti Caps
      if (!violated && automod.antiCaps && message.content.length >= 8) {
        const uppercaseCount = (message.content.match(/[A-Z]/g) || []).length;
        const totalLetters = (message.content.match(/[a-zA-Z]/g) || []).length;
        if (totalLetters > 6 && (uppercaseCount / totalLetters) >= 0.75) {
          violated = true;
          reason = 'Excessive uppercase / screaming (ALL CAPS)';
        }
      }

      // Bad Words Filter
      if (!violated && automod.badWords && automod.badWords.length > 0) {
        for (const badWord of automod.badWords) {
          if (badWord.trim() !== '' && content.includes(badWord.toLowerCase().trim())) {
            violated = true;
            reason = `Prohibited keyword detected (\`${badWord}\`)`;
            break;
          }
        }
      }

      // Execute punishment
      if (violated) {
        try {
          await message.delete();
        } catch (e) {}

        db.addLog('AUTOMOD', `AutoMod caught ${message.author.tag} in #${message.channel.name}: ${reason}`);

        if (automod.punishment === 'warn') {
          db.addWarn(guildId, message.author.id, message.client.user.id, `[AutoMod] ${reason}`);
        } else if (automod.punishment === 'timeout') {
          try {
            await message.member.timeout(5 * 60 * 1000, `[AutoMod] ${reason}`);
          } catch (e) {}
        }

        // Notify user in channel briefly
        try {
          const warningMsg = await message.channel.send({
            content: `⚠️ ${message.author}, your message was removed by **AutoMod**! Reason: *${reason}*`
          });
          setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
        } catch (e) {}

        // Log to logChannel if configured
        if (automod.logChannelId) {
          const logChan = message.guild.channels.cache.get(automod.logChannelId);
          if (logChan) {
            const logEmbed = new EmbedBuilder()
              .setColor(config.errorColor)
              .setTitle('🛡️ AutoMod Action Triggered')
              .addFields(
                { name: '👤 Offender', value: `${message.author.tag} (<@${message.author.id}>)`, inline: true },
                { name: '💬 Channel', value: `${message.channel}`, inline: true },
                { name: '📝 Reason', value: reason, inline: false },
                { name: '🗑️ Deleted Content', value: `\`\`\`${message.content.slice(0, 1000)}\`\`\``, inline: false }
              )
              .setTimestamp();
            logChan.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return; // Don't give XP on violation
      }
    }

    // =============================================================
    // 2. USER STATS (MESSAGE COUNT TRACKING)
    // =============================================================
    try {
      db.incrementUserMessages(guildId, message.author.id);
    } catch (e) {
      console.error('[STATS ERROR] Failed to increment messages:', e);
    }

    // =============================================================
    // 3. TRIGGER AUTO-RESPONDER ENGINE
    // =============================================================
    try {
      const autoresponders = db.getAutoResponders(guildId);
      const responderList = Object.values(autoresponders || {}).filter(r => r.enabled !== false && r.trigger);

      if (responderList.length > 0) {
        const rawContent = message.content.trim();
        const lowerContent = rawContent.toLowerCase();

        for (const responder of responderList) {
          const trig = responder.trigger.toLowerCase();
          let isMatch = false;

          if (responder.matchType === 'exact') {
            isMatch = (lowerContent === trig);
          } else if (responder.matchType === 'startswith') {
            isMatch = lowerContent.startsWith(trig);
          } else if (responder.matchType === 'endswith') {
            isMatch = lowerContent.endsWith(trig);
          } else {
            // Default: 'contains'
            isMatch = lowerContent.includes(trig);
          }

          if (isMatch) {
            // Check Cooldown
            if (!global.autoResponderCooldowns) global.autoResponderCooldowns = new Map();
            const cdKey = `${guildId}_${responder.id}_${message.author.id}`;
            const now = Date.now();
            const lastUsed = global.autoResponderCooldowns.get(cdKey) || 0;
            const cdSeconds = responder.cooldown || 5;

            if (now - lastUsed < cdSeconds * 1000) {
              continue; // On cooldown
            }
            global.autoResponderCooldowns.set(cdKey, now);

            // Delete trigger message if requested
            if (responder.deleteTrigger) {
              try {
                await message.delete();
              } catch (e) {}
            }

            // Variable Substitution
            const formatVars = (str) => {
              if (!str) return '';
              return str
                .replace(/{user}/g, `<@${message.author.id}>`)
                .replace(/{userName}/g, message.author.username)
                .replace(/{userTag}/g, message.author.tag)
                .replace(/{server}/g, message.guild.name)
                .replace(/{channel}/g, `${message.channel}`)
                .replace(/{memberCount}/g, message.guild.memberCount);
            };

            const roleMentionText = responder.mentionRoleId ? `<@&${responder.mentionRoleId}>` : '';
            const responseText = formatVars(responder.response || '');

            if (responder.replyType === 'text') {
              const fullContent = roleMentionText ? `${roleMentionText}\n${responseText}` : responseText;
              if (fullContent.trim()) {
                await message.channel.send({ content: fullContent });
              }
            } else {
              // Rich Embed reply
              const embed = new EmbedBuilder()
                .setColor(responder.embedColor || config.defaultColor || '#5865F2')
                .setDescription(responseText || ' ')
                .setTimestamp();

              if (responder.embedTitle) {
                embed.setTitle(formatVars(responder.embedTitle));
              }
              if (responder.thumbnail && responder.thumbnail.startsWith('http')) {
                embed.setThumbnail(responder.thumbnail);
              }
              if (responder.banner && responder.banner.startsWith('http')) {
                embed.setImage(responder.banner);
              }
              if (responder.footer) {
                embed.setFooter({ text: formatVars(responder.footer) });
              }

              const payload = { embeds: [embed] };
              if (roleMentionText) {
                payload.content = roleMentionText;
              }

              await message.channel.send(payload);
            }

            break; // Stop after first matched responder
          }
        }
      }
    } catch (err) {
      console.error('[AUTORESPONDER ERROR]', err);
    }

    // =============================================================
    // 4. LEVELING & XP SYSTEM
    // =============================================================
    const leveling = guildConfig.leveling;
    if (leveling?.enabled) {
      const earnedXP = Math.floor(Math.random() * 11) + 15; // 15 - 25 XP
      const result = db.addXP(guildId, message.author.id, earnedXP);

      if (result.leveledUp) {
        const targetChan = (leveling.channelId && message.guild.channels.cache.get(leveling.channelId)) || message.channel;

        const customMsg = leveling.message || '🎉 Congratulations {user}! You just reached **Level {level}**!';
        const formatted = customMsg
          .replace(/{user}/g, `<@${message.author.id}>`)
          .replace(/{userName}/g, message.author.username)
          .replace(/{level}/g, result.level)
          .replace(/{server}/g, message.guild.name);

        const levelEmbed = new EmbedBuilder()
          .setColor(config.defaultColor)
          .setTitle('⭐ Level Up!')
          .setDescription(formatted)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '🆙 New Level', value: `\`Level ${result.level}\``, inline: true },
            { name: '✨ Total XP', value: `\`${result.userObj.xp} XP\``, inline: true }
          )
          .setTimestamp();

        try {
          await targetChan.send({ embeds: [levelEmbed] });
        } catch (e) {}
      }
    }
  }
};
