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
      'embed-studio': 'Embed & Plain Text Studio',
      'welcome-studio': 'Welcome & Goodbye Studio',
      'tickets': 'Support Ticket Management',
      'moderation': 'Warnings & Moderation Records',
      'automod': 'AutoMod Protection Studio',
      'leveling': 'Leveling & XP Leaderboards',
      'giveaways': 'Giveaways Manager',
      'button-roles': 'Button Role Panel Creator',
      'backups': 'Server Snapshot Backups',
      'console-logs': 'Live Bot Console Logs'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';

    // Trigger tab specific data load
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
    document.getElementById('action-ticket-channel')
  ];

  channelSelects.forEach(sel => {
    if (!sel) return;
    const isLeveling = sel.id === 'leveling-channel-select';
    sel.innerHTML = isLeveling ? '<option value="">Current Channel (Where user chats)</option>' : '<option value="">-- Select Channel --</option>';
    currentGuild.channels.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = `# ${ch.name}`;
      sel.appendChild(opt);
    });
  });

  // Populate Category Selects
  const categorySelect = document.getElementById('action-ticket-category');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">-- No Category (Root) --</option>';
    (currentGuild.categories || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `📁 ${cat.name}`;
      categorySelect.appendChild(opt);
    });
  }

  // Populate Role Selects
  const roleSelects = [
    document.getElementById('autorole-role-select'),
    document.getElementById('br-role-1'),
    document.getElementById('br-role-2'),
    document.getElementById('action-role-select'),
    document.getElementById('action-ticket-staffrole')
  ];

  roleSelects.forEach(sel => {
    if (!sel) return;
    const isStaff = sel.id === 'action-ticket-staffrole';
    sel.innerHTML = isStaff ? '<option value="">-- Administrator Only --</option>' : '<option value="">-- Select Role --</option>';
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

    // Render Tickets & Warns
    renderTicketsTable(config.tickets || {});
    renderWarnsTable(config.warns || {});

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

// -------------------------------------------------------------
// RENDER TICKETS TABLE
// -------------------------------------------------------------
function renderTicketsTable(tickets) {
  const tbody = document.getElementById('tickets-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Object.entries(tickets);
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No active or past tickets for this server.</td></tr>';
    return;
  }

  entries.forEach(([channelId, t]) => {
    const tr = document.createElement('tr');
    const statusBadge = t.status === 'closed'
      ? '<span class="badge danger">CLOSED</span>'
      : '<span class="badge success">OPEN</span>';

    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '--';

    tr.innerHTML = `
      <td><strong>#${t.ticketNumber || '0000'}</strong></td>
      <td><span class="badge">${t.ownerId ? `<@${t.ownerId}>` : 'Unknown'}</span></td>
      <td>${statusBadge}</td>
      <td>${t.claimedBy ? `<@${t.claimedBy}>` : '<span class="text-muted">Unclaimed</span>'}</td>
      <td>${dateStr}</td>
      <td>
        <button class="btn btn-sm btn-outline" style="color: var(--red);" onclick="deleteTicketAction('${channelId}')">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteTicketAction = async function(channelId) {
  if (!confirm('Are you sure you want to delete this ticket?')) return;
  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/ticket/${channelId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Ticket deleted successfully!');
      loadSelectedGuildData();
    }
  } catch (e) {
    showToast('Failed to delete ticket: ' + e.message, 'error');
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
// LIVE CONSOLE LOGS
// -------------------------------------------------------------
async function fetchLiveLogs() {
  const container = document.getElementById('terminal-logs');
  if (!container) return;
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) return;
    const logs = await res.json();

    if (logs.length === 0) {
      container.innerHTML = '<div class="log-line text-muted">[SYSTEM] No recent logs captured.</div>';
      return;
    }

    container.innerHTML = '';
    logs.slice(0, 50).forEach(entry => {
      const timeStr = new Date(entry.timestamp).toLocaleTimeString();
      const div = document.createElement('div');
      div.className = 'log-line';
      div.innerHTML = `
        <span class="log-time">[${timeStr}]</span>
        <span class="log-tag ${entry.type}">${entry.type}</span>
        <span>${entry.message}</span>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
  }
}

document.getElementById('refresh-logs-btn')?.addEventListener('click', fetchLiveLogs);

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
    winnerCount: document.getElementById('ga-winners-input').value
  };

  try {
    const res = await fetch(`/api/guild/${selectedGuildId}/giveaway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Giveaway launched successfully to Discord!');
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
      showToast('Button role panel dispatched to Discord!');
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
  }, 4000);
});
