(() => {
  const STORAGE_KEY = 'schorle-entries';

  const countEl = document.getElementById('count');
  const todayCountEl = document.getElementById('todayCount');
  const lastTimeEl = document.getElementById('lastTime');
  const historyListEl = document.getElementById('historyList');
  const emptyStateEl = document.getElementById('emptyState');
  const addBtn = document.getElementById('addBtn');
  const addHalfBtn = document.getElementById('addHalfBtn');
  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');

  const groupIntroEl = document.getElementById('groupIntro');
  const groupActiveEl = document.getElementById('groupActive');
  const showCreateFormBtn = document.getElementById('showCreateForm');
  const showJoinFormBtn = document.getElementById('showJoinForm');
  const createFormEl = document.getElementById('createForm');
  const joinFormEl = document.getElementById('joinForm');
  const createGroupNameInput = document.getElementById('createGroupName');
  const createYourNameInput = document.getElementById('createYourName');
  const joinCodeInput = document.getElementById('joinCode');
  const joinYourNameInput = document.getElementById('joinYourName');
  const groupErrorEl = document.getElementById('groupError');
  const groupNameEl = document.getElementById('groupName');
  const groupCodeEl = document.getElementById('groupCode');
  const copyLinkBtn = document.getElementById('copyLink');
  const leaveGroupBtn = document.getElementById('leaveGroup');
  const standingsListEl = document.getElementById('standingsList');
  const groupUnavailableEl = document.getElementById('groupUnavailable');
  const groupCardEl = document.getElementById('groupCard');

  let entries = loadEntries();
  let busy = false;

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      // Oudere versie sloeg entries op als kale timestamps; migreer naar {ts, amount}.
      return parsed.map(e => (typeof e === 'number' ? { ts: e, amount: 1 } : e));
    } catch {
      return [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString(I18n.locale(), { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(ts) {
    return new Date(ts).toLocaleDateString(I18n.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function currentEntries() {
    return Group.isActive() ? Group.getMyEntries() : entries;
  }

  function sumAmounts(list) {
    return list.reduce((sum, e) => sum + e.amount, 0);
  }

  function formatCount(value) {
    return new Intl.NumberFormat(I18n.locale(), { maximumFractionDigits: 1 }).format(value);
  }

  function render() {
    const active = currentEntries();
    countEl.textContent = formatCount(sumAmounts(active));

    const now = new Date();
    const todayEntries = active.filter(e => isSameDay(new Date(e.ts), now));
    todayCountEl.textContent = formatCount(sumAmounts(todayEntries));

    const last = active[active.length - 1];
    lastTimeEl.textContent = last ? formatTime(last.ts) : '–';

    renderHistory(active);
    renderGroup();
  }

  function renderHistory(active) {
    historyListEl.innerHTML = '';

    if (active.length === 0) {
      emptyStateEl.style.display = 'block';
      return;
    }
    emptyStateEl.style.display = 'none';

    const ordered = active.slice().reverse();
    let lastDayLabel = null;
    let indexFromStart = active.length;

    ordered.forEach(e => {
      const dayLabel = formatDay(e.ts);
      if (dayLabel !== lastDayLabel) {
        const divider = document.createElement('li');
        divider.className = 'day-divider';
        divider.textContent = dayLabel;
        divider.style.listStyle = 'none';
        historyListEl.appendChild(divider);
        lastDayLabel = dayLabel;
      }

      const label = e.amount === 0.5 ? '½ Schorle' : 'Schorle';
      const li = document.createElement('li');
      li.innerHTML = `<span><span class="history-index">#${indexFromStart}</span>${label}</span><span class="history-time">${formatTime(e.ts)}</span>`;
      historyListEl.appendChild(li);
      indexFromStart--;
    });
  }

  function renderGroup() {
    if (!Group.isConfigured()) {
      groupCardEl.hidden = true;
      return;
    }
    groupCardEl.hidden = false;

    const membership = Group.getMembership();
    if (!membership) {
      groupIntroEl.hidden = false;
      groupActiveEl.hidden = true;
      return;
    }

    groupIntroEl.hidden = true;
    groupActiveEl.hidden = false;
    groupNameEl.textContent = membership.groupName;
    groupCodeEl.textContent = membership.code;

    const standings = Group.getStandings();
    standingsListEl.innerHTML = '';
    standings.forEach((row, i) => {
      const li = document.createElement('li');
      li.className = 'standing-row' + (row.isMe ? ' standing-me' : '');
      li.innerHTML = `
        <span class="standing-rank">${i + 1}</span>
        <span class="standing-name">${escapeHtml(row.name)}${row.isMe ? I18n.t('youSuffix') : ''}</span>
        <span class="standing-count">${formatCount(row.count)}</span>`;
      standingsListEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setGroupError(message) {
    if (message) {
      groupErrorEl.textContent = message;
      groupErrorEl.hidden = false;
    } else {
      groupErrorEl.hidden = true;
    }
  }

  async function withBusy(fn) {
    if (busy) return;
    busy = true;
    addBtn.disabled = true;
    addHalfBtn.disabled = true;
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert(I18n.t('errorGeneric', { msg: (e && e.message) || '?' }));
    } finally {
      busy = false;
      addBtn.disabled = false;
      addHalfBtn.disabled = false;
    }
  }

  function addSchorle(amount) {
    return withBusy(async () => {
      if (Group.isActive()) {
        await Group.addEntry(amount);
      } else {
        entries.push({ ts: Date.now(), amount });
        saveEntries();
      }
      render();
      if (navigator.vibrate) navigator.vibrate(30);
    });
  }

  addBtn.addEventListener('click', () => addSchorle(1));
  addHalfBtn.addEventListener('click', () => addSchorle(0.5));

  undoBtn.addEventListener('click', () => withBusy(async () => {
    if (currentEntries().length === 0) return;
    if (Group.isActive()) {
      await Group.removeLast();
    } else {
      entries.pop();
      saveEntries();
    }
    render();
  }));

  resetBtn.addEventListener('click', () => withBusy(async () => {
    if (currentEntries().length === 0) return;
    if (!confirm(I18n.t('resetConfirm'))) return;
    if (Group.isActive()) {
      await Group.resetAll();
    } else {
      entries = [];
      saveEntries();
    }
    render();
  }));

  // --- Groep UI ---

  showCreateFormBtn.addEventListener('click', () => {
    setGroupError(null);
    createFormEl.hidden = false;
    joinFormEl.hidden = true;
  });

  showJoinFormBtn.addEventListener('click', () => {
    setGroupError(null);
    joinFormEl.hidden = false;
    createFormEl.hidden = true;
  });

  createFormEl.addEventListener('submit', e => {
    e.preventDefault();
    withBusy(async () => {
      setGroupError(null);
      await Group.create(createGroupNameInput.value.trim(), createYourNameInput.value.trim());
      createFormEl.reset();
      createFormEl.hidden = true;
      render();
    }).catch(() => {});
  });

  joinFormEl.addEventListener('submit', e => {
    e.preventDefault();
    withBusy(async () => {
      setGroupError(null);
      try {
        await Group.join(joinCodeInput.value.trim(), joinYourNameInput.value.trim());
      } catch (err) {
        setGroupError(err.message || 'Kon niet aansluiten bij de groep.');
        throw err;
      }
      joinFormEl.reset();
      joinFormEl.hidden = true;
      render();
    }).catch(() => {});
  });

  leaveGroupBtn.addEventListener('click', () => {
    if (!confirm(I18n.t('leaveConfirm'))) return;
    Group.leave();
    render();
  });

  copyLinkBtn.addEventListener('click', async () => {
    const membership = Group.getMembership();
    if (!membership) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('code', membership.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      copyLinkBtn.textContent = I18n.t('copyLinkDone');
      setTimeout(() => { copyLinkBtn.textContent = I18n.t('copyLink'); }, 1500);
    } catch {
      prompt(I18n.t('promptCopyLink'), url.toString());
    }
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      I18n.setLang(btn.dataset.lang);
      render();
    });
  });

  function prefillJoinFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !Group.getMembership()) {
      joinCodeInput.value = code.toUpperCase();
      showJoinFormBtn.click();
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  Group.onChange(render);
  I18n.applyStaticTranslations();
  prefillJoinFromUrl();
  render();
  Group.init().then(render);
})();
