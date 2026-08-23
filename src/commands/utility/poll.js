const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../../config.json');

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create an interactive community poll with up to 10 options')
    .addStringOption(opt =>
      opt.setName('question')
        .setDescription('The question or topic of the poll')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('options')
        .setDescription('Options separated by a comma (e.g. Option 1, Option 2, Option 3). Leave blank for Yes/No.')
        .setRequired(false)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post poll in (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const optionsRaw = interaction.options.getString('options');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!optionsRaw) {
      // Simple Yes / No poll
      const embed = new EmbedBuilder()
        .setColor(config.defaultColor)
        .setTitle('📊 Community Poll')
        .setDescription(`**${question}**\n\n👍 = Yes / بەڵێ\n👎 = No / نەخێر`)
        .setFooter({ text: `Created by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      const pollMessage = await targetChannel.send({ embeds: [embed] });
      await pollMessage.react('👍');
      await pollMessage.react('👎');

      return interaction.reply({
        content: `${config.emojis.success} Poll posted successfully in ${targetChannel}!`,
        ephemeral: true
      });
    }

    const options = optionsRaw.split(',').map(o => o.trim()).filter(o => o.length > 0);

    if (options.length < 2) {
      return interaction.reply({
        content: `${config.emojis.error} Please provide at least 2 options separated by commas (e.g. Option 1, Option 2)!`,
        ephemeral: true
      });
    }

    if (options.length > 10) {
      return interaction.reply({
        content: `${config.emojis.error} A maximum of 10 options is allowed!`,
        ephemeral: true
      });
    }

    const formattedOptions = options.map((opt, i) => `${numberEmojis[i]} **${opt}**`).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle('📊 Community Poll')
      .setDescription(`**${question}**\n\n${formattedOptions}`)
      .setFooter({ text: `Created by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const pollMessage = await targetChannel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      await pollMessage.react(numberEmojis[i]);
    }

    await interaction.reply({
      content: `${config.emojis.success} Multi-choice poll posted in ${targetChannel}!`,
      ephemeral: true
    });
  }
};
