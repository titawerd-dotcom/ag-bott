// Dashboard State
let currentGuilds = [];
let selectedGuildId = null;
let activeTab = 'commands-hub';
let isEmbedMode = true;

// Toast Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Insert Placeholder in Textarea
if (typeof window !== 'undefined') {
  window.insertPlaceholder = function(textareaId, placeholder) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + placeholder + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
    updateEmbedPreview();
  };
}

// -------------------------------------------------------------
// TAB SWITCHING
// -------------------------------------------------------------
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    if (!tab) return;

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const targetTab = document.getElementById(`tab-${tab}`);
    if (targetTab) targetTab.classList.add('active');

    activeTab = tab;

    const titles = {
      'commands-hub': 'Command Control Hub',
      'overview': 'Overview Dashboard',
      'voice-stats': 'Voice & Member Activity Statistics',
      'statbot': 'StatBot & Live Server Counter Channels',
      'tiktok-notify': 'TikTok NotifyMe (Live & Video Alert Studio)',
      'bulk-channels': 'Bulk Channel Operations & Multi-Channel Studio',
      'autoresponder': 'Auto Responder Studio (Trigger & Target Messages)',
      'discord-logs': 'Server & Discord Logs Studio',
      'embed-studio': 'Embed & Plain Text Studio',
      'welcome-studio': 'Welcome & Goodbye Studio',
      'tickets': 'Support Ticket Management Studio',
      'moderation': 'Warnings & Moderation Records',
      'automod': 'AutoMod Protection Studio',
      'leveling': 'Leveling & XP Leaderboards',
      'giveaways': 'Giveaways Studio',
      'button-roles': 'Button Role Panel Creator',
      'backups': 'Server Snapshot Backups',
      'console-logs': 'Live Bot Console Logs'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';

    // Trigger tab specific data load
    if (tab === 'voice-stats') fetchVoiceStats();
    if (tab === 'statbot') fetchStatBotConfig();
    if (tab === 'tiktok-notify') fetchTikTokTrackers();
    if (tab === 'bulk-channels') fetchBulkChannels();
    if (tab === 'autoresponder') fetchAutoResponders();
    if (tab === 'tickets') {
      fetchTickets();
      loadTicketFormFromConfig();
    }
    if (tab === 'discord-logs') {
      fetchDiscordLogsConfig();
      fetchAuditLogs();
    }
    if (tab === 'leveling') fetchLeaderboard();
    if (tab === 'backups') fetchBackups();
    if (tab === 'console-logs') fetchLiveLogs();
  });
});

// -------------------------------------------------------------
// FETCH GENERAL STATS
// -------------------------------------------------------------
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('bot-name').textContent = data.botName;
    if (data.botAvatar) {
      document.getElementById('bot-avatar').src = data.botAvatar;
      document.getElementById('preview-bot-avatar').src = data.botAvatar;
    }
    document.getElementById('preview-bot-name').textContent = data.botName;

    document.getElementById('ping-badge').textContent = `${data.ping} ms`;
    document.getElementById('spec-ping').textContent = `${data.ping} ms`;
    document.getElementById('uptime-badge').textContent = data.uptime;

    document.getElementById('stat-guilds').textContent = data.guildsCount;
    document.getElementById('stat-users').textContent = data.usersCount;
    document.getElementById('stat-tickets').textContent = data.totalTickets;
    document.getElementById('stat-warns').textContent = data.totalWarns;

    document.getElementById('ram-text').textContent = `${data.memoryUsedMB} MB / ${data.totalMemoryGB} GB`;
    const ramPct = Math.min(100, Math.max(5, (parseFloat(data.memoryUsedMB) / (parseFloat(data.totalMemoryGB) * 1024)) * 100));
    document.getElementById('ram-progress').style.width = `${ramPct.toFixed(1)}%`;
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

// -------------------------------------------------------------
// FETCH GUILDS & POPULATE
// -------------------------------------------------------------
async function fetchGuilds() {
  try {
    const res = await fetch('/api/guilds');
    if (!res.ok) return;
    currentGuilds = await res.json();

    const select = document.getElementById('guild-select');
    select.innerHTML = '';

    if (currentGuilds.length === 0) {
      select.innerHTML = '<option value="">No servers available</option>';
      return;
    }

    currentGuilds.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.memberCount} members)`;
      select.appendChild(opt);
    });

    if (!selectedGuildId && currentGuilds.length > 0) {
      selectedGuildId = currentGuilds[0].id;
    }
    select.value = selectedGuildId;

    loadSelectedGuildData();
  } catch (err) {
    console.error('Error fetching guilds:', err);
  }
}

document.getElementById('guild-select').addEventListener('change', (e) => {
  selectedGuildId = e.target.value;
  loadSelectedGuildData();
});

// -------------------------------------------------------------
// LOAD SELECTED GUILD CONFIG & POPULATE SELECTS
// -------------------------------------------------------------
async function loadSelectedGuildData() {
  if (!selectedGuildId) return;

  const currentGuild = currentGuilds.find(g => g.id === selectedGuildId);
  if (!currentGuild) return;

  document.getElementById('current-guild-name').textContent = currentGuild.name;
  document.getElementById('current-guild-id').textContent = `ID: ${currentGuild.id}`;
  document.getElementById('current-guild-members').textContent = `${currentGuild.memberCount} Members`;
  if (currentGuild.icon) {
    document.getElementById('current-guild-icon').src = currentGuild.icon;
  }
  document.getElementById('channel-count-badge').textContent = `${currentGuild.channels.length} text channels`;
  document.getElementById('role-count-badge').textContent = `${currentGuild.roles.length} roles`;

  // Populate Channel Selects
  const channelSelects = [
    document.getElementById('embed-target-channel'),
    document.getElementById('welcome-channel-select'),
    document.getElementById('goodbye-channel-select'),
    document.getElementById('automod-log-channel'),
    document.getElementById('leveling-channel-select'),
    document.getElementById('ga-channel-select'),
    document.getElementById('br-channel-select'),
    document.getElementById('action-purge-channel'),
    document.getElementById('action-lock-channel'),
    document.getElementById('action-slowmode-channel'),
    document.getElementById('action-nuke-channel'),
    document.getElementById('action-poll-channel'),
    document.getElementById('action-announce-channel'),
    document.getElementById('action-ticket-channel'),
    document.getElementById('ticket-panel-channel'),
    document.getElementById('logs-general-channel'),
    document.getElementById('logs-msg-channel'),
    document.getElementById('logs-member-channel'),
    document.getElementById('logs-mod-channel'),
    document.getElementById('logs-voice-channel'),
    document.getElementById('logs-server-channel'),
    document.getElementById('tiktok-channel-select')
  ];

  channelSelects.forEach(sel => {
    if (!sel) return;
    const isLeveling = sel.id === 'leveling-channel-select';
    const isSpecificLog = ['logs-msg-channel', 'logs-member-channel', 'logs-mod-channel', 'logs-voice-channel', 'logs-server-channel'].includes(sel.id);
    const isGeneralLog = sel.id === 'logs-general-channel';

    if (isLeveling) {
      sel.innerHTML = '<option value="">Current Channel (Where user chats)</option>';
    } else if (isSpecificLog) {
      sel.innerHTML = '<option value="">Use Primary Channel (Default)</option>';
    } else if (isGeneralLog) {
      sel.innerHTML = '<option value="">-- Select Primary Channel --</option>';
    } else {
      sel.innerHTML = '<option value="">-- Select Channel --</option>';
    }

    currentGuild.channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `# ${ch.name}`;
      sel.appendChild(opt);
    });
  });

  // Populate Category Selects
  const categorySelects = [
    document.getElementById('action-ticket-category'),
    document.getElementById('ticket-panel-category')
  ];
  categorySelects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="">-- No Category (Root) --</option>';
    (currentGuild.categories || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `📁 ${cat.name}`;
      sel.appendChild(opt);
    });
  });

  // Populate Role Selects
  const roleSelects = [
    document.getElementById('autorole-role-select'),
    document.getElementById('br-role-1'),
    document.getElementById('br-role-2'),
    document.getElementById('action-role-select'),
    document.getElementById('action-ticket-staffrole'),
    document.getElementById('ticket-panel-staffrole'),
    document.getElementById('ar-mention-role'),
    document.getElementById('tiktok-role-select')
  ];

  roleSelects.forEach(sel => {
    if (!sel) return;
    const isStaff = sel.id === 'action-ticket-staffrole' || sel.id === 'ticket-panel-staffrole';
    const isAutoResponder = sel.id === 'ar-mention-role';
    const isTikTok = sel.id === 'tiktok-role-select';
    if (isStaff) {
      sel.innerHTML = '<option value="">-- Administrator Only --</option>';
    } else if (isAutoResponder) {
      sel.innerHTML = '<option value="">-- No Role Mention --</option>';
    } else if (isTikTok) {
      sel.innerHTML = '<option value="">-- No Role Mention --</option><option value="everyone">@everyone</option><option value="here">@here</option>';
    } else {
      sel.innerHTML = '<option value="">-- Select Role --</option>';
    }
    currentGuild.roles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `@ ${r.name}`;
      sel.appendChild(opt);
    });
  });

  // Fetch Guild Config
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/config`);
    if (!res.ok) return;
    const data = await res.json();
    const config = data.config;

    // Welcome form
    if (config.welcome) {
      document.getElementById('welcome-toggle').checked = Boolean(config.welcome.enabled);
      document.getElementById('welcome-channel-select').value = config.welcome.channelId || '';
      document.getElementById('welcome-color').value = config.welcome.color || '#57F287';
      document.getElementById('welcome-message-input').value = config.welcome.message || '';
      document.getElementById('welcome-image-input').value = config.welcome.image || '';

      const formatRadio = document.querySelector(`input[name="welcome-format"][value="${config.welcome.isEmbed ? 'embed' : 'text'}"]`);
      if (formatRadio) formatRadio.checked = true;
    }

    // Goodbye form
    if (config.goodbye) {
      document.getElementById('goodbye-toggle').checked = Boolean(config.goodbye.enabled);
      document.getElementById('goodbye-channel-select').value = config.goodbye.channelId || '';
      document.getElementById('goodbye-message-input').value = config.goodbye.message || '';
    }

    // Autorole form
    if (config.autorole) {
      document.getElementById('autorole-toggle').checked = Boolean(config.autorole.enabled);
      document.getElementById('autorole-role-select').value = config.autorole.roleId || '';
    }

    // AutoMod form
    if (config.automod) {
      document.getElementById('automod-toggle').checked = Boolean(config.automod.enabled);
      document.getElementById('automod-anti-invite').checked = Boolean(config.automod.antiInvite);
      document.getElementById('automod-anti-links').checked = Boolean(config.automod.antiLinks);
      document.getElementById('automod-anti-spam').checked = Boolean(config.automod.antiSpam);
      document.getElementById('automod-anti-caps').checked = Boolean(config.automod.antiCaps);
      document.getElementById('automod-punishment-select').value = config.automod.punishment || 'delete';
      document.getElementById('automod-log-channel').value = config.automod.logChannelId || '';
      document.getElementById('automod-badwords-input').value = (config.automod.badWords || []).join(', ');
    }

    // Leveling form
    if (config.leveling) {
      document.getElementById('leveling-toggle').checked = Boolean(config.leveling.enabled);
      document.getElementById('leveling-channel-select').value = config.leveling.channelId || '';
      document.getElementById('leveling-message-input').value = config.leveling.message || '';
    }

    // Discord Logs form
    if (config.logs) {
      const logs = config.logs;
      document.getElementById('logs-toggle').checked = Boolean(logs.enabled);
      document.getElementById('logs-general-channel').value = logs.channelId || '';
      document.getElementById('logs-msg-channel').value = logs.msgChannelId || '';
      document.getElementById('logs-member-channel').value = logs.memberChannelId || '';
      document.getElementById('logs-mod-channel').value = logs.modChannelId || '';
      document.getElementById('logs-voice-channel').value = logs.voiceChannelId || '';
      document.getElementById('logs-server-channel').value = logs.serverChannelId || '';

      const ev = logs.events || {};
      document.getElementById('logs-event-msg-delete').checked = ev.messageDelete !== false;
      document.getElementById('logs-event-msg-update').checked = ev.messageUpdate !== false;
      document.getElementById('logs-event-member-join').checked = ev.memberAdd !== false;
      document.getElementById('logs-event-member-leave').checked = ev.memberRemove !== false;
      document.getElementById('logs-event-member-update').checked = ev.memberUpdate !== false;
      document.getElementById('logs-event-bans').checked = ev.guildBanAdd !== false;
      document.getElementById('logs-event-voice').checked = ev.voiceStateUpdate !== false;
      document.getElementById('logs-event-channels').checked = ev.channelCreate !== false;
      document.getElementById('logs-event-roles').checked = ev.roleCreate !== false;
    }

    // Render Tickets & Warns
    renderTicketsTable(config.tickets || {});
    renderWarnsTable(config.warns || {});

    if (activeTab === 'discord-logs') {
      fetchAuditLogs();
    }
    if (activeTab === 'leveling') fetchLeaderboard();
    if (activeTab === 'backups') fetchBackups();
  } catch (err) {
    console.error('Error loading guild config:', err);
  }
}

// -------------------------------------------------------------
// COMMAND CONTROL CENTER ACTIONS
// -------------------------------------------------------------

// 1. BAN
document.getElementById('action-ban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-ban-user').value.trim();
  const reason = document.getElementById('action-ban-reason').value.trim();
  const deleteDays = document.getElementById('action-ban-days').value;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason, deleteDays })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-ban-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 2. UNBAN
document.getElementById('action-unban-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-unban-user').value.trim();
  const reason = document.getElementById('action-unban-reason').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-unban-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 3. KICK
document.getElementById('action-kick-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-kick-user').value.trim();
  const reason = document.getElementById('action-kick-reason').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-kick-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 4. TIMEOUT
document.getElementById('action-timeout-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-timeout-user').value.trim();
  const durationMinutes = document.getElementById('action-timeout-duration').value;
  const reason = document.getElementById('action-timeout-reason').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/timeout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, durationMinutes, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-timeout-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// UNTIMEOUT
document.getElementById('btn-untimeout-action')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const userId = document.getElementById('action-timeout-user').value.trim();
  if (!userId) return showToast('Please enter a User ID to untimeout', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/untimeout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 5. WARN
document.getElementById('action-warn-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-warn-user').value.trim();
  const reason = document.getElementById('action-warn-reason').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/warn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-warn-form').reset();
      loadSelectedGuildData();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 6. ROLE ADD / REMOVE
document.getElementById('btn-role-add')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const userId = document.getElementById('action-role-user').value.trim();
  const roleId = document.getElementById('action-role-select').value;
  if (!userId || !roleId) return showToast('Enter user ID and select role', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roleId, action: 'add' })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

document.getElementById('btn-role-remove')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const userId = document.getElementById('action-role-user').value.trim();
  const roleId = document.getElementById('action-role-select').value;
  if (!userId || !roleId) return showToast('Enter user ID and select role', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roleId, action: 'remove' })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 7. NICKNAME
document.getElementById('action-nick-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-nick-user').value.trim();
  const nickname = document.getElementById('action-nick-val').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/nick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nickname })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 8. SET XP
document.getElementById('action-setxp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const userId = document.getElementById('action-xp-user').value.trim();
  const xp = document.getElementById('action-xp-val').value;
  const level = document.getElementById('action-level-val').value;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/setxp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, xp, level })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      if (activeTab === 'leveling') fetchLeaderboard();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 9. PURGE
document.getElementById('action-purge-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-purge-channel').value;
  const amount = document.getElementById('action-purge-amount').value;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, amount })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 10. LOCK / UNLOCK
document.getElementById('btn-lock-channel')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const channelId = document.getElementById('action-lock-channel').value;
  const reason = document.getElementById('action-lock-reason').value.trim();
  if (!channelId) return showToast('Please select a channel', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, reason })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

document.getElementById('btn-unlock-channel')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const channelId = document.getElementById('action-lock-channel').value;
  if (!channelId) return showToast('Please select a channel', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 11. SLOWMODE
document.getElementById('action-slowmode-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-slowmode-channel').value;
  const seconds = document.getElementById('action-slowmode-seconds').value;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/slowmode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, seconds })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 12. NUKE
document.getElementById('action-nuke-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-nuke-channel').value;
  if (!confirm('Are you sure you want to nuke and recreate this channel?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/nuke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      fetchGuilds();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 13. POLL
document.getElementById('action-poll-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-poll-channel').value;
  const question = document.getElementById('action-poll-question').value.trim();
  const optionsRaw = document.getElementById('action-poll-options').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, question, optionsRaw })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-poll-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 14. ANNOUNCEMENT
document.getElementById('action-announce-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-announce-channel').value;
  const title = document.getElementById('action-announce-title').value.trim();
  const message = document.getElementById('action-announce-desc').value.trim();
  const ping = document.getElementById('action-announce-ping').value;
  const imageUrl = document.getElementById('action-announce-img').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, title, message, ping, imageUrl })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      document.getElementById('action-announce-form').reset();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 15. TICKET SETUP
document.getElementById('action-ticket-deploy-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('action-ticket-channel').value;
  const categoryId = document.getElementById('action-ticket-category').value;
  const staffRoleId = document.getElementById('action-ticket-staffrole').value;
  const title = document.getElementById('action-ticket-title').value.trim();

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/ticket-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, categoryId, staffRoleId, title })
    });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// 16. TEST GREETINGS
document.getElementById('btn-test-welcome-action')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/testwelcome`, { method: 'POST' });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

