(() => {
  /* ── Referências ──────────────────────────────────────────────────────── */
  const root      = htmlNode.querySelector('#neon-root');
  const body      = htmlNode.querySelector('#neon-body');
  const empty     = htmlNode.querySelector('#neon-empty');
  const metaEl    = htmlNode.querySelector('#neon-meta');
  const cntOk     = htmlNode.querySelector('#cnt-ok');
  const cntWarn   = htmlNode.querySelector('#cnt-warn');
  const cntCrit   = htmlNode.querySelector('#cnt-crit');
  const colHeads  = htmlNode.querySelectorAll('.neon-colheads [data-col]');

  /* ── Estado persistente ───────────────────────────────────────────────── */
  const KEY = '__neon_state__';
  const S = window[KEY] ||= { sortCol: 'Servidor', sortDir: 'asc' };

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const isNil = v =>
    v === null || v === undefined || v === '' ||
    (typeof v === 'number' && !isFinite(v));

  const asNum = v => {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return isFinite(n) ? n : null;
  };

  const asStr = v => isNil(v) ? '' : String(v);

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const getVal = (field, i) => {
    const vals = field?.values;
    if (!vals) return null;
    return typeof vals.get === 'function' ? vals.get(i) : vals[i];
  };

  /* ── Leitura de dados ─────────────────────────────────────────────────── */
  const toRows = () => {
    const series = htmlGraphics?.data?.series;
    if (!series?.length) return [];

    const df     = series[0];
    const fields = df.fields || [];
    const idx    = Object.fromEntries(fields.map((f, i) => [f.name, i]));
    const n      = fields[0]?.values?.length ?? 0;
    const need   = ['Servidor', 'Status', 'CPU', 'Memoria', 'Disco', 'Uptime'];
    const out    = [];

    for (let i = 0; i < n; i++) {
      const row = {};
      for (const col of need) {
        const f = fields[idx[col]];
        row[col] = f ? getVal(f, i) : null;
      }
      out.push(row);
    }
    return out;
  };

  /* ── Formatações ──────────────────────────────────────────────────────── */
  // Thresholds (ajuste aqui conforme necessário)
  const THRESHOLDS = { ok: 60, warn: 75, crit: 80 };

  const tClass = pct => {
    if (pct === null) return 'neon-t-na';
    if (pct >= THRESHOLDS.crit) return 'neon-t-crit';
    if (pct >= THRESHOLDS.warn) return 'neon-t-orange';
    if (pct >= THRESHOLDS.ok)   return 'neon-t-warn';
    return 'neon-t-ok';
  };

  const rowClass = (up, cpu, mem, disk) => {
    if (!up) return 'neon-row--down';
    const vals = [cpu, mem, disk].map(v => v ?? 0);
    if (vals.some(v => v >= THRESHOLDS.crit)) return 'neon-row--crit';
    if (vals.some(v => v >= THRESHOLDS.ok))   return 'neon-row--warn';
    return 'neon-row--ok';
  };

  const formatUptime = raw => {
    const s0 = asNum(raw);
    if (s0 === null) return '—';
    let s = Math.max(0, Math.floor(s0));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600);  s -= h * 3600;
    const m = Math.floor(s / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h || d) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  };

  const metricHtml = pct => {
    if (pct === null) {
      return `<div class="neon-metric neon-t-na">
        <div class="neon-metric__row"><span class="neon-metric__val">—</span></div>
        <div class="neon-bar"><div class="neon-bar__fill" style="width:0%"></div></div>
      </div>`;
    }
    const p   = clamp(Math.round(pct * 10) / 10, 0, 100);
    const cls = tClass(p);
    const blink = p >= THRESHOLDS.crit ? ' neon-blink' : '';
    return `<div class="neon-metric ${cls}">
      <div class="neon-metric__row">
        <span class="neon-metric__val${blink}">${p.toFixed(1)}%</span>
      </div>
      <div class="neon-bar"><div class="neon-bar__fill" style="width:${p}%"></div></div>
    </div>`;
  };

  /* ── Comparação para ordenação ────────────────────────────────────────── */
  const compare = (a, b, col) => {
    const an = asNum(a[col]), bn = asNum(b[col]);
    if (an !== null && bn !== null) return an - bn;
    return asStr(a[col]).localeCompare(asStr(b[col]), 'pt-BR', {
      numeric: true, sensitivity: 'base'
    });
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  const render = () => {
    const rows = toRows();

    // meta
    const now = new Date();
    metaEl.textContent = rows.length
      ? `LINHAS: ${rows.length} | SYNC: ${now.toLocaleString('pt-BR')}`
      : 'SEM DADOS';

    if (!rows.length) {
      empty.style.display = 'block';
      body.querySelectorAll('.neon-row').forEach(r => r.remove());
      cntOk.textContent = '◆ 0 OK'; cntWarn.textContent = '◆ 0 WARN'; cntCrit.textContent = '◆ 0 CRIT';
      return;
    }
    empty.style.display = 'none';

    // sort
    const sorted = [...rows].sort((a, b) => {
      const d = compare(a, b, S.sortCol);
      return S.sortDir === 'asc' ? d : -d;
    });

    // update col head indicators
    colHeads.forEach(th => {
      if (th.dataset.col === S.sortCol)
        th.dataset.sort = S.sortDir;
      else
        delete th.dataset.sort;
    });

    // build rows
    let ok = 0, warn = 0, crit = 0;

    body.querySelectorAll('.neon-row').forEach(r => r.remove());

    sorted.forEach(row => {
      const isUp = asNum(row.Status) === 1;
      const cpu  = asNum(row.CPU);
      const mem  = asNum(row.Memoria);
      const dsk  = asNum(row.Disco);

      const rc = rowClass(isUp, cpu, mem, dsk);
      if (rc === 'neon-row--crit') crit++;
      else if (rc === 'neon-row--warn') warn++;
      else ok++;

      const div = document.createElement('div');
      div.className = `neon-row ${rc}`;
      div.innerHTML = `
        <div class="neon-srv">${asStr(row.Servidor).replace(/[<>]/g, '')}</div>
        <div>
          <span class="neon-chip neon-chip--${isUp ? 'up' : 'down'}">
            <span class="neon-dot"></span>${isUp ? 'UP' : 'DOWN'}
          </span>
        </div>
        ${metricHtml(cpu)}
        ${metricHtml(mem)}
        ${metricHtml(dsk)}
        <div class="neon-uptime">${formatUptime(row.Uptime)}</div>
      `;
      body.appendChild(div);
    });

    // badges
    cntOk.textContent   = `◆ ${ok} OK`;
    cntWarn.textContent  = `◆ ${warn} WARN`;
    cntCrit.textContent  = `◆ ${crit} CRIT`;
  };

  /* ── Eventos de ordenação ─────────────────────────────────────────────── */
  if (!root.dataset.bound) {
    root.dataset.bound = '1';

    colHeads.forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (!col) return;
        S.sortDir = (S.sortCol === col && S.sortDir === 'asc') ? 'desc' : 'asc';
        S.sortCol = col;
        render();
      });
    });
  }

  /* ── Entry point ──────────────────────────────────────────────────────── */
  onRender = () => { try { render(); } catch(e) { console.error('[neon]', e); } };
  try { render(); } catch(e) { console.error('[neon]', e); }
})();
