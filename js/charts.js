// Gedeelde bouwstenen voor de statistiekenpagina's (stats.html en admin.html):
// cijfertegels, staafdiagrammen met één reeks en de tooltip bij de staven.
const Charts = (() => {
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // items: [[waarde, label], ...]. De waarde wordt als HTML ingevoegd.
  function tiles(items) {
    return `<div class="stat-tiles">${items.map(([value, label]) => `
      <div class="stat-tile">
        <span class="stat-value">${value}</span>
        <span class="stat-name">${escapeHtml(label)}</span>
      </div>`).join('')}</div>`;
  }

  // bars: [{label, value, tick}] waarbij tick het (optionele) label onder de as
  // is. format zet een waarde om naar de tekst in de tooltip.
  function barChart(title, bars, format) {
    const max = Math.max(...bars.map(b => b.value), 0);
    const cols = bars.map(b => {
      const pct = max > 0 ? (b.value / max) * 100 : 0;
      const tip = `${b.label} · ${format(b.value)}`;
      return `
        <div class="bar-col" data-tip="${escapeHtml(tip)}" role="img" aria-label="${escapeHtml(tip)}">
          <div class="bar-track"><div class="bar" style="height:${pct}%"></div></div>
          <span class="bar-tick">${b.tick ? escapeHtml(b.tick) : ''}</span>
        </div>`;
    }).join('');
    return `
      <figure class="chart">
        <figcaption>${escapeHtml(title)}</figcaption>
        <div class="bar-chart">${cols}</div>
      </figure>`;
  }

  function formatHour(h) {
    return `${String(h).padStart(2, '0')}:00`;
  }

  function parseDay(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // De Wurstmarkt-dag loopt door na middernacht, dus de uren tellen vanaf
  // 06:00 (06, 07, … 23, 00, … 05) zodat 00:00 na 23:00 komt.
  const DAY_START_HOUR = 6;

  // rows: [{hour, total}] -> staven, alleen het deel van de dag waarin iets
  // gebeurde (plus een uur marge), anders staan er vooral lege uren in beeld.
  function hourBars(rows) {
    const totals = new Map(rows.map(r => [Number(r.hour), Number(r.total)]));
    const order = Array.from({ length: 24 }, (_, i) => (DAY_START_HOUR + i) % 24);
    const used = order.map((h, i) => (totals.has(h) ? i : -1)).filter(i => i >= 0);
    const from = Math.max(0, Math.min(...used) - 1);
    const to = Math.min(23, Math.max(...used) + 1);
    return order.slice(from, to + 1).map(h => ({
      label: formatHour(h),
      value: totals.get(h) || 0,
      tick: h % 3 === 0 ? String(h) : '',
    }));
  }

  // rows: [{day: 'YYYY-MM-DD', ...}] -> staven voor de laatste maxDays dagen,
  // met de waarde uit veld key.
  function dayBars(rows, key, locale, maxDays) {
    const recent = rows.slice(-maxDays);
    const every = Math.ceil(recent.length / 7);
    return recent.map((r, i) => {
      const date = parseDay(r.day);
      return {
        label: date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
        value: Number(r[key]),
        tick: (recent.length - 1 - i) % every === 0 ? String(date.getDate()) : '',
      };
    });
  }

  // Tooltip bij de staven: hover op desktop, tik op mobiel.
  function enableTooltips(tooltipEl) {
    function showTip(col) {
      tooltipEl.textContent = col.dataset.tip;
      tooltipEl.hidden = false;
      const rect = col.getBoundingClientRect();
      const tipRect = tooltipEl.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.left + rect.width / 2 - tipRect.width / 2), window.innerWidth - tipRect.width - 8);
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${rect.top + window.scrollY - tipRect.height - 6}px`;
    }
    function handle(e) {
      const col = e.target.closest && e.target.closest('.bar-col');
      if (col) showTip(col); else tooltipEl.hidden = true;
    }
    document.addEventListener('pointerover', handle);
    document.addEventListener('click', handle);
  }

  return { escapeHtml, tiles, barChart, formatHour, parseDay, hourBars, dayBars, enableTooltips };
})();
