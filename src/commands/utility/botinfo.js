const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const config = require('../../../config.json');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display bot system statistics, memory usage, and uptime'),

  async execute(interaction, client) {
    const uptime = Math.floor(client.uptime / 1000);
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(config.defaultColor)
      .setTitle(`🤖 ${client.user.username} Statistics`)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '⏱️ Uptime', value: `\`${uptimeStr}\``, inline: true },
        { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: '👥 Total Users', value: `\`${client.users.cache.size}\``, inline: true },
        { name: '⚡ Discord.js', value: `\`v${djsVersion}\``, inline: true },
        { name: '🟢 Node.js', value: `\`${process.version}\``, inline: true },
        { name: '💾 Memory Used', value: `\`${memoryUsage} MB / ${totalMemory} GB\``, inline: true },
        { name: '🖥️ Platform', value: `\`${os.platform()} (${os.arch()})\``, inline: true },
        { name: '⚙️ CPU Cores', value: `\`${os.cpus().length} Cores\``, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