document.getElementById('btn-test-goodbye-action')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/testgoodbye`, { method: 'POST' });
    const data = await res.json();
    if (data.success) showToast(data.message);
    else showToast('Error: ' + data.error, 'error');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// =============================================================
// SUPPORT TICKET STUDIO & MANAGEMENT
// =============================================================

let currentTicketsList = [];
let ticketSearchQuery = '';

// Subtab switching in Ticket Studio
document.querySelectorAll('.sub-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const subtab = btn.getAttribute('data-subtab');
    if (!subtab) return;

    document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ticket-subtab-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    const target = document.getElementById(`subtab-${subtab}`);
    if (target) target.style.display = 'block';

    if (subtab === 'ticket-manager') {
      fetchTickets();
    }
  });
});

// Load ticket form values from config
function loadTicketFormFromConfig(ticketConf) {
  if (!ticketConf) return;
  const panel = ticketConf.panel || {};
  const inside = ticketConf.insideWelcome || {};

  // Panel builder inputs
  const panelChan = document.getElementById('ticket-panel-channel');
  if (panelChan && panel.channelId) panelChan.value = panel.channelId;

  const panelCat = document.getElementById('ticket-panel-category');
  if (panelCat && ticketConf.categoryId) panelCat.value = ticketConf.categoryId;

  const panelStaff = document.getElementById('ticket-panel-staffrole');
  if (panelStaff && ticketConf.staffRoleId) panelStaff.value = ticketConf.staffRoleId;

  const panelTitle = document.getElementById('ticket-panel-title');
  if (panelTitle) panelTitle.value = panel.title || '📩 Support & Help Desk';

  const panelColor = document.getElementById('ticket-panel-color');
  if (panelColor) panelColor.value = panel.color || '#5865F2';

  const panelDesc = document.getElementById('ticket-panel-desc');
  if (panelDesc && panel.description) panelDesc.value = panel.description;

  const panelBanner = document.getElementById('ticket-panel-banner');
  if (panelBanner) panelBanner.value = panel.banner || '';

  const panelThumb = document.getElementById('ticket-panel-thumbnail');
  if (panelThumb) panelThumb.value = panel.thumbnail || '';

  const panelFooter = document.getElementById('ticket-panel-footer');
  if (panelFooter) panelFooter.value = panel.footer || '{server} • Official Support System';

  const panelBtnLabel = document.getElementById('ticket-panel-btn-label');
  if (panelBtnLabel) panelBtnLabel.value = panel.buttonLabel || 'Create Ticket';

  const panelBtnEmoji = document.getElementById('ticket-panel-btn-emoji');
  if (panelBtnEmoji) panelBtnEmoji.value = panel.buttonEmoji || '📩';

  const panelBtnStyle = document.getElementById('ticket-panel-btn-style');
  if (panelBtnStyle) panelBtnStyle.value = panel.buttonStyle || 'Primary';

  // Inside Welcome inputs
  const insideTitle = document.getElementById('ticket-inside-title');
  if (insideTitle) insideTitle.value = inside.title || '📩 Support Ticket #{ticketNumber}';

  const insideColor = document.getElementById('ticket-inside-color');
  if (insideColor) insideColor.value = inside.color || '#5865F2';

  const insideDesc = document.getElementById('ticket-inside-desc');
  if (insideDesc && inside.description) insideDesc.value = inside.description;

  const insideBanner = document.getElementById('ticket-inside-banner');
  if (insideBanner) insideBanner.value = inside.banner || '';

  const insideThumb = document.getElementById('ticket-inside-thumbnail');
  if (insideThumb) insideThumb.value = inside.thumbnail || '';

  const insideFooter = document.getElementById('ticket-inside-footer');
  if (insideFooter) insideFooter.value = inside.footer || 'Support Ticket System';

  const insidePing = document.getElementById('ticket-inside-ping');
  if (insidePing) insidePing.checked = inside.pingStaff !== false;

  updateTicketPanelPreview();
  updateTicketInsidePreview();
}

// Live preview for Ticket Panel
function updateTicketPanelPreview() {
  const title = document.getElementById('ticket-panel-title')?.value || '📩 Support & Help Desk';
  const color = document.getElementById('ticket-panel-color')?.value || '#5865F2';
  const desc = document.getElementById('ticket-panel-desc')?.value || '';
  const banner = document.getElementById('ticket-panel-banner')?.value || '';
  const thumb = document.getElementById('ticket-panel-thumbnail')?.value || '';
  const footer = document.getElementById('ticket-panel-footer')?.value || 'Server • Official Support System';
  const btnLabel = document.getElementById('ticket-panel-btn-label')?.value || 'Create Ticket';
  const btnEmoji = document.getElementById('ticket-panel-btn-emoji')?.value || '📩';
  const btnStyle = document.getElementById('ticket-panel-btn-style')?.value || 'Primary';

  const previewTitle = document.getElementById('preview-ticket-title');
  const previewDesc = document.getElementById('preview-ticket-desc');
  const previewEmbed = document.getElementById('preview-ticket-embed');
  const previewThumb = document.getElementById('preview-ticket-thumb');
  const previewBanner = document.getElementById('preview-ticket-banner');
  const previewFooter = document.getElementById('preview-ticket-footer');
  const previewBtn = document.getElementById('preview-ticket-btn');
  const previewBtnEmoji = document.getElementById('preview-ticket-btn-emoji');
  const previewBtnLabel = document.getElementById('preview-ticket-btn-label');

  if (previewTitle) previewTitle.textContent = title;
  if (previewDesc) previewDesc.innerHTML = escapeHtml(desc).replace(/\n/g, '<br>');
  if (previewEmbed) previewEmbed.style.borderLeftColor = color;
  if (previewFooter) previewFooter.textContent = footer.replace('{server}', document.getElementById('current-guild-name')?.textContent || 'Server');

  if (previewThumb) {
    if (thumb) {
      previewThumb.src = thumb;
      previewThumb.style.display = 'block';
    } else {
      previewThumb.style.display = 'none';
    }
  }

  if (previewBanner) {
    if (banner) {
      previewBanner.src = banner;
      previewBanner.style.display = 'block';
    } else {
      previewBanner.style.display = 'none';
    }
  }

  if (previewBtn) {
    previewBtn.className = `discord-btn discord-btn-${btnStyle.toLowerCase()}`;
  }
  if (previewBtnEmoji) previewBtnEmoji.textContent = btnEmoji;
  if (previewBtnLabel) previewBtnLabel.textContent = btnLabel;
}

// Live preview for Inside Ticket Welcome
function updateTicketInsidePreview() {
  const title = document.getElementById('ticket-inside-title')?.value || '📩 Support Ticket #0001';
  const color = document.getElementById('ticket-inside-color')?.value || '#5865F2';
  const desc = document.getElementById('ticket-inside-desc')?.value || '';
  const banner = document.getElementById('ticket-inside-banner')?.value || '';
  const thumb = document.getElementById('ticket-inside-thumbnail')?.value || '';
  const footer = document.getElementById('ticket-inside-footer')?.value || 'Support Ticket System';
  const ping = document.getElementById('ticket-inside-ping')?.checked;

  const previewTitle = document.getElementById('preview-inside-title');
  const previewDesc = document.getElementById('preview-inside-desc');
  const previewEmbed = document.getElementById('preview-inside-embed');
  const previewThumb = document.getElementById('preview-inside-thumb');
  const previewBanner = document.getElementById('preview-inside-banner');
  const previewFooter = document.getElementById('preview-inside-footer');
  const previewPing = document.getElementById('preview-inside-ping');

  if (previewTitle) previewTitle.textContent = title.replace('{ticketNumber}', '0001');
  if (previewDesc) {
    const formatted = escapeHtml(desc)
      .replace(/{user}/g, '@User')
      .replace(/{userName}/g, 'User')
      .replace(/{server}/g, document.getElementById('current-guild-name')?.textContent || 'Server')
      .replace(/{ticketNumber}/g, '0001')
      .replace(/\n/g, '<br>');
    previewDesc.innerHTML = formatted;
  }
  if (previewEmbed) previewEmbed.style.borderLeftColor = color;
  if (previewFooter) previewFooter.textContent = footer;

  if (previewPing) {
    previewPing.style.display = ping ? 'block' : 'none';
  }

  if (previewThumb) {
    if (thumb) {
      previewThumb.src = thumb;
      previewThumb.style.display = 'block';
    } else {
      previewThumb.style.display = 'none';
    }
  }

  if (previewBanner) {
    if (banner) {
      previewBanner.src = banner;
      previewBanner.style.display = 'block';
    } else {
      previewBanner.style.display = 'none';
    }
  }
}

// Attach input listeners for live ticket preview
[
  'ticket-panel-title',
  'ticket-panel-color',
  'ticket-panel-desc',
  'ticket-panel-banner',
  'ticket-panel-thumbnail',
  'ticket-panel-footer',
  'ticket-panel-btn-label',
  'ticket-panel-btn-emoji',
  'ticket-panel-btn-style'
].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateTicketPanelPreview);
});

[
  'ticket-inside-title',
  'ticket-inside-color',
  'ticket-inside-desc',
  'ticket-inside-banner',
  'ticket-inside-thumbnail',
  'ticket-inside-footer',
  'ticket-inside-ping'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateTicketInsidePreview);
    el.addEventListener('change', updateTicketInsidePreview);
  }
});

// Save Ticket Panel Config Only
document.getElementById('btn-save-ticket-panel')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('ticket-panel-channel').value;
  const categoryId = document.getElementById('ticket-panel-category').value || null;
  const staffRoleId = document.getElementById('ticket-panel-staffrole').value || null;

  const panel = {
    title: document.getElementById('ticket-panel-title').value,
    description: document.getElementById('ticket-panel-desc').value,
    color: document.getElementById('ticket-panel-color').value,
    banner: document.getElementById('ticket-panel-banner').value,
    thumbnail: document.getElementById('ticket-panel-thumbnail').value,
    footer: document.getElementById('ticket-panel-footer').value,
    buttonLabel: document.getElementById('ticket-panel-btn-label').value,
    buttonEmoji: document.getElementById('ticket-panel-btn-emoji').value,
    buttonStyle: document.getElementById('ticket-panel-btn-style').value,
    channelId: channelId || null
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/ticket/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, staffRoleId, panel })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Ticket panel settings saved successfully!');
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// Deploy Ticket Panel to Discord
document.getElementById('ticket-panel-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('ticket-panel-channel').value;
  if (!channelId) return showToast('Please select a target channel!', 'error');

  const categoryId = document.getElementById('ticket-panel-category').value || null;
  const staffRoleId = document.getElementById('ticket-panel-staffrole').value || null;
  const title = document.getElementById('ticket-panel-title').value;
  const description = document.getElementById('ticket-panel-desc').value;
  const color = document.getElementById('ticket-panel-color').value;
  const banner = document.getElementById('ticket-panel-banner').value;
  const thumbnail = document.getElementById('ticket-panel-thumbnail').value;
  const footer = document.getElementById('ticket-panel-footer').value;
  const buttonLabel = document.getElementById('ticket-panel-btn-label').value;
  const buttonEmoji = document.getElementById('ticket-panel-btn-emoji').value;
  const buttonStyle = document.getElementById('ticket-panel-btn-style').value;

  const btn = document.getElementById('btn-deploy-ticket-panel');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/action/ticket-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🚀 Ticket Panel deployed successfully to Discord!');
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// Save Inside Welcome Settings
document.getElementById('ticket-inside-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const insideWelcome = {
    title: document.getElementById('ticket-inside-title').value,
    description: document.getElementById('ticket-inside-desc').value,
    color: document.getElementById('ticket-inside-color').value,
    banner: document.getElementById('ticket-inside-banner').value,
    thumbnail: document.getElementById('ticket-inside-thumbnail').value,
    footer: document.getElementById('ticket-inside-footer').value,
    pingStaff: document.getElementById('ticket-inside-ping').checked
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/ticket/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insideWelcome })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Inside Ticket Welcome settings saved!');
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// Fetch Enriched Tickets List
async function fetchTickets() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading live server tickets...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tickets`);
    if (!res.ok) return;
    currentTicketsList = await res.json();
    renderTicketsTable();
  } catch (err) {
    console.error('Error fetching tickets:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Failed to load tickets.</td></tr>';
  }
}

