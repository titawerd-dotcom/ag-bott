const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const config = require('../../../config.json');
const db = require('../../database/db');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // -------------------------------------------------------------
    // 1. SLASH COMMANDS
    // -------------------------------------------------------------
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          content: `${config.emojis.error} Command not found!`,
          ephemeral: true
        });
      }

      db.addLog('COMMAND', `/${interaction.commandName} executed by ${interaction.user.tag} in #${interaction.channel?.name}`);

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[COMMAND ERROR] /${interaction.commandName}:`, error);
        db.addLog('ERROR', `Error in /${interaction.commandName}: ${error.message}`);
        const errorEmbed = new EmbedBuilder()
          .setColor(config.errorColor)
          .setTitle(`${config.emojis.error} Execution Error`)
          .setDescription(`An unexpected error occurred while executing this command.\n\`\`\`${error.message}\`\`\``)
          .setTimestamp();

        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 2. MODAL SUBMISSIONS
    // -------------------------------------------------------------
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('embed_builder_modal_')) {
        const targetChannelId = interaction.customId.replace('embed_builder_modal_', '');
        const targetChannel = interaction.guild.channels.cache.get(targetChannelId) || interaction.channel;

        const title = interaction.fields.getTextInputValue('embed_title') || null;
        const description = interaction.fields.getTextInputValue('embed_description');
        let color = interaction.fields.getTextInputValue('embed_color') || config.defaultColor;
        const image = interaction.fields.getTextInputValue('embed_image') || null;
        const footer = interaction.fields.getTextInputValue('embed_footer') || null;

        if (!color.startsWith('#')) color = `#${color}`;
        const hexRegex = /^#[0-9A-F]{6}$/i;
        if (!hexRegex.test(color)) color = config.defaultColor;

        const embed = new EmbedBuilder().setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (image) {
          try { embed.setImage(image); } catch (e) {}
        }
        if (footer) embed.setFooter({ text: footer, iconURL: interaction.guild.iconURL() || undefined });
        embed.setTimestamp();

        try {
          await targetChannel.send({ embeds: [embed] });
          await interaction.reply({
            content: `${config.emojis.success} Embed has been sent successfully to ${targetChannel}!`,
            ephemeral: true
          });
        } catch (err) {
          await interaction.reply({
            content: `${config.emojis.error} Failed to send embed: ${err.message}`,
            ephemeral: true
          });
        }
        return;
      }
    }

    // -------------------------------------------------------------
    // 3. SELECT MENUS
    // -------------------------------------------------------------
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'help_category_select') {
        const selected = interaction.values[0];
        const categoryMap = {
          moderation: {
            title: '🛡️ Moderation & AutoMod',
            desc: 'Complete suite of server moderation, auto-protection, and enforcement.',
            commands: [
              '`/ban` - Ban a member from the server',
              '`/unban` - Unban a user with their ID',
              '`/kick` - Kick a member from the server',
              '`/timeout` - Mute/timeout a member',
              '`/untimeout` - Remove timeout from a member',
              '`/warn` - Issue an official warning to a user',
              '`/warnings` - View warnings of a user',
              '`/clearwarns` - Clear all warnings of a user',
              '`/automod` - Automated anti-invite, anti-link, and anti-spam protection',
              '`/purge` - Bulk delete messages in a channel',
              '`/slowmode` - Set slowmode timer for a channel',
              '`/lock` - Lock a channel from regular members',
              '`/unlock` - Unlock a locked channel',
              '`/nuke` - Recreate and clean current channel',
              '`/role` - Add or remove a role from a user',
              '`/nick` - Change a user\'s server nickname'
            ]
          },
          tickets: {
            title: '🎫 Ticket System Commands',
            desc: 'Interactive button-based support ticket system.',
            commands: [
              '`/ticket-setup` - Create an interactive ticket panel with buttons',
              '`/ticket add` - Add a user to the current ticket',
              '`/ticket remove` - Remove a user from the current ticket',
              '`/ticket close` - Close the current active ticket',
              '`/ticket claim` - Claim the ticket as a staff member',
              '`/ticket delete` - Immediately delete the ticket channel'
            ]
          },
          welcome: {
            title: '👋 Welcome & Goodbye System',
            desc: 'Customize join and leave greetings and auto-roles.',
            commands: [
              '`/setwelcome` - Setup welcome channel, message, embed, and image',
              '`/setgoodbye` - Setup goodbye channel and goodbye message',
              '`/autorole` - Automatically assign a role to new members upon joining',
              '`/testwelcome` - Test your current welcome configuration',
              '`/testgoodbye` - Test your current goodbye configuration'
            ]
          },
          leveling: {
            title: '⭐ Leveling & Ranking System',
            desc: 'Gamify your community with chat XP and leaderboards.',
            commands: [
              '`/rank` - View your rank card, level, and XP bar',
              '`/leaderboard` - View top 10 most active community members',
              '`/setxp` - Admin tool to configure member XP and levels'
            ]
          },
          giveaway: {
            title: '🎉 Giveaway System',
            desc: 'Host giveaways with timer and interactive entries.',
            commands: [
              '`/giveaway start` - Launch an interactive giveaway with buttons',
              '`/giveaway end` - End a giveaway and pick winners',
              '`/giveaway reroll` - Reroll new winners for a giveaway'
            ]
          },
          embed: {
            title: '🎨 Embed Builder & Plain Text Commands',
            desc: 'Create beautiful embeds and plain text messages.',
            commands: [
              '`/embed-builder` - Open an interactive Modal to design custom embeds',
              '`/say` - Send plain text messages through the bot',
              '`/embed-say` - Quickly send an embed with custom title and text',
              '`/announce` - Send formatted announcements with optional pings',
              '`/reactionrole` - Create interactive button role self-assign panels'
            ]
          },
          utility: {
            title: '⚙️ General & Utility Commands',
            desc: 'Informative and server management utilities.',
            commands: [
              '`/help` - Show this interactive help dashboard',
              '`/ping` - Check bot latency and API websocket ping',
              '`/serverinfo` - Display detailed information about the server',
              '`/userinfo` - Display detailed profile info about a member',
              '`/botinfo` - Check bot status, uptime, node version, and memory usage',
              '`/avatar` - View and download user avatar in high resolution',
              '`/poll` - Create interactive single/multi option community polls',
              '`/backup create/list/info` - Create and manage server snapshots'
            ]
          }
        };

        const data = categoryMap[selected];
        if (!data) return;

        const updatedEmbed = new EmbedBuilder()
          .setColor(config.defaultColor)
          .setTitle(data.title)
          .setDescription(`${data.desc}\n\n${data.commands.join('\n')}`)
          .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.update({ embeds: [updatedEmbed] });
        return;
      }
    }

    // -------------------------------------------------------------
    // 4. BUTTON INTERACTIONS
    // -------------------------------------------------------------
    if (interaction.isButton()) {
      const guildId = interaction.guild.id;
      const guildConfig = db.getGuildConfig(guildId);

      // BUTTON ROLE TOGGLE
      if (interaction.customId.startsWith('btn_role_')) {
        const roleId = interaction.customId.replace('btn_role_', '');
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
          return interaction.reply({ content: '❌ Role not found on this server!', ephemeral: true });
        }

        const member = interaction.member;
        try {
          if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            return interaction.reply({
              content: `➖ Removed the role **${role.name}** from you.`,
              ephemeral: true
            });
          } else {
            await member.roles.add(role);
            return interaction.reply({
              content: `➕ Added the role **${role.name}** to you!`,
              ephemeral: true
            });
          }
        } catch (err) {
          return interaction.reply({
            content: `❌ Could not modify role: ${err.message}`,
            ephemeral: true
          });
        }
      }

      // GIVEAWAY ENTER / LEAVE
      if (interaction.customId === 'giveaway_enter_btn') {
        const messageId = interaction.message.id;
        const ga = db.getGiveaway(guildId, messageId);

        if (!ga || ga.ended) {
          return interaction.reply({ content: '⚠️ This giveaway has ended!', ephemeral: true });
        }

        if (!ga.entries) ga.entries = [];

        const alreadyEntered = ga.entries.includes(interaction.user.id);
        if (alreadyEntered) {
          ga.entries = ga.entries.filter(id => id !== interaction.user.id);
          db.saveGiveaway(guildId, messageId, ga);

          // Update button label
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('giveaway_enter_btn')
              .setLabel(`🎉 Enter (${ga.entries.length})`)
              .setStyle(ButtonStyle.Primary)
          );
          await interaction.message.edit({ components: [row] }).catch(() => {});

          return interaction.reply({
            content: '❌ You left the giveaway.',
            ephemeral: true
          });
        } else {
          ga.entries.push(interaction.user.id);
          db.saveGiveaway(guildId, messageId, ga);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('giveaway_enter_btn')
              .setLabel(`🎉 Enter (${ga.entries.length})`)
              .setStyle(ButtonStyle.Primary)
          );
          await interaction.message.edit({ components: [row] }).catch(() => {});

          return interaction.reply({
            content: `🎉 You have successfully entered the giveaway for **${ga.prize}**! Good luck!`,
            ephemeral: true
          });
        }
      }

      // CREATE TICKET
      if (interaction.customId === 'create_ticket_btn') {
        const nextNum = db.getNextTicketNumber(guildId);
        const ticketChannelName = `ticket-${String(nextNum).padStart(4, '0')}`;

        const categoryId = guildConfig.ticket?.categoryId;
        const staffRoleId = guildConfig.ticket?.staffRoleId;

        const permissionOverwrites = [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.EmbedLinks
            ]
          }
        ];

        if (staffRoleId && interaction.guild.roles.cache.has(staffRoleId)) {
          permissionOverwrites.push({
            id: staffRoleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles
            ]
          });
        }

        try {
          const ticketChannel = await interaction.guild.channels.create({
            name: ticketChannelName,
            type: ChannelType.GuildText,
            parent: categoryId && interaction.guild.channels.cache.has(categoryId) ? categoryId : null,
            permissionOverwrites: permissionOverwrites
          });

          db.saveTicket(guildId, ticketChannel.id, {
            ownerId: interaction.user.id,
            ticketNumber: nextNum,
            createdAt: Date.now(),
            claimedBy: null,
            status: 'open'
          });

          const ticketEmbed = new EmbedBuilder()
            .setColor(config.defaultColor)
            .setTitle(`${config.emojis.ticket} Support Ticket #${nextNum}`)
            .setDescription(
              `Hello ${interaction.user}, welcome to your support ticket!\n\n` +
              `• Please describe your issue or question in detail.\n` +
              `• Our support team will assist you shortly.\n\n` +
              `**Ticket Controls:** Use the buttons below to manage this ticket.`
            )
            .addFields(
              { name: '👤 Opened by', value: `<@${interaction.user.id}>`, inline: true },
              { name: '⏰ Created at', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Support Ticket System', iconURL: interaction.guild.iconURL() || undefined })
            .setTimestamp();

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('close_ticket_btn')
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🔒'),
            new ButtonBuilder()
              .setCustomId('claim_ticket_btn')
              .setLabel('Claim Ticket')
              .setStyle(ButtonStyle.Success)
              .setEmoji('📌'),
            new ButtonBuilder()
              .setCustomId('delete_ticket_btn')
              .setLabel('Delete')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🗑️')
          );

          await ticketChannel.send({
            content: `${interaction.user} ${staffRoleId ? `<@&${staffRoleId}>` : ''}`,
            embeds: [ticketEmbed],
            components: [controlRow]
          });

          await interaction.reply({
            content: `${config.emojis.success} Your ticket has been created: ${ticketChannel}`,
            ephemeral: true
          });
        } catch (err) {
          console.error('[TICKET CREATE ERROR]', err);
          await interaction.reply({
            content: `${config.emojis.error} Failed to create ticket channel: ${err.message}`,
            ephemeral: true
          });
        }
        return;
      }

      // CLOSE TICKET
      if (interaction.customId === 'close_ticket_btn') {
        const ticketData = db.getTicket(guildId, interaction.channel.id);

        if (ticketData?.ownerId) {
          try {
            await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, {
              SendMessages: false
            });
          } catch (e) {}
        }

        db.saveTicket(guildId, interaction.channel.id, {
          ...ticketData,
          status: 'closed',
          closedBy: interaction.user.id,
          closedAt: Date.now()
        });

        const closedEmbed = new EmbedBuilder()
          .setColor(config.warningColor)
          .setTitle('🔒 Ticket Closed')
          .setDescription(`This ticket was closed by ${interaction.user}.\nUse the buttons below to reopen or permanently delete this channel.`)
          .setTimestamp();

        const closedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('reopen_ticket_btn')
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔓'),
          new ButtonBuilder()
            .setCustomId('delete_ticket_btn')
            .setLabel('Delete Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        );

        await interaction.reply({ embeds: [closedEmbed], components: [closedRow] });
        return;
      }

      // REOPEN TICKET
      if (interaction.customId === 'reopen_ticket_btn') {
        const ticketData = db.getTicket(guildId, interaction.channel.id);
        if (ticketData?.ownerId) {
          try {
            await interaction.channel.permissionOverwrites.edit(ticketData.ownerId, {
              SendMessages: true,
              ViewChannel: true
            });
          } catch (e) {}
        }

        db.saveTicket(guildId, interaction.channel.id, {
          ...ticketData,
          status: 'open'
        });

        const reopenEmbed = new EmbedBuilder()
          .setColor(config.successColor)
          .setTitle('🔓 Ticket Reopened')
          .setDescription(`This ticket has been reopened by ${interaction.user}.`)
          .setTimestamp();

        await interaction.reply({ embeds: [reopenEmbed] });
        return;
      }

      // CLAIM TICKET
      if (interaction.customId === 'claim_ticket_btn') {
        const ticketData = db.getTicket(guildId, interaction.channel.id);

        if (ticketData?.claimedBy) {
          return interaction.reply({
            content: `${config.emojis.warning} This ticket has already been claimed by <@${ticketData.claimedBy}>!`,
            ephemeral: true
          });
        }

        db.saveTicket(guildId, interaction.channel.id, {
          ...ticketData,
          claimedBy: interaction.user.id
        });

        const claimEmbed = new EmbedBuilder()
          .setColor(config.successColor)
          .setDescription(`📌 **Ticket Claimed**: ${interaction.user} will be handling your request.`)
          .setTimestamp();

        await interaction.reply({ embeds: [claimEmbed] });
        return;
      }

      // DELETE TICKET
      if (interaction.customId === 'delete_ticket_btn') {
        await interaction.reply({
          content: `${config.emojis.trash} Deleting ticket channel in 5 seconds...`
        });

        db.deleteTicket(guildId, interaction.channel.id);

        setTimeout(async () => {
          try {
            await interaction.channel.delete('Ticket deleted by staff/user');
          } catch (e) {}
        }, 5000);
        return;
      }
    }
  }
};
