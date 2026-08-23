const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the current ticket channel')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket')
    )
    .addSubcommand(sub =>
      sub.setName('claim')
        .setDescription('Claim this ticket as the active handler')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Permanently delete this ticket channel')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const ticketData = db.getTicket(guildId, interaction.channel.id);

    // If channel is not marked as ticket in DB, check name format
    const isTicketChannel = ticketData || interaction.channel.name.startsWith('ticket-');

    if (!isTicketChannel) {
      return interaction.reply({
        content: `${config.emojis.error} This command can only be used inside a ticket channel!`,
        ephemeral: true
      });
    }

    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user');
      try {
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true
        });

        const embed = new EmbedBuilder()
          .setColor(config.successColor)
          .setDescription(`${config.emojis.success} Successfully added ${targetUser} to this ticket.`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({
          content: `${config.emojis.error} Failed to add user: ${err.message}`,
          ephemeral: true
        });
      }
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      try {
        await interaction.channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: false
        });

        const embed = new EmbedBuilder()
          .setColor(config.warningColor)
          .setDescription(`${config.emojis.success} Successfully removed ${targetUser} from this ticket.`)
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        return interaction.reply({
          content: `${config.emojis.error} Failed to remove user: ${err.message}`,
          ephemeral: true
        });
      }
    }

    if (subcommand === 'close') {
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

      const embed = new EmbedBuilder()
        .setColor(config.warningColor)
        .setTitle('🔒 Ticket Closed')
        .setDescription(`Ticket has been closed by ${interaction.user}.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'claim') {
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

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`📌 **Ticket Claimed**: ${interaction.user} will be handling this ticket.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'delete') {
      await interaction.reply({
        content: `${config.emojis.trash} Deleting ticket channel in 5 seconds...`
      });

      db.deleteTicket(guildId, interaction.channel.id);

      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket deleted');
        } catch (e) {}
      }, 5000);
    }
  }
};