document.getElementById('refresh-tickets-btn')?.addEventListener('click', fetchTickets);

document.getElementById('tickets-search-input')?.addEventListener('input', (e) => {
  ticketSearchQuery = e.target.value.toLowerCase();
  renderTicketsTable();
});

// Render Tickets Table with Actions
function renderTicketsTable() {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;

  let filtered = currentTicketsList;
  if (ticketSearchQuery.trim() !== '') {
    filtered = filtered.filter(t => {
      const num = String(t.ticketNumber || '');
      const opener = (t.ownerTag || '').toLowerCase();
      const chan = (t.channelName || '').toLowerCase();
      const staff = (t.claimedByTag || '').toLowerCase();
      return num.includes(ticketSearchQuery) || opener.includes(ticketSearchQuery) || chan.includes(ticketSearchQuery) || staff.includes(ticketSearchQuery);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${currentTicketsList.length === 0 ? 'No active or past tickets recorded on this server.' : 'No tickets match your search filter.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(t => {
    const tr = document.createElement('tr');
    const isClosed = t.status === 'closed';
    const statusBadge = isClosed
      ? '<span class="badge danger">🔴 Closed</span>'
      : '<span class="badge success">🟢 Open</span>';

    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString() + ' ' + new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

    const avatar = t.ownerAvatar || 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png';

    tr.innerHTML = `
      <td><strong>#${String(t.ticketNumber).padStart(4, '0')}</strong></td>
      <td>
        <div class="table-user-cell">
          <img src="${avatar}" class="table-user-avatar" alt="Avatar">
          <div>
            <strong>${escapeHtml(t.ownerTag)}</strong>
            <div class="text-muted" style="font-size:0.75rem;">${t.ownerId || ''}</div>
          </div>
        </div>
      </td>
      <td><code>#${escapeHtml(t.channelName)}</code></td>
      <td>${statusBadge}</td>
      <td>${t.claimedByTag ? `<span class="badge" style="background:rgba(88,101,242,0.15);color:var(--blurple);">📌 ${escapeHtml(t.claimedByTag)}</span>` : '<span class="text-muted">Unclaimed</span>'}</td>
      <td><small class="text-muted">${dateStr}</small></td>
      <td>
        <div class="btn-group-row" style="gap: 4px;">
          <button class="btn btn-sm btn-outline" title="Send Message" onclick="openTicketMessageModal('${t.channelId}', '${escapeHtml(t.channelName)}')">💬</button>
          ${!t.claimedBy ? `<button class="btn btn-sm btn-outline" title="Claim Ticket" onclick="executeTicketAction('${t.channelId}', 'claim')">📌</button>` : ''}
          ${!isClosed ? `<button class="btn btn-sm btn-outline" title="Close Ticket" style="color:var(--amber);" onclick="executeTicketAction('${t.channelId}', 'close')">🔒</button>` : `<button class="btn btn-sm btn-outline" title="Reopen Ticket" style="color:var(--green);" onclick="executeTicketAction('${t.channelId}', 'reopen')">🔓</button>`}
          <button class="btn btn-sm btn-outline" title="Delete Ticket" style="color:var(--red);" onclick="executeTicketAction('${t.channelId}', 'delete')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Execute Ticket Action
window.executeTicketAction = async function(channelId, action) {
  if (!selectedGuildId) return;
  if (action === 'delete' && !confirm('Are you sure you want to permanently delete this ticket channel?')) return;
  if (action === 'close' && !confirm('Close this ticket channel?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/ticket/${channelId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || `Ticket action '${action}' completed!`);
      fetchTickets();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
};

// Ticket Message Modal Logic
window.openTicketMessageModal = function(channelId, channelName) {
  const modal = document.getElementById('ticket-modal-overlay');
  const title = document.getElementById('ticket-modal-title');
  const subtitle = document.getElementById('ticket-modal-subtitle');
  const inputId = document.getElementById('ticket-modal-channel-id');
  const textarea = document.getElementById('ticket-modal-text');

  if (!modal) return;
  if (inputId) inputId.value = channelId;
  if (title) title.textContent = `💬 Message #${channelName}`;
  if (subtitle) subtitle.textContent = `Send a direct staff response to the user inside #${channelName}:`;
  if (textarea) textarea.value = '';

  modal.style.display = 'flex';
  textarea?.focus();
};

function closeTicketMessageModal() {
  const modal = document.getElementById('ticket-modal-overlay');
  if (modal) modal.style.display = 'none';
}

document.getElementById('ticket-modal-close')?.addEventListener('click', closeTicketMessageModal);
document.getElementById('ticket-modal-cancel')?.addEventListener('click', closeTicketMessageModal);

document.getElementById('ticket-modal-send')?.addEventListener('click', async () => {
  const channelId = document.getElementById('ticket-modal-channel-id')?.value;
  const message = document.getElementById('ticket-modal-text')?.value.trim();

  if (!channelId) return showToast('Ticket channel not selected', 'error');
  if (!message) return showToast('Please enter a message', 'error');

  const btn = document.getElementById('ticket-modal-send');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/ticket/${channelId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-message', message })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Message dispatched to ticket!`);
      closeTicketMessageModal();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// =============================================================
// STATBOT & SERVER COUNTERS STUDIO
// =============================================================

let currentStatBotData = null;

async function fetchStatBotConfig() {
  if (!selectedGuildId) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot`);
    if (!res.ok) return;
    currentStatBotData = await res.json();

    const conf = currentStatBotData.config || {};
    const stats = currentStatBotData.stats || {};

    // 1. Update Metrics Cards
    const totalMembers = stats.totalMembers || 0;
    const humans = stats.humans || 0;
    const bots = stats.bots || 0;
    const online = stats.online || 0;
    const voice = stats.voice || 0;
    const boosts = stats.boosts || 0;
    const tier = stats.boostTier || 0;
    const channels = stats.channels || 0;
    const roles = stats.roles || 0;

    const elMembers = document.getElementById('statbot-metric-members');
    const elBreakdown = document.getElementById('statbot-metric-breakdown');
    const elOnline = document.getElementById('statbot-metric-online');
    const elVoice = document.getElementById('statbot-metric-voice');
    const elBoosts = document.getElementById('statbot-metric-boosts');
    const elTier = document.getElementById('statbot-metric-tier');
    const elChannels = document.getElementById('statbot-metric-channels');
    const elRoles = document.getElementById('statbot-metric-roles');

    if (elMembers) elMembers.textContent = totalMembers.toLocaleString();
    if (elBreakdown) elBreakdown.textContent = `${humans.toLocaleString()} Humans • ${bots.toLocaleString()} Bots`;
    if (elOnline) elOnline.textContent = online.toLocaleString();
    if (elVoice) elVoice.textContent = voice.toLocaleString();
    if (elBoosts) elBoosts.textContent = boosts.toLocaleString();
    if (elTier) elTier.textContent = `Tier ${tier}`;
    if (elChannels) elChannels.textContent = `${channels} Channels`;
    if (elRoles) elRoles.textContent = `${roles} Roles`;

    // 2. Toggle switch
    const toggle = document.getElementById('statbot-toggle');
    if (toggle) toggle.checked = Boolean(conf.enabled);

    // 3. Channels config
    const ch = conf.channels || {};
    const setTpl = (id, chkId, key, defTpl, defChk = true) => {
      const input = document.getElementById(id);
      const chk = document.getElementById(chkId);
      if (input) input.value = ch[key]?.template || defTpl;
      if (chk) chk.checked = ch[key] ? Boolean(ch[key].enabled) : defChk;
    };

    setTpl('statbot-tpl-total', 'statbot-chk-total', 'totalMembers', '👥 Total Members: {count}', true);
    setTpl('statbot-tpl-humans', 'statbot-chk-humans', 'humans', '👤 Humans: {count}', true);
    setTpl('statbot-tpl-bots', 'statbot-chk-bots', 'bots', '🤖 Bots: {count}', true);
    setTpl('statbot-tpl-online', 'statbot-chk-online', 'online', '🟢 Online: {count}', true);
    setTpl('statbot-tpl-voice', 'statbot-chk-voice', 'voice', '🎙️ In Voice: {count}', false);
    setTpl('statbot-tpl-boosts', 'statbot-chk-boosts', 'boosts', '🚀 Boosts: {count}', false);
    setTpl('statbot-tpl-channels', 'statbot-chk-channels', 'channels', '📁 Channels: {count}', false);
    setTpl('statbot-tpl-roles', 'statbot-chk-roles', 'roles', '🎭 Roles: {count}', false);

    updateStatBotCategoryPreview();
  } catch (err) {
    console.error('Error fetching StatBot config:', err);
  }
}

// Live preview for StatBot category channel list
function updateStatBotCategoryPreview() {
  const container = document.getElementById('statbot-preview-channels');
  if (!container) return;

  const stats = currentStatBotData?.stats || {
    totalMembers: 1250,
    humans: 1210,
    bots: 40,
    online: 412,
    voice: 18,
    boosts: 7,
    channels: 35,
    roles: 24
  };

  const items = [
    { id: 'statbot-tpl-total', chk: 'statbot-chk-total', count: stats.totalMembers, def: '👥 Total Members: {count}' },
    { id: 'statbot-tpl-humans', chk: 'statbot-chk-humans', count: stats.humans, def: '👤 Humans: {count}' },
    { id: 'statbot-tpl-bots', chk: 'statbot-chk-bots', count: stats.bots, def: '🤖 Bots: {count}' },
    { id: 'statbot-tpl-online', chk: 'statbot-chk-online', count: stats.online, def: '🟢 Online: {count}' },
    { id: 'statbot-tpl-voice', chk: 'statbot-chk-voice', count: stats.voice, def: '🎙️ In Voice: {count}' },
    { id: 'statbot-tpl-boosts', chk: 'statbot-chk-boosts', count: stats.boosts, def: '🚀 Boosts: {count}' },
    { id: 'statbot-tpl-channels', chk: 'statbot-chk-channels', count: stats.channels, def: '📁 Channels: {count}' },
    { id: 'statbot-tpl-roles', chk: 'statbot-chk-roles', count: stats.roles, def: '🎭 Roles: {count}' }
  ];

  container.innerHTML = '';
  let enabledCount = 0;

  items.forEach(item => {
    const isChecked = document.getElementById(item.chk)?.checked;
    if (isChecked) {
      enabledCount++;
      const tpl = document.getElementById(item.id)?.value || item.def;
      const formatted = tpl.replace(/{count}/g, Number(item.count).toLocaleString());

      const div = document.createElement('div');
      div.className = 'discord-voice-channel-item';
      div.innerHTML = `<span class="voice-icon">🔒 🔊</span><span class="channel-text">${escapeHtml(formatted)}</span>`;
      container.appendChild(div);
    }
  });

  if (enabledCount === 0) {
    container.innerHTML = '<div class="text-muted p-2" style="font-size:0.82rem;">No counter channels enabled. Check the boxes on the left to add channels.</div>';
  }
}

// Attach live input and check listeners for StatBot preview
[
  'statbot-tpl-total', 'statbot-chk-total',
  'statbot-tpl-humans', 'statbot-chk-humans',
  'statbot-tpl-bots', 'statbot-chk-bots',
  'statbot-tpl-online', 'statbot-chk-online',
  'statbot-tpl-voice', 'statbot-chk-voice',
  'statbot-tpl-boosts', 'statbot-chk-boosts',
  'statbot-tpl-channels', 'statbot-chk-channels',
  'statbot-tpl-roles', 'statbot-chk-roles'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateStatBotCategoryPreview);
    el.addEventListener('change', updateStatBotCategoryPreview);
  }
});

// Toggle StatBot ON/OFF
document.getElementById('statbot-toggle')?.addEventListener('change', async (e) => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const enabled = e.target.checked;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(enabled ? 'StatBot enabled!' : 'StatBot disabled!');
    }
  } catch (err) {
    showToast('Failed to update toggle: ' + err.message, 'error');
  }
});

// Save StatBot Templates Form
document.getElementById('statbot-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channels = {
    totalMembers: {
      enabled: document.getElementById('statbot-chk-total')?.checked || false,
      template: document.getElementById('statbot-tpl-total')?.value || '👥 Total Members: {count}'
    },
    humans: {
      enabled: document.getElementById('statbot-chk-humans')?.checked || false,
      template: document.getElementById('statbot-tpl-humans')?.value || '👤 Humans: {count}'
    },
    bots: {
      enabled: document.getElementById('statbot-chk-bots')?.checked || false,
      template: document.getElementById('statbot-tpl-bots')?.value || '🤖 Bots: {count}'
    },
    online: {
      enabled: document.getElementById('statbot-chk-online')?.checked || false,
      template: document.getElementById('statbot-tpl-online')?.value || '🟢 Online: {count}'
    },
    voice: {
      enabled: document.getElementById('statbot-chk-voice')?.checked || false,
      template: document.getElementById('statbot-tpl-voice')?.value || '🎙️ In Voice: {count}'
    },
    boosts: {
      enabled: document.getElementById('statbot-chk-boosts')?.checked || false,
      template: document.getElementById('statbot-tpl-boosts')?.value || '🚀 Boosts: {count}'
    },
    channels: {
      enabled: document.getElementById('statbot-chk-channels')?.checked || false,
      template: document.getElementById('statbot-tpl-channels')?.value || '📁 Channels: {count}'
    },
    roles: {
      enabled: document.getElementById('statbot-chk-roles')?.checked || false,
      template: document.getElementById('statbot-tpl-roles')?.value || '🎭 Roles: {count}'
    }
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    });
    const data = await res.json();
    if (data.success) {
      showToast('StatBot channel templates saved successfully!');
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to save templates: ' + err.message, 'error');
  }
});

// Auto-Setup Stat Channels Button
document.getElementById('statbot-auto-setup-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const btn = document.getElementById('statbot-auto-setup-btn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      showToast('⚡ StatBot category & counter channels setup complete in Discord!');
      fetchStatBotConfig();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// Force Update Stat Counters Button
document.getElementById('statbot-force-update-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const btn = document.getElementById('statbot-force-update-btn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast('🔄 StatBot counter channel names synchronized!');
      fetchStatBotConfig();
    } else {
      showToast('Error: ' + (data.error || data.message), 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// Delete Stat Channels Button
document.getElementById('statbot-delete-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  if (!confirm('Are you sure you want to delete all StatBot channels and category?')) return;

  const btn = document.getElementById('statbot-delete-btn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/statbot/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast('StatBot channels deleted successfully!');
      fetchStatBotConfig();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

// =============================================================
// VOICE & MEMBER ACTIVITY STATS (STATBOT STYLE)
// =============================================================

async function fetchVoiceStats() {
  if (!selectedGuildId) return;
  const voiceTbody = document.getElementById('voice-leaderboard-body');
  const msgTbody = document.getElementById('msg-leaderboard-body');

  if (voiceTbody) voiceTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading voice statistics...</td></tr>';
  if (msgTbody) msgTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading chat statistics...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/user-stats`);
    if (!res.ok) return;
    const data = await res.json();

    const totals = data.totals || {};
    const topVoice = data.topVoice || [];
    const topMessages = data.topMessages || [];

    // Totals metrics
    const elHours = document.getElementById('vstats-total-hours');
    const elMsgs = document.getElementById('vstats-total-messages');
    const elVoice = document.getElementById('vstats-active-voice');
    const elMembers = document.getElementById('vstats-tracked-members');

    if (elHours) elHours.textContent = totals.formattedTotalVoice || '0s';
    if (elMsgs) elMsgs.textContent = (totals.totalMessages || 0).toLocaleString();
    if (elVoice) elVoice.textContent = (totals.activeVoiceCount || 0).toLocaleString();
    if (elMembers) elMembers.textContent = (totals.trackedUsersCount || 0).toLocaleString();

    // Render Voice Leaderboard
    const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    if (voiceTbody) {
      if (topVoice.length === 0) {
        voiceTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No voice activity recorded yet.</td></tr>';
      } else {
        voiceTbody.innerHTML = '';
        topVoice.forEach((u, i) => {
          const tr = document.createElement('tr');
          const emoji = rankEmojis[i] || `#${i + 1}`;
          const liveBadge = u.inVoice
            ? `<span class="badge success">🟢 In #${escapeHtml(u.voiceChannelName || 'Voice')}</span>`
            : '<span class="text-muted" style="font-size:0.8rem;">Offline</span>';

          tr.innerHTML = `
            <td><strong>${emoji}</strong></td>
            <td>
              <div class="table-user-cell">
                <img src="${u.avatar}" class="table-user-avatar" alt="Avatar">
                <div>
                  <strong>${escapeHtml(u.username)}</strong>
                  <div class="text-muted" style="font-size:0.75rem;">${u.tag}</div>
                </div>
              </div>
            </td>
            <td><strong style="color:var(--blurple);">${escapeHtml(u.formattedVoiceTime)}</strong></td>
            <td><code>${(u.voiceSessions || 0).toLocaleString()} sessions</code></td>
            <td>${liveBadge}</td>
          `;
          voiceTbody.appendChild(tr);
        });
      }
    }

    // Render Chat Messages Leaderboard
    if (msgTbody) {
      if (topMessages.length === 0) {
        msgTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No message activity recorded yet.</td></tr>';
      } else {
        msgTbody.innerHTML = '';
        topMessages.forEach((u, i) => {
          const tr = document.createElement('tr');
          const emoji = rankEmojis[i] || `#${i + 1}`;

          tr.innerHTML = `
            <td><strong>${emoji}</strong></td>
            <td>
              <div class="table-user-cell">
                <img src="${u.avatar}" class="table-user-avatar" alt="Avatar">
                <div>
                  <strong>${escapeHtml(u.username)}</strong>
                  <div class="text-muted" style="font-size:0.75rem;">${u.tag}</div>
                </div>
              </div>
            </td>
            <td><strong style="color:var(--green);">${(u.messagesCount || 0).toLocaleString()} msgs</strong></td>
            <td><small class="text-muted">${escapeHtml(u.formattedVoiceTime)}</small></td>
          `;
          msgTbody.appendChild(tr);
        });
      }
    }
  } catch (err) {
    console.error('Error fetching voice stats:', err);
  }
}

document.getElementById('refresh-voice-stats-btn')?.addEventListener('click', fetchVoiceStats);
document.getElementById('refresh-msg-stats-btn')?.addEventListener('click', fetchVoiceStats);

// Reset Stats Event Listeners
document.getElementById('btn-reset-all-voice-stats')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  if (!confirm('Are you sure you want to reset all voice activity duration statistics for this server?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/user-stats/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'voice' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('All server voice activity statistics reset!');
      fetchVoiceStats();
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

document.getElementById('btn-reset-all-msg-stats')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  if (!confirm('Are you sure you want to reset all chat message counts for this server?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/user-stats/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'messages' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('All server chat message counts reset!');
      fetchVoiceStats();
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

document.getElementById('btn-reset-all-server-stats')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  if (!confirm('⚠️ Are you sure you want to completely wipe ALL user statistics (Voice & Chat) for this server?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/user-stats/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'all' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('All user statistics cleared!');
      fetchVoiceStats();
    }
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
});

// =============================================================
// TIKTOK NOTIFYME STUDIO (LIVE & VIDEO ALERTS)
// =============================================================

let currentTikTokTrackers = {};

async function fetchTikTokTrackers() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('tiktok-table-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Loading TikTok trackers...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tiktok-trackers`);
    if (!res.ok) return;
    currentTikTokTrackers = await res.json();
    renderTikTokTrackersTable();
  } catch (err) {
    console.error('Error loading TikTok trackers:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Failed to load TikTok trackers.</td></tr>';
  }
}

document.getElementById('refresh-tiktok-btn')?.addEventListener('click', fetchTikTokTrackers);

function renderTikTokTrackersTable() {
  const tbody = document.getElementById('tiktok-table-tbody');
  if (!tbody) return;

  const entries = Object.values(currentTikTokTrackers || {});
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No TikTok creators monitored yet on this server.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  entries.forEach(t => {
    const tr = document.createElement('tr');
    const statusBadge = t.enabled
      ? '<span class="badge success">🟢 Active</span>'
      : '<span class="badge danger">🔴 Disabled</span>';

    const eventsBadge = `
      ${t.notifyLive ? '<span class="badge" style="background:rgba(254,44,85,0.2);color:#fe2c55;border:1px solid rgba(254,44,85,0.4);">🔴 LIVE</span>' : ''}
      ${t.notifyVideo ? '<span class="badge" style="background:rgba(88,101,242,0.2);color:var(--blurple);">🎬 Video</span>' : ''}
    `;

    let roleText = '<span class="text-muted">None</span>';
    if (t.mentionRoleId === 'everyone') roleText = '<span class="badge">@everyone</span>';
    else if (t.mentionRoleId === 'here') roleText = '<span class="badge">@here</span>';
    else if (t.mentionRoleId) roleText = `<span class="badge" style="background:rgba(88,101,242,0.15);color:var(--blurple);">@Role (${t.mentionRoleId})</span>`;

    tr.innerHTML = `
      <td>
        <div class="table-user-cell">
          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(t.tiktokUsername)}&background=FE2C55&color=fff&size=64" class="table-user-avatar" alt="Avatar">
          <div>
            <strong>@${escapeHtml(t.tiktokUsername)}</strong>
            <div><a href="https://www.tiktok.com/@${escapeHtml(t.tiktokUsername)}" target="_blank" style="font-size:0.75rem;color:var(--blurple);">View on TikTok ↗</a></div>
          </div>
        </div>
      </td>
      <td><code>#<span id="tt-chan-name-${t.id}">${t.channelId}</span></code></td>
      <td>${roleText}</td>
      <td>${eventsBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="btn-group-row" style="gap: 4px;">
          <button class="btn btn-sm btn-outline" title="Send Test Alert" onclick="testTikTokTrackerAction('${t.id}')">🧪 Test</button>
          <button class="btn btn-sm btn-outline" title="Edit Tracker" onclick="editTikTokTrackerAction('${t.id}')">✏️</button>
          <button class="btn btn-sm btn-outline" title="Toggle Tracker" onclick="toggleTikTokTrackerAction('${t.id}', ${!t.enabled})">🔄</button>
          <button class="btn btn-sm btn-outline" title="Delete Tracker" style="color:var(--red);" onclick="deleteTikTokTrackerAction('${t.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Live Discord Preview for TikTok
function updateTikTokPreview() {
  const username = (document.getElementById('tiktok-username')?.value || 'kurdish_creator').replace(/^@/, '').trim();
  const customMessage = document.getElementById('tiktok-custom-message')?.value || '🔥 **{author}** is now **LIVE** on TikTok! Join the stream: {url}';
  const embedTitle = document.getElementById('tiktok-embed-title')?.value || '🔴 TikTok Live Stream Alert!';
  const embedColor = document.getElementById('tiktok-embed-color')?.value || '#FE2C55';
  const banner = document.getElementById('tiktok-banner-url')?.value || '';
  const roleSelect = document.getElementById('tiktok-role-select');
  const selectedRole = roleSelect ? roleSelect.value : '';

  const elRolePing = document.getElementById('tt-preview-role-ping');
  const elRoleText = document.getElementById('tt-preview-role-text');
  const elMsg = document.getElementById('tt-preview-msg');
  const elEmbed = document.getElementById('tt-preview-embed');
  const elTitle = document.getElementById('tt-preview-title');
  const elThumb = document.getElementById('tt-preview-thumb');
  const elBanner = document.getElementById('tt-preview-banner');

  if (selectedRole && selectedRole !== '') {
    if (elRolePing) elRolePing.style.display = 'block';
    if (elRoleText) elRoleText.textContent = selectedRole === 'everyone' ? '@everyone' : selectedRole === 'here' ? '@here' : `@Role`;
  } else {
    if (elRolePing) elRolePing.style.display = 'none';
  }

  if (elMsg) {
    const formatted = customMessage
      .replace(/{author}/g, `<strong>${username}</strong>`)
      .replace(/{username}/g, `@${username}`)
      .replace(/{url}/g, `https://www.tiktok.com/@${username}/live`)
      .replace(/{title}/g, embedTitle)
      .replace(/{role}/g, selectedRole ? `@${selectedRole}` : '');
    elMsg.innerHTML = formatted;
  }

  if (elEmbed) elEmbed.style.borderLeftColor = embedColor;
  if (elTitle) elTitle.textContent = embedTitle;
  if (elThumb) elThumb.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=FE2C55&color=fff&size=128`;

  if (elBanner) {
    if (banner.trim()) {
      elBanner.src = banner;
      elBanner.style.display = 'block';
    } else {
      elBanner.style.display = 'none';
    }
  }
}

// Attach TikTok input listeners
[
  'tiktok-username',
  'tiktok-channel-select',
  'tiktok-role-select',
  'tiktok-custom-message',
  'tiktok-embed-title',
  'tiktok-embed-color',
  'tiktok-banner-url'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateTikTokPreview);
    el.addEventListener('change', updateTikTokPreview);
  }
});

// Save TikTok Tracker Form
document.getElementById('tiktok-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    id: document.getElementById('tiktok-edit-id')?.value || undefined,
    tiktokUsername: document.getElementById('tiktok-username')?.value.trim(),
    channelId: document.getElementById('tiktok-channel-select')?.value,
    mentionRoleId: document.getElementById('tiktok-role-select')?.value || null,
    notifyLive: document.getElementById('tiktok-notify-live')?.checked || false,
    notifyVideo: document.getElementById('tiktok-notify-video')?.checked || false,
    customMessage: document.getElementById('tiktok-custom-message')?.value.trim(),
    embedTitle: document.getElementById('tiktok-embed-title')?.value.trim() || '🔴 TikTok Live Stream Alert!',
    embedColor: document.getElementById('tiktok-embed-color')?.value || '#FE2C55',
    banner: document.getElementById('tiktok-banner-url')?.value.trim() || undefined,
    enabled: true
  };

  const submitBtn = document.getElementById('tiktok-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tiktok-tracker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('📱 TikTok NotifyMe tracker saved successfully!');
      resetTikTokForm();
      fetchTikTokTrackers();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

function resetTikTokForm() {
  const form = document.getElementById('tiktok-form');
  if (form) form.reset();
  const idInput = document.getElementById('tiktok-edit-id');
  if (idInput) idInput.value = '';
  const formTitle = document.getElementById('tiktok-form-title');
  if (formTitle) formTitle.textContent = '📱 TikTok Live & Video Notification Studio';
  const submitBtn = document.getElementById('tiktok-submit-btn');
  if (submitBtn) submitBtn.textContent = '💾 Save TikTok Tracker';
  updateTikTokPreview();
}

document.getElementById('tiktok-reset-btn')?.addEventListener('click', resetTikTokForm);

window.testTikTokTrackerAction = async function(id) {
  if (!selectedGuildId) return;
  showToast('🧪 Sending test TikTok alert to Discord...', 'info');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tiktok-tracker/${id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message);
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
};

window.editTikTokTrackerAction = function(id) {
  const t = currentTikTokTrackers[id];
  if (!t) return;

  const idInput = document.getElementById('tiktok-edit-id');
  const userInput = document.getElementById('tiktok-username');
  const chanSelect = document.getElementById('tiktok-channel-select');
  const roleSelect = document.getElementById('tiktok-role-select');
  const liveCheck = document.getElementById('tiktok-notify-live');
  const vidCheck = document.getElementById('tiktok-notify-video');
  const msgInput = document.getElementById('tiktok-custom-message');
  const titleInput = document.getElementById('tiktok-embed-title');
  const colorInput = document.getElementById('tiktok-embed-color');
  const bannerInput = document.getElementById('tiktok-banner-url');
  const formTitle = document.getElementById('tiktok-form-title');
  const submitBtn = document.getElementById('tiktok-submit-btn');

  if (idInput) idInput.value = t.id;
  if (userInput) userInput.value = t.tiktokUsername || '';
  if (chanSelect) chanSelect.value = t.channelId || '';
  if (roleSelect) roleSelect.value = t.mentionRoleId || '';
  if (liveCheck) liveCheck.checked = t.notifyLive !== false;
  if (vidCheck) vidCheck.checked = t.notifyVideo !== false;
  if (msgInput) msgInput.value = t.customMessage || '';
  if (titleInput) titleInput.value = t.embedTitle || '🔴 TikTok Live Stream Alert!';
  if (colorInput) colorInput.value = t.embedColor || '#FE2C55';
  if (bannerInput) bannerInput.value = t.banner || '';

  if (formTitle) formTitle.textContent = `✏️ Editing TikTok Tracker: @${t.tiktokUsername}`;
  if (submitBtn) submitBtn.textContent = '💾 Update TikTok Tracker';

  updateTikTokPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleTikTokTrackerAction = async function(id, enabled) {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tiktok-tracker/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      fetchTikTokTrackers();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
};

window.deleteTikTokTrackerAction = async function(id) {
  if (!selectedGuildId) return;
  if (!confirm('Are you sure you want to delete this TikTok tracker?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/tiktok-tracker/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('TikTok tracker deleted!');
      fetchTikTokTrackers();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
};

// =============================================================
// BULK CHANNEL OPERATIONS STUDIO
// =============================================================

let currentBulkChannels = [];
let currentBulkCategories = [];
const selectedBulkChannelIds = new Set();

async function fetchBulkChannels() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('bulk-channels-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading channels...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/channels/detailed`);
    if (!res.ok) return;
    const data = await res.json();

    currentBulkChannels = data.channels || [];
    currentBulkCategories = data.categories || [];
    selectedBulkChannelIds.clear();
    updateBulkActionBar();

    // Update stat metrics
    const totalCount = currentBulkChannels.length;
    const textCount = currentBulkChannels.filter(c => c.type === 0 || c.type === 5).length;
    const voiceCount = currentBulkChannels.filter(c => c.type === 2 || c.type === 13).length;
    const catCount = currentBulkCategories.length;

    const elTotal = document.getElementById('bulk-stat-total');
    const elText = document.getElementById('bulk-stat-text');
    const elVoice = document.getElementById('bulk-stat-voice');
    const elCats = document.getElementById('bulk-stat-categories');

    if (elTotal) elTotal.textContent = totalCount;
    if (elText) elText.textContent = textCount;
    if (elVoice) elVoice.textContent = voiceCount;
    if (elCats) elCats.textContent = catCount;

    // Populate category dropdowns
    const catFilter = document.getElementById('bulk-filter-category');
    const catMoveSelect = document.getElementById('bulk-target-category-select');

    if (catFilter) {
      catFilter.innerHTML = '<option value="">-- All Categories --</option>';
      currentBulkCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `📁 ${c.name} (${c.childrenCount || 0})`;
        catFilter.appendChild(opt);
      });
    }

    if (catMoveSelect) {
      catMoveSelect.innerHTML = '<option value="">-- No Category (Root Level) --</option>';
      currentBulkCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `📁 ${c.name}`;
        catMoveSelect.appendChild(opt);
      });
    }

    renderBulkChannelsTable();
  } catch (err) {
    console.error('Error fetching channels for bulk studio:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Failed to load channels.</td></tr>';
  }
}

document.getElementById('bulk-btn-refresh')?.addEventListener('click', fetchBulkChannels);

function getFilteredBulkChannels() {
  const searchTerm = (document.getElementById('bulk-filter-search')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('bulk-filter-category')?.value || '';
  const typeFilter = document.getElementById('bulk-filter-type')?.value;

  return currentBulkChannels.filter(ch => {
    if (searchTerm && !ch.name.toLowerCase().includes(searchTerm)) return false;
    if (categoryFilter && ch.parentId !== categoryFilter && ch.id !== categoryFilter) return false;
    if (typeFilter !== '' && typeFilter !== undefined && typeFilter !== null) {
      if (String(ch.type) !== String(typeFilter)) return false;
    }
    return true;
  });
}

function renderBulkChannelsTable() {
  const tbody = document.getElementById('bulk-channels-tbody');
  if (!tbody) return;

  const filtered = getFilteredBulkChannels();

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No channels match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(ch => {
    const isChecked = selectedBulkChannelIds.has(ch.id);
    const tr = document.createElement('tr');
    tr.className = isChecked ? 'bulk-row-selected' : '';

    const lockBadge = ch.isLocked ? '<span class="badge danger" title="Locked">🔒 Locked</span>' : '';
    const hideBadge = ch.isHidden ? '<span class="badge" style="background:rgba(255,255,255,0.1);" title="Hidden">👁️ Hidden</span>' : '';
    const statusBadges = (lockBadge || hideBadge) ? `${lockBadge} ${hideBadge}` : '<span class="text-muted">Public</span>';

    const slowmodeStr = ch.slowmode > 0 ? `<span class="badge" style="color:var(--amber);background:rgba(254,231,92,0.15);">⏳ ${ch.slowmode}s</span>` : '<span class="text-muted">Off</span>';

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="bulk-item-checkbox" data-id="${ch.id}" ${isChecked ? 'checked' : ''}>
      </td>
      <td>
        <strong>${ch.icon} ${escapeHtml(ch.name)}</strong>
      </td>
      <td><span class="badge">${escapeHtml(ch.typeName)}</span></td>
      <td><small class="text-muted">📁 ${escapeHtml(ch.parentName)}</small></td>
      <td>${slowmodeStr}</td>
      <td>${statusBadges}</td>
      <td><code>${ch.id}</code></td>
    `;

    const checkbox = tr.querySelector('.bulk-item-checkbox');
    checkbox?.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selectedBulkChannelIds.add(ch.id);
        tr.classList.add('bulk-row-selected');
      } else {
        selectedBulkChannelIds.delete(ch.id);
        tr.classList.remove('bulk-row-selected');
      }
      updateBulkActionBar();
    });

    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });

    tbody.appendChild(tr);
  });

  updateHeaderCheckboxState();
}

function updateHeaderCheckboxState() {
  const headerCb = document.getElementById('bulk-header-checkbox');
  if (!headerCb) return;
  const filtered = getFilteredBulkChannels();
  if (filtered.length === 0) {
    headerCb.checked = false;
    return;
  }
  const allSelected = filtered.every(ch => selectedBulkChannelIds.has(ch.id));
  headerCb.checked = allSelected;
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulk-action-bar');
  const countEl = document.getElementById('bulk-selected-count');
  const count = selectedBulkChannelIds.size;

  if (countEl) countEl.textContent = count;
  if (bar) {
    bar.style.display = count > 0 ? 'flex' : 'none';
  }
  updateHeaderCheckboxState();
}

// Attach filter listeners
['bulk-filter-search', 'bulk-filter-category', 'bulk-filter-type'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', renderBulkChannelsTable);
    el.addEventListener('change', renderBulkChannelsTable);
  }
});

// Header Checkbox
document.getElementById('bulk-header-checkbox')?.addEventListener('change', (e) => {
  const checked = e.target.checked;
  const filtered = getFilteredBulkChannels();
  filtered.forEach(ch => {
    if (checked) {
      selectedBulkChannelIds.add(ch.id);
    } else {
      selectedBulkChannelIds.delete(ch.id);
    }
  });
  renderBulkChannelsTable();
  updateBulkActionBar();
});

// Quick Selection Buttons
document.getElementById('bulk-btn-select-all')?.addEventListener('click', () => {
  const filtered = getFilteredBulkChannels();
  filtered.forEach(ch => selectedBulkChannelIds.add(ch.id));
  renderBulkChannelsTable();
  updateBulkActionBar();
});

document.getElementById('bulk-btn-deselect-all')?.addEventListener('click', () => {
  selectedBulkChannelIds.clear();
  renderBulkChannelsTable();
  updateBulkActionBar();
});

document.getElementById('bulk-btn-invert')?.addEventListener('click', () => {
  const filtered = getFilteredBulkChannels();
  filtered.forEach(ch => {
    if (selectedBulkChannelIds.has(ch.id)) {
      selectedBulkChannelIds.delete(ch.id);
    } else {
      selectedBulkChannelIds.add(ch.id);
    }
  });
  renderBulkChannelsTable();
  updateBulkActionBar();
});

document.getElementById('bulk-btn-select-text')?.addEventListener('click', () => {
  selectedBulkChannelIds.clear();
  currentBulkChannels.filter(c => c.type === 0 || c.type === 5).forEach(c => selectedBulkChannelIds.add(c.id));
  renderBulkChannelsTable();
  updateBulkActionBar();
});

document.getElementById('bulk-btn-select-voice')?.addEventListener('click', () => {
  selectedBulkChannelIds.clear();
  currentBulkChannels.filter(c => c.type === 2 || c.type === 13).forEach(c => selectedBulkChannelIds.add(c.id));
  renderBulkChannelsTable();
  updateBulkActionBar();
});

// Bulk Action Execution Engine
async function executeBulkChannelAction(action, options = {}) {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  const channelIds = Array.from(selectedBulkChannelIds);
  if (channelIds.length === 0) return showToast('No channels selected!', 'error');

  const actionLabels = {
    delete: 'DELETE',
    nuke: 'NUKE & WIPE',
    lock: 'LOCK',
    unlock: 'UNLOCK',
    slowmode: 'SET SLOWMODE',
    move: 'MOVE TO CATEGORY',
    hide: 'HIDE',
    unhide: 'UNHIDE'
  };

  showToast(`⚡ Processing bulk ${actionLabels[action] || action} on ${channelIds.length} channel(s)...`, 'info');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/channels/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelIds,
        action,
        options
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`✅ ${data.message}`);
      selectedBulkChannelIds.clear();
      updateBulkActionBar();
      fetchBulkChannels();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Bulk Action Failed: ' + err.message, 'error');
  }
}

// Bulk Action Buttons
document.getElementById('bulk-act-delete')?.addEventListener('click', () => {
  const count = selectedBulkChannelIds.size;
  if (!confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY DELETE ${count} selected channel(s)? This action cannot be undone!`)) return;
  executeBulkChannelAction('delete');
});

document.getElementById('bulk-act-nuke')?.addEventListener('click', () => {
  const count = selectedBulkChannelIds.size;
  if (!confirm(`💥 Are you sure you want to NUKE (wipe all message history and recreate) ${count} selected channel(s)?`)) return;
  executeBulkChannelAction('nuke');
});

document.getElementById('bulk-act-lock')?.addEventListener('click', () => {
  executeBulkChannelAction('lock');
});

document.getElementById('bulk-act-unlock')?.addEventListener('click', () => {
  executeBulkChannelAction('unlock');
});

document.getElementById('bulk-act-hide')?.addEventListener('click', () => {
  executeBulkChannelAction('hide');
});

document.getElementById('bulk-act-unhide')?.addEventListener('click', () => {
  executeBulkChannelAction('unhide');
});

// Modals Handling
window.closeBulkModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
};

document.getElementById('bulk-act-move')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-bulk-move');
  const countEl = document.getElementById('bulk-move-target-count');
  if (countEl) countEl.textContent = selectedBulkChannelIds.size;
  if (modal) modal.style.display = 'flex';
});

document.getElementById('bulk-confirm-move-btn')?.addEventListener('click', () => {
  const targetCatId = document.getElementById('bulk-target-category-select')?.value || null;
  closeBulkModal('modal-bulk-move');
  executeBulkChannelAction('move', { categoryId: targetCatId });
});

document.getElementById('bulk-act-slowmode')?.addEventListener('click', () => {
  const modal = document.getElementById('modal-bulk-slowmode');
  const countEl = document.getElementById('bulk-slowmode-target-count');
  if (countEl) countEl.textContent = selectedBulkChannelIds.size;
  if (modal) modal.style.display = 'flex';
});

document.getElementById('bulk-confirm-slowmode-btn')?.addEventListener('click', () => {
  const slowmodeSec = Number(document.getElementById('bulk-target-slowmode-select')?.value) || 0;
  closeBulkModal('modal-bulk-slowmode');
  executeBulkChannelAction('slowmode', { slowmodeSeconds: slowmodeSec });
});

// =============================================================
// AUTO RESPONDER STUDIO (TRIGGER & TARGET REPLIES)
// =============================================================

let currentAutoResponders = {};

async function fetchAutoResponders() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('ar-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading auto-responders...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/autoresponders`);
    if (!res.ok) return;
    currentAutoResponders = await res.json();
    renderAutoRespondersTable();
  } catch (err) {
    console.error('Error loading auto-responders:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Failed to load auto-responders.</td></tr>';
  }
}

document.getElementById('refresh-ar-btn')?.addEventListener('click', fetchAutoResponders);

function renderAutoRespondersTable() {
  const tbody = document.getElementById('ar-table-body');
  if (!tbody) return;

  const entries = Object.values(currentAutoResponders || {});
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No auto-responders configured yet on this server.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  entries.forEach(r => {
    const tr = document.createElement('tr');
    const statusBadge = r.enabled
      ? '<span class="badge success">🟢 Active</span>'
      : '<span class="badge danger">🔴 Disabled</span>';

    const roleTag = r.mentionRoleId
      ? `<span class="badge" style="background:rgba(88,101,242,0.15);color:var(--blurple);">@Role (${r.mentionRoleId})</span>`
      : '<span class="text-muted">None</span>';

    const replyTypeBadge = r.replyType === 'embed'
      ? '<span class="badge" style="background:rgba(235,77,75,0.15);color:#ff79cd;">🎨 Embed</span>'
      : '<span class="badge">📝 Text</span>';

    tr.innerHTML = `
      <td><code>${escapeHtml(r.trigger)}</code></td>
      <td><span class="badge">${escapeHtml(r.matchType || 'contains')}</span></td>
      <td>${replyTypeBadge}</td>
      <td>${roleTag}</td>
      <td><span title="${escapeHtml(r.response)}">${escapeHtml(r.response.slice(0, 45))}${r.response.length > 45 ? '...' : ''}</span></td>
      <td>${statusBadge}</td>
      <td>
        <div class="btn-group-row" style="gap: 4px;">
          <button class="btn btn-sm btn-outline" title="Edit Trigger" onclick="editAutoResponder('${r.id}')">✏️</button>
          <button class="btn btn-sm btn-outline" title="Toggle Trigger" onclick="toggleAutoResponderAction('${r.id}', ${!r.enabled})">🔄</button>
          <button class="btn btn-sm btn-outline" title="Delete Trigger" style="color:var(--red);" onclick="deleteAutoResponderAction('${r.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Live Discord Preview for Auto-Responder
function updateAutoResponderPreview() {
  const replyType = document.getElementById('ar-reply-type')?.value || 'embed';
  const response = document.getElementById('ar-response')?.value || 'Hello @User, your response text will appear here in real-time...';
  const title = document.getElementById('ar-title')?.value || '';
  const color = document.getElementById('ar-color')?.value || '#5865F2';
  const banner = document.getElementById('ar-banner')?.value || '';
  const thumb = document.getElementById('ar-thumbnail')?.value || '';
  const footer = document.getElementById('ar-footer')?.value || '';
  const roleSelect = document.getElementById('ar-mention-role');
  const selectedRoleName = roleSelect && roleSelect.selectedIndex > 0 ? roleSelect.options[roleSelect.selectedIndex].text : '';

  const elEmbedFields = document.getElementById('ar-embed-fields');
  const elMediaFields = document.getElementById('ar-media-fields');
  const elRolePing = document.getElementById('ar-preview-role-ping');
  const elRoleText = document.getElementById('ar-preview-role-text');
  const elText = document.getElementById('ar-preview-text');
  const elEmbed = document.getElementById('ar-preview-embed');
  const elTitle = document.getElementById('ar-preview-embed-title');
  const elDesc = document.getElementById('ar-preview-embed-desc');
  const elThumb = document.getElementById('ar-preview-thumb');
  const elBanner = document.getElementById('ar-preview-banner');
  const elFooter = document.getElementById('ar-preview-footer');

  // Show / hide fields according to format
  if (replyType === 'text') {
    if (elEmbedFields) elEmbedFields.style.display = 'none';
    if (elMediaFields) elMediaFields.style.display = 'none';
    if (elText) {
      elText.style.display = 'block';
      elText.innerHTML = escapeHtml(response).replace(/\n/g, '<br>');
    }
    if (elEmbed) elEmbed.style.display = 'none';
  } else {
    if (elEmbedFields) elEmbedFields.style.display = 'block';
    if (elMediaFields) elMediaFields.style.display = 'block';
    if (elText) elText.style.display = 'none';
    if (elEmbed) {
      elEmbed.style.display = 'block';
      elEmbed.style.borderLeftColor = color;
    }
    if (elTitle) {
      if (title.trim()) {
        elTitle.textContent = title;
        elTitle.style.display = 'block';
      } else {
        elTitle.style.display = 'none';
      }
    }
    if (elDesc) {
      elDesc.innerHTML = escapeHtml(response).replace(/\n/g, '<br>');
    }
    if (elThumb) {
      if (thumb.trim()) {
        elThumb.src = thumb;
        elThumb.style.display = 'block';
      } else {
        elThumb.style.display = 'none';
      }
    }
    if (elBanner) {
      if (banner.trim()) {
        elBanner.src = banner;
        elBanner.style.display = 'block';
      } else {
        elBanner.style.display = 'none';
      }
    }
    if (elFooter) {
      if (footer.trim()) {
        elFooter.textContent = footer.replace('{server}', document.getElementById('current-guild-name')?.textContent || 'Server');
        elFooter.style.display = 'block';
      } else {
        elFooter.style.display = 'none';
      }
    }
  }

  // Role ping line preview
  if (selectedRoleName && selectedRoleName !== '-- No Role Mention --') {
    if (elRolePing) elRolePing.style.display = 'block';
    if (elRoleText) elRoleText.textContent = selectedRoleName;
  } else {
    if (elRolePing) elRolePing.style.display = 'none';
  }
}

// Attach input listeners for live Auto-Responder preview
[
  'ar-trigger',
  'ar-match-type',
  'ar-reply-type',
  'ar-response',
  'ar-title',
  'ar-color',
  'ar-thumbnail',
  'ar-banner',
  'ar-footer',
  'ar-mention-role'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateAutoResponderPreview);
    el.addEventListener('change', updateAutoResponderPreview);
  }
});

// Save Auto-Responder Form
document.getElementById('ar-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    id: document.getElementById('ar-edit-id')?.value || undefined,
    trigger: document.getElementById('ar-trigger')?.value.trim(),
    matchType: document.getElementById('ar-match-type')?.value,
    replyType: document.getElementById('ar-reply-type')?.value,
    response: document.getElementById('ar-response')?.value.trim(),
    embedTitle: document.getElementById('ar-title')?.value.trim() || undefined,
    embedColor: document.getElementById('ar-color')?.value || '#5865F2',
    thumbnail: document.getElementById('ar-thumbnail')?.value.trim() || undefined,
    banner: document.getElementById('ar-banner')?.value.trim() || undefined,
    footer: document.getElementById('ar-footer')?.value.trim() || undefined,
    mentionRoleId: document.getElementById('ar-mention-role')?.value || null,
    deleteTrigger: document.getElementById('ar-delete-trigger')?.checked || false,
    cooldown: Number(document.getElementById('ar-cooldown')?.value) || 5,
    enabled: true
  };

  const submitBtn = document.getElementById('ar-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/autoresponder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎯 Auto-responder trigger saved successfully!');
      resetAutoResponderForm();
      fetchAutoResponders();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

function resetAutoResponderForm() {
  const form = document.getElementById('ar-form');
  if (form) form.reset();
  const idInput = document.getElementById('ar-edit-id');
  if (idInput) idInput.value = '';
  const headerTitle = document.getElementById('ar-form-header-title');
  if (headerTitle) headerTitle.textContent = '🎯 Trigger & Target Auto-Message Creator';
  const submitBtn = document.getElementById('ar-submit-btn');
  if (submitBtn) submitBtn.textContent = '💾 Save Auto-Responder Trigger';
  updateAutoResponderPreview();
}

document.getElementById('ar-reset-btn')?.addEventListener('click', resetAutoResponderForm);

window.editAutoResponder = function(id) {
  const r = currentAutoResponders[id];
  if (!r) return;

  const idInput = document.getElementById('ar-edit-id');
  const trigInput = document.getElementById('ar-trigger');
  const matchSelect = document.getElementById('ar-match-type');
  const replySelect = document.getElementById('ar-reply-type');
  const respInput = document.getElementById('ar-response');
  const titleInput = document.getElementById('ar-title');
  const colorInput = document.getElementById('ar-color');
  const thumbInput = document.getElementById('ar-thumbnail');
  const bannerInput = document.getElementById('ar-banner');
  const footerInput = document.getElementById('ar-footer');
  const roleSelect = document.getElementById('ar-mention-role');
  const delCheck = document.getElementById('ar-delete-trigger');
  const cdSelect = document.getElementById('ar-cooldown');
  const headerTitle = document.getElementById('ar-form-header-title');
  const submitBtn = document.getElementById('ar-submit-btn');

  if (idInput) idInput.value = r.id;
  if (trigInput) trigInput.value = r.trigger || '';
  if (matchSelect) matchSelect.value = r.matchType || 'contains';
  if (replySelect) replySelect.value = r.replyType || 'embed';
  if (respInput) respInput.value = r.response || '';
  if (titleInput) titleInput.value = r.embedTitle || '';
  if (colorInput) colorInput.value = r.embedColor || '#5865F2';
  if (thumbInput) thumbInput.value = r.thumbnail || '';
  if (bannerInput) bannerInput.value = r.banner || '';
  if (footerInput) footerInput.value = r.footer || '';
  if (roleSelect) roleSelect.value = r.mentionRoleId || '';
  if (delCheck) delCheck.checked = Boolean(r.deleteTrigger);
  if (cdSelect) cdSelect.value = String(r.cooldown || 5);

  if (headerTitle) headerTitle.textContent = `✏️ Editing Trigger: ${r.trigger}`;
  if (submitBtn) submitBtn.textContent = '💾 Update Auto-Responder';

  updateAutoResponderPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleAutoResponderAction = async function(id, enabled) {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/autoresponder/${id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message);
      fetchAutoResponders();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
};

window.deleteAutoResponderAction = async function(id) {
  if (!selectedGuildId) return;
  if (!confirm('Are you sure you want to delete this auto-responder trigger?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/autoresponder/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast('Auto-responder trigger deleted!');
      fetchAutoResponders();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
};

// -------------------------------------------------------------
// RENDER WARNS TABLE
// -------------------------------------------------------------
function renderWarnsTable(warns) {
  const tbody = document.getElementById('warns-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const userEntries = Object.entries(warns).filter(([_, list]) => list && list.length > 0);
  if (userEntries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No warnings recorded on this server.</td></tr>';
    return;
  }

  userEntries.forEach(([userId, list]) => {
    const latest = list[list.length - 1];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${userId}</code></td>
      <td><span class="badge danger">${list.length} Warn(s)</span></td>
      <td>${latest?.reason || 'No reason'}</td>
      <td><span class="text-muted">${latest?.moderatorId ? `<@${latest.moderatorId}>` : '--'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="clearWarnsAction('${userId}')">🧹 Clear Warns</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.clearWarnsAction = async function(userId) {
  if (!confirm(`Clear all warnings for user ${userId}?`)) return;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/clear-warns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Cleared warnings for ${userId}`);
      loadSelectedGuildData();
    }
  } catch (e) {
    showToast('Failed to clear warnings: ' + e.message, 'error');
  }
};

