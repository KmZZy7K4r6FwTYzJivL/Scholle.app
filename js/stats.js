// Statistiekenpagina: eigen cijfers (lokaal of uit de groep), de groep en
// alle gebruikers samen. Groeps- en globale cijfers komen uit de Supabase-
// functies group_stats() en global_stats() (zie supabase/schema.sql).
(() => {
  const STORAGE_KEY = 'schorle-entries';

  const youEl = document.getElementById('youContent');
  const groupSectionEl = document.getElementById('groupSection');
  const groupTitleEl = document.getElementById('groupTitle');
  const groupEl = document.getElementById('groupContent');
  const globalSectionEl = document.getElementById('globalSection');
  const globalEl = document.getElementById('globalContent');
  const tooltipEl = document.getElementById('chartTooltip');

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

  // null = nog aan het laden, 'error' = mislukt, anders het JSON-resultaat.
  let groupStats = null;
  let globalStats = null;

  function loadLocalEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.map(e => (typeof e === 'number' ? { ts: e, amount: 1 } : e));
    } catch {
      return [];
    }
  }

  function myEntries() {
    return Group.isActive() ? Group.getMyEntries() : loadLocalEntries();
  }

  // --- Helpers ---

  function formatCount(value) {
    return new Intl.NumberFormat(I18n.locale(), { maximumFractionDigits: 1 }).format(value);
  }

  function formatDayShort(date) {
    return date.toLocaleDateString(I18n.locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatDateTime(ts) {
    return new Date(ts).toLocaleString(I18n.locale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const { formatHour, parseDay } = Charts;

  function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function maxBy(list, key) {
    return list.reduce((best, item) => (best === null || item[key] > best[key] ? item : best), null);
  }

  // Berekent dezelfde vorm als group_stats() uit een lijst {ts, amount}, zodat
  // de eigen cijfers (ook solo/offline) met dezelfde weergave werken.
  function statsFromEntries(entries) {
    const byHour = new Map();
    const byDay = new Map();
    entries.forEach(e => {
      const d = new Date(e.ts);
      byHour.set(d.getHours(), (byHour.get(d.getHours()) || 0) + e.amount);
      const key = dayKey(d);
      byDay.set(key, (byDay.get(key) || 0) + e.amount);
    });
    return {
      total: entries.reduce((sum, e) => sum + e.amount, 0),
      drinks: entries.length,
      halves: entries.filter(e => e.amount === 0.5).length,
      alcohol_free: entries.filter(e => e.amount === 0).length,
      by_hour: [...byHour].map(([hour, total]) => ({ hour, total })),
      by_day: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, total]) => ({ day, total })),
    };
  }

  // --- Bouwstenen ---

  const { escapeHtml, tiles } = Charts;

  function barChart(title, bars) {
    return Charts.barChart(title, bars, v => `${formatCount(v)} Schorle`);
  }

  function hourChart(byHour) {
    return barChart(I18n.t('chartByHour'), Charts.hourBars(byHour));
  }

  function dayChart(byDay) {
    return barChart(I18n.t('chartByDay'), Charts.dayBars(byDay, 'total', I18n.locale(), 14));
  }

  function highlights(stats) {
    const days = stats.by_day.map(r => ({ day: r.day, total: Number(r.total) }));
    const hours = stats.by_hour.map(r => ({ hour: Number(r.hour), total: Number(r.total) }));
    const bestDay = maxBy(days, 'total');
    const peakHour = maxBy(hours, 'total');
    return {
      days: days.length,
      avg: days.length ? Number(stats.total) / days.length : 0,
      bestDay: bestDay && bestDay.total > 0 ? bestDay : null,
      peakHour: peakHour && peakHour.total > 0 ? peakHour : null,
    };
  }

  function charts(stats) {
    if (!stats.by_day.length) return '';
    return hourChart(stats.by_hour) + dayChart(stats.by_day);
  }

  function message(key) {
    return `<p class="empty-state">${escapeHtml(I18n.t(key))}</p>`;
  }

  // --- Secties ---

  function renderYou() {
    const stats = statsFromEntries(myEntries());
    if (stats.drinks === 0) {
      youEl.innerHTML = message('emptyState');
      return;
    }
    const h = highlights(stats);
    youEl.innerHTML = tiles([
      [formatCount(stats.total), I18n.t('statTotal')],
      [formatCount(h.avg), I18n.t('statAvgPerDay')],
      [h.bestDay ? formatCount(h.bestDay.total) : '–', h.bestDay ? `${I18n.t('statBestDay')} · ${formatDayShort(parseDay(h.bestDay.day))}` : I18n.t('statBestDay')],
      [h.peakHour ? formatHour(h.peakHour.hour) : '–', I18n.t('statPeakHour')],
      [String(stats.halves), I18n.t('statHalves')],
      [String(stats.alcohol_free), I18n.t('statAlcoholFree')],
    ]) + charts(stats);
  }

  function renderGroup() {
    const membership = Group.getMembership();
    if (!Group.isActive() || !membership) {
      groupSectionEl.hidden = true;
      return;
    }
    groupSectionEl.hidden = false;
    groupTitleEl.textContent = `${I18n.t('groupHeading')}: ${membership.groupName}`;

    if (groupStats === null) { groupEl.innerHTML = message('statsLoading'); return; }
    if (groupStats === 'error') { groupEl.innerHTML = message('statsLoadError'); return; }

    const s = groupStats;
    const members = s.per_member.map(m => ({ ...m, total: Number(m.total), alcohol_free: Number(m.alcohol_free) }));
    const top = members[0] && members[0].total > 0 ? members[0] : null;
    const bob = maxBy(members, 'alcohol_free');
    const h = highlights(s);

    const rows = members.map((m, i) => `
      <tr class="${m.member_id === membership.memberId ? 'standing-me' : ''}">
        <td class="standing-rank">${i + 1}</td>
        <td>${escapeHtml(m.name)}${m.member_id === membership.memberId ? I18n.t('youSuffix') : ''}</td>
        <td class="num strong">${formatCount(m.total)}</td>
        <td class="num">${m.halves}</td>
        <td class="num">${m.alcohol_free}</td>
        <td class="num muted">${m.last_at ? formatDateTime(m.last_at) : '–'}</td>
      </tr>`).join('');

    groupEl.innerHTML = tiles([
      [formatCount(Number(s.total)), I18n.t('statTotal')],
      [String(s.members), I18n.t('statMembers')],
      [s.members ? formatCount(Number(s.total) / s.members) : '–', I18n.t('statAvgPerMember')],
      [h.peakHour ? formatHour(h.peakHour.hour) : '–', I18n.t('statPeakHour')],
    ]) + `
      <ul class="awards">
        <li><span>🏆 ${escapeHtml(I18n.t('awardTop'))}</span><strong>${top ? `${escapeHtml(top.name)} (${formatCount(top.total)})` : '–'}</strong></li>
        <li><span>🚗 ${escapeHtml(I18n.t('awardBob'))}</span><strong>${bob && bob.alcohol_free > 0 ? `${escapeHtml(bob.name)} (${bob.alcohol_free})` : '–'}</strong></li>
      </ul>
      <div class="table-wrap">
        <table class="stats-table">
          <thead><tr>
            <th></th><th>${escapeHtml(I18n.t('colName'))}</th>
            <th class="num">${escapeHtml(I18n.t('statTotal'))}</th>
            <th class="num">½</th><th class="num">0.0</th>
            <th class="num">${escapeHtml(I18n.t('last'))}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` + charts(s);
  }

  function renderGlobal() {
    if (!Group.isConfigured()) {
      globalSectionEl.hidden = true;
      return;
    }
    globalSectionEl.hidden = false;

    if (globalStats === null) { globalEl.innerHTML = message('statsLoading'); return; }
    if (globalStats === 'error') { globalEl.innerHTML = message('statsLoadError'); return; }

    const s = globalStats;
    const topGroups = s.top_groups.filter(g => Number(g.total) > 0).map((g, i) => `
      <li class="standing-row">
        <span class="standing-rank">${i + 1}</span>
        <span class="standing-name">${escapeHtml(g.name)} <span class="muted">· ${escapeHtml(I18n.t('membersCount', { n: g.members }))}</span></span>
        <span class="standing-count">${formatCount(Number(g.total))}</span>
      </li>`).join('');

    globalEl.innerHTML = tiles([
      [formatCount(Number(s.total)), I18n.t('statTotal')],
      [formatCount(Number(s.today)), I18n.t('today')],
      [String(s.groups), I18n.t('statGroups')],
      [String(s.members), I18n.t('statMembers')],
      [String(s.halves), I18n.t('statHalves')],
      [String(s.alcohol_free), I18n.t('statAlcoholFree')],
    ]) + (topGroups ? `
      <h3>${escapeHtml(I18n.t('topGroups'))}</h3>
      <ul class="standings-list">${topGroups}</ul>` : '') + charts(s);
  }

  function render() {
    renderYou();
    renderGroup();
    renderGlobal();
  }

  // --- Data ophalen ---

  async function loadGroupStats() {
    const membership = Group.getMembership();
    if (!Group.isActive() || !membership) return;
    try {
      const { data, error } = await Group.getClient().rpc('group_stats', { p_group_id: membership.groupId, p_tz: timeZone });
      if (error) throw error;
      groupStats = data;
    } catch (e) {
      console.error('Kon groepsstatistieken niet laden', e);
      groupStats = 'error';
    }
  }

  async function loadGlobalStats() {
    if (!Group.isConfigured()) return;
    try {
      const client = Group.getClient();
      const { data, error } = await client.rpc('global_stats', { p_tz: timeZone });
      if (error) throw error;
      globalStats = data;
    } catch (e) {
      console.error('Kon statistieken niet laden', e);
      globalStats = 'error';
    }
  }

  async function refreshMine() {
    if (!Group.isActive()) return;
    try {
      await Group.refresh();
    } catch (e) {
      console.error('Kon eigen groepsgegevens niet laden', e);
    }
  }

  async function reload() {
    await Promise.all([refreshMine(), loadGroupStats(), loadGlobalStats()]);
    render();
  }

  Charts.enableTooltips(tooltipEl);

  if ('serviceWorker' in navigator) {
    // Zodra een nieuwe versie van de app (service worker) het overneemt, één
    // keer herladen zodat oude en nieuwe bestanden niet door elkaar lopen.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  I18n.applyStaticTranslations();
  render();
  Group.init().then(reload);
  // Live bijwerken zolang de pagina open staat (bv. op de Wurstmarkt zelf).
  Group.onChange(() => loadGroupStats().then(render));
  setInterval(reload, 60000);
})();
