(() => {
  const STORAGE_KEY = 'schorle-entries';
  const PRICE_KEY = 'schorle-price';

  const countEl = document.getElementById('count');
  const todayCountEl = document.getElementById('todayCount');
  const totalCostEl = document.getElementById('totalCost');
  const lastTimeEl = document.getElementById('lastTime');
  const historyListEl = document.getElementById('historyList');
  const emptyStateEl = document.getElementById('emptyState');
  const priceInput = document.getElementById('priceInput');
  const addBtn = document.getElementById('addBtn');
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
  let price = loadPrice();
  let busy = false;

  priceInput.value = price.toFixed(2);

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function loadPrice() {
    const raw = localStorage.getItem(PRICE_KEY);
    const val = raw ? parseFloat(raw) : 4.5;
    return Number.isFinite(val) ? val : 4.5;
  }

  function savePrice() {
    localStorage.setItem(PRICE_KEY, String(price));
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(ts) {
    return new Date(ts).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatEuro(value) {
    return '€' + value.toFixed(2).replace('.', ',');
  }

  function currentEntries() {
    return Group.isActive() ? Group.getMyEntries() : entries;
  }

  function render() {
    const active = currentEntries();
    countEl.textContent = active.length;

    const now = new Date();
    const todayCount = active.filter(ts => isSameDay(new Date(ts), now)).length;
    todayCountEl.textContent = todayCount;

    totalCostEl.textContent = formatEuro(active.length * price);

    const last = active[active.length - 1];
    lastTimeEl.textContent = last ? formatTime(last) : '–';

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

    ordered.forEach(ts => {
      const dayLabel = formatDay(ts);
      if (dayLabel !== lastDayLabel) {
        const divider = document.createElement('li');
        divider.className = 'day-divider';
        divider.textContent = dayLabel;
        divider.style.listStyle = 'none';
        historyListEl.appendChild(divider);
        lastDayLabel = dayLabel;
      }

      const li = document.createElement('li');
      li.innerHTML = `<span><span class="history-index">#${indexFromStart}</span>Schorle</span><span class="history-time">${formatTime(ts)}</span>`;
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
        <span class="standing-name">${escapeHtml(row.name)}${row.isMe ? ' (jij)' : ''}</span>
        <span class="standing-count">${row.count}</span>`;
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
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert('Er ging iets mis: ' + (e && e.message ? e.message : 'onbekende fout') + '. Controleer je internetverbinding en probeer opnieuw.');
    } finally {
      busy = false;
      addBtn.disabled = false;
    }
  }

  addBtn.addEventListener('click', () => withBusy(async () => {
    if (Group.isActive()) {
      await Group.addEntry();
    } else {
      entries.push(Date.now());
      saveEntries();
    }
    render();
    if (navigator.vibrate) navigator.vibrate(30);
  }));

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
    if (!confirm('Weet je zeker dat je jouw teller wilt resetten? Dit kan niet ongedaan gemaakt worden.')) return;
    if (Group.isActive()) {
      await Group.resetAll();
    } else {
      entries = [];
      saveEntries();
    }
    render();
  }));

  priceInput.addEventListener('change', () => {
    const val = parseFloat(priceInput.value);
    price = Number.isFinite(val) && val >= 0 ? val : 0;
    priceInput.value = price.toFixed(2);
    savePrice();
    render();
  });

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
    if (!confirm('Groep verlaten? Je eigen tellingen blijven bewaard in de groep, maar je ziet de tussenstand niet meer.')) return;
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
      copyLinkBtn.textContent = 'gekopieerd!';
      setTimeout(() => { copyLinkBtn.textContent = 'kopieer link'; }, 1500);
    } catch {
      prompt('Kopieer deze link:', url.toString());
    }
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
  prefillJoinFromUrl();
  render();
  Group.init().then(render);
})();
