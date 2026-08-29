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

  let entries = loadEntries();
  let price = loadPrice();

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

  function render() {
    countEl.textContent = entries.length;

    const now = new Date();
    const todayCount = entries.filter(ts => isSameDay(new Date(ts), now)).length;
    todayCountEl.textContent = todayCount;

    totalCostEl.textContent = formatEuro(entries.length * price);

    const last = entries[entries.length - 1];
    lastTimeEl.textContent = last ? formatTime(last) : '–';

    renderHistory();
  }

  function renderHistory() {
    historyListEl.innerHTML = '';

    if (entries.length === 0) {
      emptyStateEl.style.display = 'block';
      return;
    }
    emptyStateEl.style.display = 'none';

    const ordered = entries.slice().reverse();
    let lastDayLabel = null;
    let indexFromStart = entries.length;

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

  addBtn.addEventListener('click', () => {
    entries.push(Date.now());
    saveEntries();
    render();
    if (navigator.vibrate) navigator.vibrate(30);
  });

  undoBtn.addEventListener('click', () => {
    if (entries.length === 0) return;
    entries.pop();
    saveEntries();
    render();
  });

  resetBtn.addEventListener('click', () => {
    if (entries.length === 0) return;
    if (confirm('Weet je zeker dat je de teller wilt resetten? Dit kan niet ongedaan gemaakt worden.')) {
      entries = [];
      saveEntries();
      render();
    }
  });

  priceInput.addEventListener('change', () => {
    const val = parseFloat(priceInput.value);
    price = Number.isFinite(val) && val >= 0 ? val : 0;
    priceInput.value = price.toFixed(2);
    savePrice();
    render();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  render();
})();