// -------------------------------------------------------------
// LEADERBOARD FETCHING & RENDERING
// -------------------------------------------------------------
async function fetchLeaderboard() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('leaderboard-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading leaderboard data...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/leaderboard`);
    if (!res.ok) return;
    const users = await res.json();

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No active ranking records found yet.</td></tr>';
      return;
    }

    const rankEmojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    tbody.innerHTML = '';

    users.forEach((u, i) => {
      const tr = document.createElement('tr');
      const emoji = rankEmojis[i] || `#${i + 1}`;
      tr.innerHTML = `
        <td><strong>${emoji}</strong></td>
        <td>
          <div class="table-user-cell">
            <img src="${u.avatar}" class="table-user-avatar" alt="Avatar">
            <span>${u.username}</span>
          </div>
        </td>
        <td><span class="badge success">Level ${u.level}</span></td>
        <td><strong>${u.xp.toLocaleString()} XP</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading leaderboard:', err);
  }
}

document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', fetchLeaderboard);

// -------------------------------------------------------------
// BACKUPS FETCHING & CREATION
// -------------------------------------------------------------
async function fetchBackups() {
  if (!selectedGuildId) return;
  const tbody = document.getElementById('backups-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading backups...</td></tr>';

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/backups`);
    if (!res.ok) return;
    const all = await res.json();

    const entries = Object.entries(all);
    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No backups created yet for this server.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    entries.forEach(([id, b]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${id}</code></td>
        <td>${new Date(b.createdAt).toLocaleString()}</td>
        <td><span class="badge">${b.channelsCount || b.channels?.length || 0} Channels</span></td>
        <td><span class="badge">${b.rolesCount || b.roles?.length || 0} Roles</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading backups:', err);
  }
}

document.getElementById('create-backup-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/backup`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`Backup ${data.backupId} created successfully!`);
      fetchBackups();
    }
  } catch (e) {
    showToast('Failed to create backup: ' + e.message, 'error');
  }
});

