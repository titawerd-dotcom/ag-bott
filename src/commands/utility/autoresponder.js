const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../../database/db');
const config = require('../../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoresponder')
    .setDescription('Manage trigger keywords and target automated replies')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    // SUBCOMMAND: CREATE
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new trigger auto-responder')
        .addStringOption(opt => opt.setName('trigger').setDescription('Trigger keyword or phrase').setRequired(true))
        .addStringOption(opt => opt.setName('response').setDescription('Reply message text (or embed description)').setRequired(true))
        .addStringOption(opt => opt.setName('match_type').setDescription('Matching method').addChoices(
          { name: 'Contains Keyword', value: 'contains' },
          { name: 'Exact Match', value: 'exact' },
          { name: 'Starts With', value: 'startswith' },
          { name: 'Ends With', value: 'endswith' }
        ))
        .addStringOption(opt => opt.setName('reply_type').setDescription('Message response format').addChoices(
          { name: '🎨 Rich Embed', value: 'embed' },
          { name: '📝 Plain Text', value: 'text' }
        ))
        .addRoleOption(opt => opt.setName('mention_role').setDescription('Role to ping/mention on trigger'))
        .addStringOption(opt => opt.setName('title').setDescription('Embed Title (if embed reply)'))
        .addStringOption(opt => opt.setName('banner').setDescription('Banner Image URL (large bottom image)'))
        .addStringOption(opt => opt.setName('thumbnail').setDescription('Thumbnail Image URL (corner image)'))
        .addStringOption(opt => opt.setName('color').setDescription('Embed Color in HEX (e.g. #5865F2)'))
        .addBooleanOption(opt => opt.setName('delete_trigger').setDescription('Delete the user triggering message'))
    )
    // SUBCOMMAND: LIST
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all configured auto-responders on this server')
    )
    // SUBCOMMAND: DELETE
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete an auto-responder trigger by ID')
        .addStringOption(opt => opt.setName('id').setDescription('The ID of the trigger to remove').setRequired(true))
    )
    // SUBCOMMAND: TOGGLE
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable or disable an auto-responder trigger')
        .addStringOption(opt => opt.setName('id').setDescription('The ID of the trigger').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      const trigger = interaction.options.getString('trigger');
      const response = interaction.options.getString('response');
      const matchType = interaction.options.getString('match_type') || 'contains';
      const replyType = interaction.options.getString('reply_type') || 'embed';
      const mentionRole = interaction.options.getRole('mention_role');
      const title = interaction.options.getString('title') || '';
      const banner = interaction.options.getString('banner') || '';
      const thumbnail = interaction.options.getString('thumbnail') || '';
      const color = interaction.options.getString('color') || '#5865F2';
      const deleteTrigger = interaction.options.getBoolean('delete_trigger') || false;

      const created = db.saveAutoResponder(guildId, null, {
        trigger,
        response,
        matchType,
        replyType,
        mentionRoleId: mentionRole ? mentionRole.id : null,
        embedTitle: title,
        banner,
        thumbnail,
        embedColor: color,
        deleteTrigger,
        cooldown: 5,
        enabled: true
      });

      const embed = new EmbedBuilder()
        .setColor(config.successColor || '#57F287')
        .setTitle('✅ Auto-Responder Created Successfully')
        .addFields(
          { name: '🆔 Trigger ID', value: `\`${created.id}\``, inline: true },
          { name: '🎯 Keyword / Phrase', value: `\`${created.trigger}\``, inline: true },
          { name: '🔍 Match Mode', value: `\`${created.matchType}\``, inline: true },
          { name: '📦 Format', value: `\`${created.replyType}\``, inline: true },
          { name: '🔔 Mention Role', value: mentionRole ? `${mentionRole}` : 'None', inline: true },
          { name: '🗑️ Delete Trigger Msg', value: deleteTrigger ? 'Yes' : 'No', inline: true },
          { name: '💬 Response Body', value: `\`\`\`${created.response.slice(0, 500)}\`\`\``, inline: false }
        )
        .setFooter({ text: 'Use /autoresponder list to manage all triggers' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const responders = db.getAutoResponders(guildId);
      const list = Object.values(responders || {});

      if (list.length === 0) {
        return interaction.reply({
          content: '🎯 No auto-responder triggers configured yet on this server. Use `/autoresponder create` to add one!',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(config.defaultColor || '#5865F2')
        .setTitle(`🎯 Auto-Responder Triggers (${list.length})`)
        .setDescription('When members post any of these trigger words, the bot will automatically respond:');

      list.forEach((r, idx) => {
        const status = r.enabled ? '🟢 Active' : '🔴 Disabled';
        const roleText = r.mentionRoleId ? `<@&${r.mentionRoleId}>` : 'None';
        embed.addFields({
          name: `${idx + 1}. \`${r.trigger}\` [ID: \`${r.id}\`]`,
          value: `• **Status:** ${status} • **Match:** \`${r.matchType}\` • **Format:** \`${r.replyType}\`\n• **Mention Role:** ${roleText} • **Delete Trigger:** \`${r.deleteTrigger ? 'Yes' : 'No'}\`\n• **Response:** *${r.response.slice(0, 120)}${r.response.length > 120 ? '...' : ''}*`,
          inline: false
        });
      });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'delete') {
      const id = interaction.options.getString('id');
      const deleted = db.deleteAutoResponder(guildId, id);

      if (!deleted) {
        return interaction.reply({ content: `❌ No trigger found with ID \`${id}\`.`, ephemeral: true });
      }

      return interaction.reply({ content: `✅ Auto-responder trigger \`${id}\` deleted successfully!` });
    }

    if (sub === 'toggle') {
      const id = interaction.options.getString('id');
      const updated = db.toggleAutoResponder(guildId, id);

      if (!updated) {
        return interaction.reply({ content: `❌ No trigger found with ID \`${id}\`.`, ephemeral: true });
      }

      const stateStr = updated.enabled ? '🟢 Enabled' : '🔴 Disabled';
      return interaction.reply({ content: `Auto-responder \`${updated.trigger}\` is now **${stateStr}**.` });
    }
  }
};
