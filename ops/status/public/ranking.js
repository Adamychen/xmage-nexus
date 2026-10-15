(() => {
  const MAX_ROWS = 500;
  const state = { data: null, format: 'constructed', search: '', onlyPop: false };
  const el = {
    note: document.getElementById('note'),
    cards: document.getElementById('cards'),
    rows: document.getElementById('rows'),
    search: document.getElementById('search'),
    onlyPop: document.getElementById('onlyPop'),
    minLabel: document.getElementById('minLabel'),
    tabs: document.querySelectorAll('.rk-tabs [role="tab"]'),
  };

  const fmt = (v) => (v == null || v === 0 ? '—' : String(v));
  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function card(label, value, sub) {
    return `<div class="rk-card"><div class="rk-card-label">${esc(label)}</div>` +
      `<div class="rk-card-value">${esc(value)}</div>` +
      (sub ? `<div class="rk-card-sub">${esc(sub)}</div>` : '') + '</div>';
  }

  function renderCards() {
    const d = state.data;
    const p = d.percentiles[state.format];
    el.cards.innerHTML = [
      card('Players seen', d.coverage.distinctPlayersSeen, `${d.coverage.samplingRuns} sampling runs`),
      card('Population', d.coverage.population, `≥ ${d.minMatches} matches, seen in last ${d.windowDays} days`),
      card('Median', fmt(p.p50), 'rating now'),
      card('90th percentile', fmt(p.p90), 'rating now'),
      card('Highest', fmt(p.max), 'rating now'),
    ].join('');
  }

  function renderRows() {
    const d = state.data;
    const rating = state.format === 'constructed' ? 'constructed' : 'limited';
    const best = state.format === 'constructed' ? 'maxConstructed' : 'maxLimited';
    const q = state.search.trim().toLowerCase();
    const list = d.players
      .filter(p => (p[rating] ?? 0) > 0)
      .filter(p => !state.onlyPop || p.inPopulation)
      .filter(p => !q || p.user.toLowerCase().includes(q))
      .sort((a, b) => b[rating] - a[rating] || a.user.localeCompare(b.user));
    const shown = list.slice(0, MAX_ROWS);
    el.rows.innerHTML = shown.map((p, i) => `<tr${p.inPopulation ? '' : ' class="not-pop"'}>` +
      `<td class="col-pos">${i + 1}</td>` +
      `<td>${esc(p.user)}</td>` +
      `<td class="num">${fmt(p[rating])}</td>` +
      `<td class="num">${fmt(p[best])}</td>` +
      `<td class="num">${fmt(p.matches)}</td>` +
      `<td>${esc(when(p.lastSeen))}</td>` +
      `<td class="num">${fmt(p.samples)}</td>` +
      '</tr>').join('') || '<tr><td colspan="7" class="rk-empty">No players match.</td></tr>';
    if (list.length > MAX_ROWS) {
      el.rows.insertAdjacentHTML('beforeend', `<tr><td colspan="7" class="rk-empty">Showing ${MAX_ROWS} of ${list.length}. Use search to narrow down.</td></tr>`);
    }
  }

  function render() {
    renderCards();
    renderRows();
    el.tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.format === state.format)));
  }

  el.tabs.forEach(t => t.addEventListener('click', () => {
    state.format = t.dataset.format;
    render();
  }));
  el.search.addEventListener('input', () => {
    state.search = el.search.value;
    renderRows();
  });
  el.onlyPop.addEventListener('change', () => {
    state.onlyPop = el.onlyPop.checked;
    renderRows();
  });

  async function load() {
    try {
      const res = await fetch('ranking.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      el.minLabel.textContent = String(state.data.minMatches);
      el.note.textContent = `Sampled ${when(state.data.generatedAt)}. Observed in the beta lobby, not the full player base.`;
      render();
    } catch (err) {
      el.note.textContent = `No ranking data yet (${err.message}).`;
    }
  }

  load();
})();