// -------------------------------------------------------------
// DISCORD & SERVER AUDIT LOGS
// -------------------------------------------------------------
let currentAuditLogs = [];
let currentAuditCategory = 'ALL';
let auditSearchQuery = '';

async function fetchDiscordLogsConfig() {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/logs/config`);
    if (!res.ok) return;
    const logs = await res.json();

    document.getElementById('logs-toggle').checked = Boolean(logs.enabled);
    document.getElementById('logs-general-channel').value = logs.channelId || '';
    document.getElementById('logs-msg-channel').value = logs.msgChannelId || '';
    document.getElementById('logs-member-channel').value = logs.memberChannelId || '';
    document.getElementById('logs-mod-channel').value = logs.modChannelId || '';
    document.getElementById('logs-voice-channel').value = logs.voiceChannelId || '';
    document.getElementById('logs-server-channel').value = logs.serverChannelId || '';

    const ev = logs.events || {};
    document.getElementById('logs-event-msg-delete').checked = ev.messageDelete !== false;
    document.getElementById('logs-event-msg-update').checked = ev.messageUpdate !== false;
    document.getElementById('logs-event-member-join').checked = ev.memberAdd !== false;
    document.getElementById('logs-event-member-leave').checked = ev.memberRemove !== false;
    document.getElementById('logs-event-member-update').checked = ev.memberUpdate !== false;
    document.getElementById('logs-event-bans').checked = ev.guildBanAdd !== false;
    document.getElementById('logs-event-voice').checked = ev.voiceStateUpdate !== false;
    document.getElementById('logs-event-channels').checked = ev.channelCreate !== false;
    document.getElementById('logs-event-roles').checked = ev.roleCreate !== false;
  } catch (err) {
    console.error('Error fetching logs config:', err);
  }
}

async function fetchAuditLogs() {
  if (!selectedGuildId) return;
  const container = document.getElementById('audit-logs-container');
  if (!container) return;

  try {
    const url = `/api/guild/${selectedGuildId}/logs/audit?category=${encodeURIComponent(currentAuditCategory)}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) return;
    currentAuditLogs = await res.json();
    renderAuditLogs();
  } catch (err) {
    console.error('Error loading audit logs:', err);
  }
}

