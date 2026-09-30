// Beheerpagina: overall statistieken van de hele app, via de met een
// wachtwoord beveiligde Supabase-functie admin_stats() (zie supabase/schema.sql).
(() => {
  const PASSWORD_KEY = 'schorle-admin-password';
  const LOCALE = 'nl-NL';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  const { escapeHtml, tiles } = Charts;

  const loginSectionEl = document.getElementById('loginSection');
  const loginFormEl = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const loginErrorEl = document.getElementById('loginError');
  const dashboardEl = document.getElementById('dashboard');
  const updatedAtEl = document.getElementById('updatedAt');
  const groupFilterInput = document.getElementById('groupFilter');

  let client = null;
  let password = loadPassword();
  let stats = null;

  function loadPassword() {
    try { return localStorage.getItem(PASSWORD_KEY); } catch { return null; }
  }

  function savePassword(value) {
    password = value;
    try {
      if (value) localStorage.setItem(PASSWORD_KEY, value);
      else localStorage.removeItem(PASSWORD_KEY);
    } catch {}
  }

  function getClient() {
    if (!client && window.supabase && window.SCHORLE_SUPABASE_URL && window.SCHORLE_SUPABASE_ANON_KEY) {
      client = window.supabase.createClient(window.SCHORLE_SUPABASE_URL, window.SCHORLE_SUPABASE_ANON_KEY);
    }
    return client;
  }

  function num(value) {
    return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(Number(value));
  }

  function dateTime(ts) {
    if (!ts) return '–';
    return new Date(ts).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function barChart(title, bars, unit) {
    return Charts.barChart(title, bars, v => `${num(v)} ${unit}`);
  }

  // --- Weergave ---

  function renderTotals() {
    const members = Number(stats.members);
    const groups = Number(stats.groups);
    document.getElementById('totals').innerHTML = tiles([
      [num(groups), 'Groepen'],
      [num(members), 'Gebruikers'],
      [num(stats.total), 'Schorles'],
      [num(stats.drinks), 'Keer gelogd'],
      [num(stats.halves), 'Halve'],
      [num(stats.alcohol_free), '0.0'],
      [groups ? num(members / groups) : '–', 'Gebr. per groep'],
      [members ? num(Number(stats.total) / members) : '–', 'Schorles per gebr.'],
      [num(stats.active_24h), 'Actief (24 uur)'],
      [num(stats.empty_groups), 'Lege groepen'],
      [num(stats.members_without_entries), 'Nooit gelogd'],
    ]);
  }

  function renderToday() {
    const t = stats.today;
    document.getElementById('today').innerHTML = tiles([
      [num(t.total), 'Schorles'],
      [num(t.active_members), 'Actieve gebruikers'],
      [num(t.new_members), 'Nieuwe gebruikers'],
      [num(t.new_groups), 'Nieuwe groepen'],
    ]);
  }

  function renderTrends() {
    const el = document.getElementById('trends');
    if (!stats.by_day.length) {
      el.innerHTML = '<p class="empty-state">Nog geen activiteit.</p>';
      return;
    }
    // Elke maat een eigen grafiek: ze hebben elk hun eigen schaal.
    el.innerHTML =
      barChart('Schorles per dag', Charts.dayBars(stats.by_day, 'total', LOCALE, 30), 'Schorles') +
      barChart('Actieve gebruikers per dag', Charts.dayBars(stats.by_day, 'active_members', LOCALE, 30), 'actief') +
      barChart('Nieuwe gebruikers per dag', Charts.dayBars(stats.by_day, 'new_members', LOCALE, 30), 'nieuw') +
      barChart('Nieuwe groepen per dag', Charts.dayBars(stats.by_day, 'new_groups', LOCALE, 30), 'nieuw') +
      (stats.by_hour.length ? barChart('Schorles per uur van de dag', Charts.hourBars(stats.by_hour), 'Schorles') : '');
  }

  function renderTopMembers() {
    const el = document.getElementById('topMembers');
    const rows = stats.top_members.filter(m => Number(m.total) > 0);
    if (!rows.length) {
      el.innerHTML = '<p class="empty-state">Nog niemand.</p>';
      return;
    }
    el.innerHTML = `<ul class="standings-list">${rows.map((m, i) => `
      <li class="standing-row">
        <span class="standing-rank">${i + 1}</span>
        <span class="standing-name">${escapeHtml(m.name)} <span class="muted">· ${escapeHtml(m.group_name)}</span></span>
        <span class="standing-count">${num(m.total)}</span>
      </li>`).join('')}</ul>`;
  }

  function renderGroups() {
    const query = groupFilterInput.value.trim().toLowerCase();
    const groups = stats.group_list.filter(g =>
      !query || g.name.toLowerCase().includes(query) || g.code.toLowerCase().includes(query));
    document.getElementById('groupsHeading').textContent = `Alle groepen (${stats.group_list.length})`;
    document.getElementById('groupList').innerHTML = groups.length ? `
      <div class="table-wrap">
        <table class="stats-table">
          <thead><tr>
            <th>Groep</th><th>Code</th>
            <th class="num">Leden</th><th class="num">Schorles</th>
            <th class="num">Aangemaakt</th><th class="num">Laatst actief</th>
          </tr></thead>
          <tbody>${groups.map(g => `
            <tr>
              <td>${escapeHtml(g.name)}</td>
              <td class="mono">${escapeHtml(g.code)}</td>
              <td class="num">${num(g.members)}</td>
              <td class="num strong">${num(g.total)}</td>
              <td class="num muted">${dateTime(g.created_at)}</td>
              <td class="num muted">${dateTime(g.last_at)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty-state">Geen groepen gevonden.</p>';
  }

  function render() {
    renderTotals();
    renderToday();
    renderTrends();
    renderTopMembers();
    renderGroups();
    updatedAtEl.textContent = `Bijgewerkt ${new Date().toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`;
  }

  function showLogin(errorMessage) {
    dashboardEl.hidden = true;
    loginSectionEl.hidden = false;
    loginErrorEl.hidden = !errorMessage;
    loginErrorEl.textContent = errorMessage || '';
    passwordInput.focus();
  }

  // --- Data ophalen ---

  async function load() {
    const supabase = getClient();
    if (!supabase) {
      showLogin('Supabase is niet ingesteld (zie js/supabase-config.js).');
      return;
    }
    const { data, error } = await supabase.rpc('admin_stats', { p_password: password, p_tz: timeZone });
    if (error) {
      if (error.code === '28P01') {
        savePassword(null);
        showLogin('Onjuist wachtwoord.');
      } else if (error.code === 'PGRST202' || error.code === '42883') {
        showLogin('De functie admin_stats bestaat nog niet. Draai supabase/schema.sql opnieuw in de SQL Editor.');
      } else {
        showLogin(`Kon de statistieken niet laden: ${error.message}`);
      }
      return;
    }
    stats = data;
    loginSectionEl.hidden = true;
    dashboardEl.hidden = false;
    render();
  }

  loginFormEl.addEventListener('submit', e => {
    e.preventDefault();
    savePassword(passwordInput.value);
    passwordInput.value = '';
    load();
  });

  document.getElementById('refreshBtn').addEventListener('click', load);

  document.getElementById('logoutBtn').addEventListener('click', () => {
    savePassword(null);
    stats = null;
    showLogin();
  });

  groupFilterInput.addEventListener('input', () => { if (stats) renderGroups(); });

  Charts.enableTooltips(document.getElementById('chartTooltip'));

  if (password) load(); else showLogin();

  // Elke minuut vernieuwen zolang het overzicht open staat.
  setInterval(() => { if (password && !dashboardEl.hidden) load(); }, 60000);
})();