function renderAuditLogs() {
  const container = document.getElementById('audit-logs-container');
  if (!container) return;

  let filtered = currentAuditLogs;
  if (auditSearchQuery.trim() !== '') {
    const q = auditSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const userTag = (item.user?.tag || '').toLowerCase();
      const chanName = (item.channel?.name || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || userTag.includes(q) || chanName.includes(q);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📜</div>
        <h4>No Audit Logs Found</h4>
        <p class="text-muted">${currentAuditLogs.length === 0 ? 'No events recorded yet on this server.' : 'No events match your current search/category filter.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(entry => {
    const dateObj = new Date(entry.timestamp);
    const timeStr = dateObj.toLocaleTimeString();
    const dateStr = dateObj.toLocaleDateString();

    const card = document.createElement('div');
    card.className = `audit-card category-${entry.type.toLowerCase()}`;

    const iconMap = {
      MESSAGE: '💬',
      MEMBER: '👥',
      MODERATION: '🛡️',
      VOICE: '🔊',
      CHANNEL: '📁',
      ROLE: '🎭',
      AUTOMOD: '🤖',
      COMMAND: '⚡',
      SERVER: '⚙️'
    };
    const icon = iconMap[entry.type] || '📜';

    let extraDetailsHtml = '';
    if (entry.details) {
      if (entry.details.before && entry.details.after) {
        extraDetailsHtml = `
          <div class="audit-diff">
            <div class="diff-before"><strong>Old:</strong> ${escapeHtml(entry.details.before)}</div>
            <div class="diff-after"><strong>New:</strong> ${escapeHtml(entry.details.after)}</div>
          </div>
        `;
      } else if (entry.details.content) {
        extraDetailsHtml = `<div class="audit-snippet"><code>${escapeHtml(entry.details.content)}</code></div>`;
      }
    }

    card.innerHTML = `
      <div class="audit-card-header">
        <div class="audit-card-title">
          <span class="audit-badge badge-${entry.type.toLowerCase()}">${icon} ${entry.type}</span>
          <strong>${escapeHtml(entry.title)}</strong>
        </div>
        <div class="audit-card-time" title="${dateStr} ${timeStr}">
          ⏱️ ${timeStr} • ${dateStr}
        </div>
      </div>
      <div class="audit-card-desc">
        ${escapeHtml(entry.description)}
      </div>
      ${extraDetailsHtml}
      <div class="audit-card-footer">
        ${entry.user ? `<span class="audit-meta-pill">👤 ${escapeHtml(entry.user.tag || entry.user.id)}</span>` : ''}
        ${entry.channel ? `<span class="audit-meta-pill">💬 #${escapeHtml(entry.channel.name)}</span>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Audit Filter pills
document.querySelectorAll('#audit-category-pills .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#audit-category-pills .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAuditCategory = btn.getAttribute('data-cat') || 'ALL';
    fetchAuditLogs();
  });
});

// Audit Search Input
document.getElementById('audit-search-input')?.addEventListener('input', (e) => {
  auditSearchQuery = e.target.value;
  renderAuditLogs();
});

// Refresh Audit Logs
document.getElementById('refresh-audit-btn')?.addEventListener('click', () => {
  fetchAuditLogs();
  showToast('Audit stream refreshed');
});

// Export Audit Logs
document.getElementById('export-audit-btn')?.addEventListener('click', () => {
  if (currentAuditLogs.length === 0) return showToast('No logs to export', 'error');
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentAuditLogs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `server-audit-logs-${selectedGuildId}-${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Exported audit logs to JSON');
});

// Clear Audit Logs
document.getElementById('clear-audit-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');
  if (!confirm('Are you sure you want to permanently clear all audit logs for this server?')) return;

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/logs/audit`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Audit logs cleared');
      fetchAuditLogs();
    }
  } catch (err) {
    showToast('Failed to clear logs: ' + err.message, 'error');
  }
});

// Save Discord Logs Form
document.getElementById('discord-logs-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    enabled: document.getElementById('logs-toggle').checked,
    channelId: document.getElementById('logs-general-channel').value || null,
    msgChannelId: document.getElementById('logs-msg-channel').value || null,
    memberChannelId: document.getElementById('logs-member-channel').value || null,
    modChannelId: document.getElementById('logs-mod-channel').value || null,
    voiceChannelId: document.getElementById('logs-voice-channel').value || null,
    serverChannelId: document.getElementById('logs-server-channel').value || null,
    events: {
      messageDelete: document.getElementById('logs-event-msg-delete').checked,
      messageUpdate: document.getElementById('logs-event-msg-update').checked,
      memberAdd: document.getElementById('logs-event-member-join').checked,
      memberRemove: document.getElementById('logs-event-member-leave').checked,
      memberUpdate: document.getElementById('logs-event-member-update').checked,
      guildBanAdd: document.getElementById('logs-event-bans').checked,
      guildBanRemove: document.getElementById('logs-event-bans').checked,
      voiceStateUpdate: document.getElementById('logs-event-voice').checked,
      channelCreate: document.getElementById('logs-event-channels').checked,
      channelDelete: document.getElementById('logs-event-channels').checked,
      channelUpdate: document.getElementById('logs-event-channels').checked,
      roleCreate: document.getElementById('logs-event-roles').checked,
      roleDelete: document.getElementById('logs-event-roles').checked,
      roleUpdate: document.getElementById('logs-event-roles').checked
    }
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/logs/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Discord logging configuration saved successfully!');
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Failed to save logging settings: ' + err.message, 'error');
  }
});

// Send Test Log Button
document.getElementById('send-test-log-btn')?.addEventListener('click', async () => {
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/logs/test`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Test log dispatched to Discord channel!');
      setTimeout(fetchAuditLogs, 1000);
    } else {
      showToast('Test failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Error sending test log: ' + err.message, 'error');
  }
});

// -------------------------------------------------------------
// LIVE CONSOLE LOGS (ENHANCED)
// -------------------------------------------------------------
let allConsoleLogs = [];
let consoleFilterType = 'ALL';
let consoleSearchQuery = '';

async function fetchLiveLogs() {
  const container = document.getElementById('terminal-logs');
  if (!container) return;
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) return;
    allConsoleLogs = await res.json();
    renderConsoleLogs();
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

function renderConsoleLogs() {
  const container = document.getElementById('terminal-logs');
  if (!container) return;

  let filtered = allConsoleLogs;
  if (consoleFilterType !== 'ALL') {
    filtered = filtered.filter(entry => entry.type.toUpperCase() === consoleFilterType);
  }

  if (consoleSearchQuery.trim() !== '') {
    const q = consoleSearchQuery.toLowerCase();
    filtered = filtered.filter(entry => (entry.message || '').toLowerCase().includes(q) || (entry.type || '').toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="log-line text-muted">[SYSTEM] No logs matching current filter.</div>';
    return;
  }

  container.innerHTML = '';
  filtered.slice(0, 100).forEach(entry => {
    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-tag ${entry.type}">${entry.type}</span>
      <span>${escapeHtml(entry.message)}</span>
    `;
    container.appendChild(div);
  });
}

// Console Category Pills
document.querySelectorAll('#console-category-pills .pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#console-category-pills .pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    consoleFilterType = btn.getAttribute('data-type') || 'ALL';
    renderConsoleLogs();
  });
});

// Console Search Input
document.getElementById('console-search-input')?.addEventListener('input', (e) => {
  consoleSearchQuery = e.target.value;
  renderConsoleLogs();
});

document.getElementById('refresh-logs-btn')?.addEventListener('click', () => {
  fetchLiveLogs();
  showToast('Console logs refreshed');
});

// Download Console Logs
document.getElementById('download-logs-btn')?.addEventListener('click', () => {
  if (allConsoleLogs.length === 0) return showToast('No console logs to download', 'error');
  const textContent = allConsoleLogs.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type}] ${l.message}`).join('\n');
  const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `bot-console-logs-${Date.now()}.txt`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Downloaded console log file');
});

// Clear Console Logs
document.getElementById('clear-console-btn')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/logs', { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      allConsoleLogs = [];
      renderConsoleLogs();
      showToast('Console buffer cleared');
    }
  } catch (e) {
    showToast('Failed to clear: ' + e.message, 'error');
  }
});

// -------------------------------------------------------------
// LIVE EMBED & TEXT PREVIEW
// -------------------------------------------------------------
const titleInput = document.getElementById('input-embed-title');
const descInput = document.getElementById('input-embed-desc');
const colorInput = document.getElementById('input-embed-color');
const imageInput = document.getElementById('input-embed-image');
const thumbInput = document.getElementById('input-embed-thumb');
const footerInput = document.getElementById('input-embed-footer');
const plainTextInput = document.getElementById('input-plain-text');

function updateEmbedPreview() {
  if (!titleInput || !descInput) return;
  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const color = colorInput.value;
  const image = imageInput.value.trim();
  const thumb = thumbInput.value.trim();
  const footer = footerInput.value.trim();
  const plainText = plainTextInput.value.trim();

  if (!isEmbedMode) {
    document.getElementById('preview-plain-text').style.display = 'block';
    document.getElementById('preview-plain-text').textContent = plainText || 'Type your message on the left...';
    document.getElementById('preview-embed').style.display = 'none';
    return;
  }

  document.getElementById('preview-plain-text').style.display = 'none';
  document.getElementById('preview-embed').style.display = 'block';

  const titleElem = document.getElementById('preview-embed-title');
  if (title) {
    titleElem.style.display = 'block';
    titleElem.textContent = title;
  } else {
    titleElem.style.display = 'none';
  }

  document.getElementById('preview-embed-desc').textContent = desc || '(Embed description content)';
  document.getElementById('preview-embed').style.borderLeftColor = color;

  const thumbElem = document.getElementById('preview-embed-thumb');
  if (thumb) {
    thumbElem.src = thumb;
    thumbElem.style.display = 'block';
  } else {
    thumbElem.style.display = 'none';
  }

  const imgElem = document.getElementById('preview-embed-img');
  if (image) {
    imgElem.src = image;
    imgElem.style.display = 'block';
  } else {
    imgElem.style.display = 'none';
  }

  const footerElem = document.getElementById('preview-embed-footer');
  if (footer) {
    footerElem.style.display = 'block';
    footerElem.textContent = footer;
  } else {
    footerElem.style.display = 'none';
  }
}

[titleInput, descInput, colorInput, imageInput, thumbInput, footerInput, plainTextInput].forEach(input => {
  if (input) {
    input.addEventListener('input', updateEmbedPreview);
  }
});

// Mode Toggle
document.getElementById('mode-embed-btn')?.addEventListener('click', () => {
  isEmbedMode = true;
  document.getElementById('mode-embed-btn').classList.add('active');
  document.getElementById('mode-text-btn').classList.remove('active');
  document.getElementById('embed-only-fields').style.display = 'block';
  document.getElementById('text-only-fields').style.display = 'none';
  updateEmbedPreview();
});

document.getElementById('mode-text-btn')?.addEventListener('click', () => {
  isEmbedMode = false;
  document.getElementById('mode-text-btn').classList.add('active');
  document.getElementById('mode-embed-btn').classList.remove('active');
  document.getElementById('embed-only-fields').style.display = 'none';
  document.getElementById('text-only-fields').style.display = 'block';
  updateEmbedPreview();
});

// -------------------------------------------------------------
// CORE FORM SUBMISSIONS
// -------------------------------------------------------------

// 1. Send Embed / Text to Discord
document.getElementById('embed-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const channelId = document.getElementById('embed-target-channel').value;
  if (!channelId) return showToast('Please select a target channel!', 'error');

  try {
    let endpoint = isEmbedMode ? `/api/guild/${selectedGuildId}/send-embed` : `/api/guild/${selectedGuildId}/send-text`;
    let payload = isEmbedMode ? {
      channelId,
      title: titleInput.value,
      description: descInput.value,
      color: colorInput.value,
      image: imageInput.value,
      thumbnail: thumbInput.value,
      footer: footerInput.value
    } : {
      channelId,
      message: plainTextInput.value
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Message sent to Discord!');
    } else {
      showToast('Error: ' + (data.error || 'Failed to send'), 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
});

// 2. Save Welcome
document.getElementById('welcome-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const isEmbedVal = document.querySelector('input[name="welcome-format"]:checked')?.value === 'embed';
  const payload = {
    enabled: document.getElementById('welcome-toggle').checked,
    channelId: document.getElementById('welcome-channel-select').value,
    isEmbed: isEmbedVal,
    color: document.getElementById('welcome-color').value,
    message: document.getElementById('welcome-message-input').value,
    image: document.getElementById('welcome-image-input').value
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showToast('Welcome settings saved successfully!');
  } catch (err) {
    showToast('Error saving welcome: ' + err.message, 'error');
  }
});

// 3. Save Goodbye
document.getElementById('goodbye-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    enabled: document.getElementById('goodbye-toggle').checked,
    channelId: document.getElementById('goodbye-channel-select').value,
    message: document.getElementById('goodbye-message-input').value
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/goodbye`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showToast('Goodbye settings saved successfully!');
  } catch (err) {
    showToast('Error saving goodbye: ' + err.message, 'error');
  }
});

// 4. Save Autorole
document.getElementById('autorole-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    enabled: document.getElementById('autorole-toggle').checked,
    roleId: document.getElementById('autorole-role-select').value
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/autorole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showToast('Autorole settings saved successfully!');
  } catch (err) {
    showToast('Error saving autorole: ' + err.message, 'error');
  }
});

// 5. Save AutoMod
document.getElementById('automod-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    enabled: document.getElementById('automod-toggle').checked,
    antiInvite: document.getElementById('automod-anti-invite').checked,
    antiLinks: document.getElementById('automod-anti-links').checked,
    antiSpam: document.getElementById('automod-anti-spam').checked,
    antiCaps: document.getElementById('automod-anti-caps').checked,
    punishment: document.getElementById('automod-punishment-select').value,
    logChannelId: document.getElementById('automod-log-channel').value,
    badWords: document.getElementById('automod-badwords-input').value.split(',').map(s => s.trim()).filter(Boolean)
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/automod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showToast('AutoMod settings saved successfully!');
  } catch (err) {
    showToast('Error saving automod: ' + err.message, 'error');
  }
});

// 6. Save Leveling
document.getElementById('leveling-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    enabled: document.getElementById('leveling-toggle').checked,
    channelId: document.getElementById('leveling-channel-select').value,
    message: document.getElementById('leveling-message-input').value
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/leveling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) showToast('Leveling settings saved successfully!');
  } catch (err) {
    showToast('Error saving leveling: ' + err.message, 'error');
  }
});

// 7. Launch Giveaway
document.getElementById('create-giveaway-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const payload = {
    prize: document.getElementById('ga-prize-input').value,
    channelId: document.getElementById('ga-channel-select').value,
    durationMinutes: document.getElementById('ga-duration-input').value,
    winnerCount: document.getElementById('ga-winners-input').value,
    banner: document.getElementById('ga-banner-input')?.value || null,
    thumbnail: document.getElementById('ga-thumb-input')?.value || null,
    color: document.getElementById('ga-color-input')?.value || null
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/giveaway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Giveaway launched successfully to Discord!');
      document.getElementById('create-giveaway-form').reset();
    } else {
      showToast('Failed to launch giveaway: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
});

// 8. Create Button Roles
document.getElementById('button-roles-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedGuildId) return showToast('Please select a server first!', 'error');

  const roles = [];
  const r1 = document.getElementById('br-role-1').value;
  const l1 = document.getElementById('br-label-1').value;
  if (r1 && l1) roles.push({ roleId: r1, label: l1 });

  const r2 = document.getElementById('br-role-2').value;
  const l2 = document.getElementById('br-label-2').value;
  if (r2 && l2) roles.push({ roleId: r2, label: l2 });

  if (roles.length === 0) {
    return showToast('Please configure at least 1 role and button label!', 'error');
  }

  const payload = {
    channelId: document.getElementById('br-channel-select').value,
    title: document.getElementById('br-title-input').value,
    description: document.getElementById('br-desc-input').value,
    color: document.getElementById('br-color-input')?.value || '#5865F2',
    banner: document.getElementById('br-banner-input')?.value || null,
    thumbnail: document.getElementById('br-thumb-input')?.value || null,
    roles: roles
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/button-role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎭 Button role panel dispatched to Discord!');
    } else {
      showToast('Failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
});

// Refresh buttons
document.getElementById('refresh-tickets-btn')?.addEventListener('click', () => {
  loadSelectedGuildData();
  showToast('Tickets refreshed');
});

document.getElementById('refresh-warns-btn')?.addEventListener('click', () => {
  loadSelectedGuildData();
  showToast('Warnings refreshed');
});

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  fetchStats();
  fetchGuilds();
  updateEmbedPreview();

  setInterval(fetchStats, 6000);
  setInterval(() => {
    if (activeTab === 'console-logs') fetchLiveLogs();
    if (activeTab === 'discord-logs') fetchAuditLogs();
  }, 4000);
});
