/* Florida Voters Guide 2026 — single-page app (no build step, no framework). */
(function () {
  'use strict';

  const DATA = window.GUIDE_DATA || { issues: [], races: [], amendments: [], judicial: {}, voting_info: {}, other_races: {}, school_board: {} };
  const ISSUES = DATA.issues || [];
  const ISSUE_BY_ID = Object.fromEntries(ISSUES.map(i => [i.id, i]));
  const RACES = (DATA.races || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99));
  const RACE_BY_ID = Object.fromEntries(RACES.map(r => [r.id, r]));
  const CANDIDATES = RACES.flatMap(r => (r.candidates || []).map(c => Object.assign({ race_id: r.id }, c)));
  const CAND_BY_ID = Object.fromEntries(CANDIDATES.map(c => [c.id, c]));
  const STORAGE_KEY = 'scvg2026_answers_v1'; // Florida Voters Guide 2026
  const PROFILE_KEY = 'scvg2026_profile_v1';
  // Nothing is persisted on the visitor's device: quiz answers and the where-do-you-vote profile live in memory
  // for the current page load only, and values saved by earlier versions are removed at startup.
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(PROFILE_KEY); localStorage.removeItem('flguide.county'); } catch (e) { /* ignore */ }
  /* ---------- Language (English / Español) ---------- */
  let LANG = 'en';
  try { LANG = localStorage.getItem('flguide.lang') === 'es' ? 'es' : 'en'; } catch (e) { /* ignore */ }
  function T(en, es) { return LANG === 'es' && es != null ? es : en; }
  function iLabel(i) { return T(i.label, i.label_es); }
  function iStmt(i) { return T(i.statement, i.statement_es); }
  function setLang(l) { LANG = l === 'es' ? 'es' : 'en'; try { localStorage.setItem('flguide.lang', LANG); } catch (e) { /* ignore */ } applyChrome(); render(); }
  const NAV_ES = { home: 'Inicio', races: 'Contiendas', match: 'Compárame', amendments: 'Enmiendas', judges: 'Jueces', vote: 'Cómo votar', counties: 'Condados', about: 'Metodología' };
  const NAV_EN = { home: 'Home', races: 'Races', match: 'Match me', amendments: 'Amendments', judges: 'Judges', vote: 'How to vote', counties: 'All counties', about: 'Methodology' };
  function applyChrome() {
    document.documentElement.lang = LANG;
    document.querySelectorAll('[data-nav]').forEach(a => { const k = a.getAttribute('data-nav'); if ((LANG === 'es' ? NAV_ES : NAV_EN)[k]) a.textContent = (LANG === 'es' ? NAV_ES : NAV_EN)[k]; });
    const sub = document.querySelector('.brand-sub'); if (sub) sub.textContent = T('November 3, 2026 General Election', 'Elección General · 3 de noviembre de 2026');
    const btn = document.getElementById('lang-toggle'); if (btn) btn.textContent = LANG === 'es' ? 'English' : 'Español';
    const f1 = document.getElementById('footer-independent'); if (f1) f1.innerHTML = T(f1.dataset.en, f1.dataset.es);
    const f2 = document.getElementById('footer-reviewed'); if (f2) f2.innerHTML = T(f2.dataset.en, f2.dataset.es).replace('{date}', `<span id="data-date">${(window.GUIDE_DATA || {}).generated_at || ''}</span>`);
  }
  const ES_NOTE = '<p class="notice">Las preguntas, la navegación y las explicaciones están en español; los resúmenes de las posiciones de cada candidato y las fuentes citadas están en inglés, tal como aparecen en los documentos originales.</p>';
  let ANSWERS = {};
  let PROFILE = null;
  const FL = DATA.florida || { counties: {}, dca_names: {} };
  const COUNTY_INFO = DATA.counties || {};
  const COUNTY_NAMES = Object.keys(FL.counties || {}).sort();

  const STANCE_LABEL_EN = { '2': 'Strongly agrees', '1': 'Leans agree', '0': 'Mixed / neutral', '-1': 'Leans disagree', '-2': 'Strongly disagrees', 'null': 'No public position found' };
  const STANCE_LABEL_ES = { '2': 'Muy de acuerdo', '1': 'Tiende a estar de acuerdo', '0': 'Mixto / neutral', '-1': 'Tiende a estar en desacuerdo', '-2': 'Muy en desacuerdo', 'null': 'No se encontró una posición pública' };
  const stanceLabel = k => (LANG === 'es' ? STANCE_LABEL_ES : STANCE_LABEL_EN)[k];
  const CONF_LABEL_EN = { stated: 'stated position', record: 'based on record', unknown: 'unknown' };
  const CONF_LABEL_ES = { stated: 'posición declarada', record: 'según su historial', unknown: 'desconocido' };
  const confLabel = k => (LANG === 'es' ? CONF_LABEL_ES : CONF_LABEL_EN)[k] || k;
  const USER_SCALE = [
    { v: 2, label: 'Strongly agree', es: 'Muy de acuerdo' }, { v: 1, label: 'Agree', es: 'De acuerdo' }, { v: 0, label: 'Neutral / unsure', es: 'Neutral / no sé' }, { v: -1, label: 'Disagree', es: 'En desacuerdo' }, { v: -2, label: 'Strongly disagree', es: 'Muy en desacuerdo' }
  ];

  /* ---------- helpers ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const partyClass = p => {
    if (!p) return 'party-NPA';
    if (/republican/i.test(p)) return 'party-Republican';
    if (/democrat/i.test(p)) return 'party-Democratic';
    if (/libertarian/i.test(p)) return 'party-Libertarian';
    if (/write/i.test(p)) return 'party-Write-in';
    if (/nonpartisan/i.test(p)) return 'party-Nonpartisan';
    return 'party-NPA';
  };
  const partyShort = p => {
    if (!p) return 'NPA';
    if (/republican/i.test(p)) return 'REP';
    if (/democrat/i.test(p)) return 'DEM';
    if (/libertarian/i.test(p)) return 'LPF';
    if (/write/i.test(p)) return 'Write-in';
    if (/no party/i.test(p)) return 'NPA';
    return p;
  };
  const initials = name => (name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };
  const fmtDate = d => d || '';

  function avatar(c, size = '') {
    const cls = `avatar ${size}`.trim();
    const local = c.photo_local, remote = c.photo_url;
    if (local || remote) {
      const src = local || remote;
      const fb = local && remote ? ` data-fallback="${esc(remote)}"` : '';
      return `<span class="${cls}" data-initials="${esc(initials(c.name))}"><img src="${esc(src)}"${fb} alt="Photo of ${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback;}else{this.parentNode.textContent=this.parentNode.dataset.initials}"></span>`;
    }
    return `<span class="${cls}" aria-hidden="true">${esc(initials(c.name))}</span>`;
  }
  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    sources = sources.map(x => typeof x === 'string' ? { url: x } : x).filter(x => x && x.url);
    if (!sources.length) return '';
    return `<div class="sources">${T('Sources', 'Fuentes')}: ${sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || '')}">${esc(s.title ? truncate(s.title, 60) : hostOf(s.url))}${s.date ? ` (${esc(s.date)})` : ''}</a>`).join(' · ')}</div>`;
  }
  const truncate = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + '…' : s;
  function stanceChip(pos) {
    const st = pos && pos.stance != null ? pos.stance : null;
    const key = st == null ? 'null' : String(st);
    const conf = pos && pos.confidence && pos.confidence !== 'unknown' ? `<span class="conf">· ${confLabel(pos.confidence)}</span>` : '';
    return `<span class="stance stance-${key}">${stanceLabel(key)}${conf}</span>`;
  }
  function issuesForLevel(level) { return ISSUES.filter(i => (i.levels || []).includes(level)); }
  function withdrawnLabel(c) { const w = c.withdrawn; if (w === true || !w) return 'Withdrew'; const s = String(w).replace(/\s*\((Florida Division of Elections|VoterFocus)[^)]*\)\s*$/, ''); const out = /^(Withdrew|Defeated|Did not|Removed|Deceased|Not )/.test(s) ? s : 'Withdrew ' + s; return LANG === 'es' ? out.replace(/^Withdrew/, 'Se retiró').replace(/^Defeated in the primary/, 'Derrotado en la primaria').replace(/^Did not qualify/, 'No calificó') : out; }

  const REPO_ISSUES = 'https://github.com/smarchand910-eng/Political-Party-Rock-Anthem/issues/new';
  function reportLink(what) { return `<a href="${REPO_ISSUES}?title=${encodeURIComponent('Correction: ' + what)}&body=${encodeURIComponent('Page: ' + location.href + '\n\nWhat is wrong, and a source that shows the correct information:\n')}" target="_blank" rel="noopener">${T('Report an error ↗', 'Reportar un error ↗')}</a>`; }
  function money(n) { return n == null ? '' : '$' + Math.round(n).toLocaleString('en-US'); }
  function financeHtml(c, r) {
    const f = c.finance;
    if (f && f.source === 'FEC') return `<p class="muted"><strong>${T('Campaign finance', 'Finanzas de campaña')}</strong> (${T('FEC filings through', 'informes a la FEC hasta el')} ${esc(f.through)}): ${T('raised', 'recaudó')} ${money(f.receipts)}, ${T('spent', 'gastó')} ${money(f.disbursements)}, ${T('cash on hand', 'efectivo disponible')} ${money(f.cash_on_hand)}${f.individual ? `; ${money(f.individual)} ${T('from individual donors', 'de donantes individuales')}` : ''}${f.pac ? `, ${money(f.pac)} ${T('from PACs', 'de comités políticos (PAC)')}` : ''}${f.self ? `, ${money(f.self)} ${T('from the candidate', 'del propio candidato')}` : ''}. <a href="${esc(f.url)}" target="_blank" rel="noopener">FEC filings ↗</a></p>`;
    if (r.level === 'federal') return '';
    return `<p class="muted"><strong>${T('Campaign finance:', 'Finanzas de campaña:')}</strong> ${T('state and county candidates file with the Florida Division of Elections or the county Supervisor of Elections.', 'los candidatos estatales y de condado presentan sus informes ante la División de Elecciones de Florida o el Supervisor de Elecciones del condado.')} <a href="https://dos.elections.myflorida.com/campaign-finance/contributions/" target="_blank" rel="noopener">${T('Search contributions ↗', 'Buscar contribuciones ↗')}</a></p>`;
  }
  function partyTag(c) { return `<span class="tag tag-party ${partyClass(c.party)}">${esc(c.party || T('No Party Affiliation', 'Sin afiliación partidista'))}</span>`; }

  /* ---------- storage ---------- */
  function loadAnswers() { return Object.assign({}, ANSWERS); }
  function saveAnswers(a) { ANSWERS = Object.assign({}, a || {}); }

  /* ---------- matching ---------- */
  function scoreCandidate(cand, race, answers) {
    const relevant = issuesForLevel(race.level);
    let num = 0, den = 0, used = 0, answered = 0;
    const agree = [], disagree = [];
    for (const issue of relevant) {
      const a = answers[issue.id];
      if (!a || a.value == null) continue;
      answered++;
      const pos = (cand.positions || {})[issue.id];
      if (!pos || pos.stance == null) continue;
      const w = a.important ? 2 : 1;
      const dist = Math.abs(a.value - pos.stance); // 0..4
      num += w * (1 - dist / 4);
      den += w;
      used++;
      if (dist <= 1) agree.push(issue); else if (dist >= 3) disagree.push(issue);
    }
    return { pct: den ? Math.round(100 * num / den) : null, used, answered, agree, disagree };
  }


  /* ---------- Where do you vote? (profile) ---------- */
  function loadProfile() { return PROFILE ? Object.assign({}, PROFILE) : null; }
  function saveProfile(p) { PROFILE = p ? Object.assign({}, p) : null; }
  function countyCodeFor(name) { const sw = window.STATEWIDE_DATA; if (!sw || !name) return null; const hit = Object.values(sw.counties).find(c => c.name.toLowerCase() === String(name).toLowerCase()); return hit ? hit.code : null; }
  function raceOnBallot(r, prof) {
    if (r.on_november_ballot === false) return false;
    const j = r.jurisdiction || { type: 'statewide' };
    if (j.type === 'statewide') return true;
    if (!prof) return false;
    if (j.type === 'cd') return prof.cd != null && Number(prof.cd) === Number(j.id);
    if (j.type === 'sd') return prof.sd != null && Number(prof.sd) === Number(j.id);
    if (j.type === 'hd') return prof.hd != null && Number(prof.hd) === Number(j.id);
    if (j.type === 'county') return !!prof.county && String(j.id).toLowerCase() === String(prof.county).toLowerCase();
    return false;
  }
  function ballotRaces(prof) { return RACES.filter(r => raceOnBallot(r, prof)); }
  function jurKey(r) { const j = r.jurisdiction || {}; return j.type === 'statewide' || !j.type ? 'statewide' : `${j.type}-${j.id}`; }
  function jurLabel(r) { const j = r.jurisdiction || {}; return j.type === 'statewide' ? 'Statewide' : j.type === 'cd' ? `Congressional District ${j.id}` : j.type === 'sd' ? `Senate District ${j.id}` : j.type === 'hd' ? `House District ${j.id}` : j.type === 'county' ? `${j.id} County` : ''; }
  function dcaFor(county) { const c = county && FL.counties && FL.counties[county]; return c ? c.dca : null; }
  function profileSummary(prof) {
    if (!prof) return '';
    const bits = [];
    if (prof.county) bits.push(T(`${prof.county} County`, `Condado de ${prof.county}`));
    if (prof.cd) bits.push(`${T('Congressional District', 'Distrito Congresional')} ${prof.cd}${prof.cd_unconfirmed ? T(' (confirm)', ' (confirmar)') : ''}`);
    if (prof.sd) bits.push(`${T('Senate District', 'Distrito del Senado')} ${prof.sd}`);
    if (prof.hd) bits.push(`${T('House District', 'Distrito de la Cámara')} ${prof.hd}`);
    return bits.join(' · ');
  }
  function coverageNote(r) {
    if (r.coverage === 'full') return '';
    if (r.coverage === 'none' || !(r.candidates || []).length) return `<p class="notice notice-warn"><strong>${T('No candidate data yet for this race.', 'Aún no hay datos de candidatos para esta contienda.')}</strong> ${T("Check your county Supervisor of Elections sample ballot; this guide's research has not reached this contest.", 'Consulte la boleta de muestra del Supervisor de Elecciones de su condado; la investigación de esta guía aún no ha llegado a esta contienda.')}</p>`;
    if (r.coverage === 'roster') return `<p class="notice notice-warn"><strong>${T('Candidate list only.', 'Solo lista de candidatos.')}</strong> ${T('We have verified who is on the ballot for this race but have not yet researched their positions, so most issues will show "No public position found" and the match tool cannot score them. Campaign websites are linked where known.', 'Hemos verificado quién está en la boleta para esta contienda, pero aún no hemos investigado sus posiciones, así que la mayoría de los temas mostrarán "No se encontró una posición pública" y la herramienta de coincidencia no puede puntuarlos. Los sitios de campaña están enlazados cuando se conocen.')}</p>`;
    if (r.coverage === 'partial') return `<p class="notice notice-warn"><strong>${T('Partly verified.', 'Parcialmente verificado.')}</strong> ${T('Either the November opponent could not be confirmed from available sources, or only a few positions are documented. Confirm the full candidate list on your county sample ballot; unknown positions are shown as such.', 'O no se pudo confirmar el oponente de noviembre con las fuentes disponibles, o solo hay unas pocas posiciones documentadas. Confirme la lista completa de candidatos en la boleta de muestra de su condado; las posiciones desconocidas se muestran como tales.')}</p>`;
    return '';
  }
  function addressPanel(compact) {
    const prof = loadProfile();
    const cdWarn = prof && prof.cd_unconfirmed ? `<p class="notice notice-warn" style="margin-top:10px"><strong>${T('Check your congressional district.', 'Verifique su distrito congresional.')}</strong> ${T("Florida adopted a new congressional map in May 2026 that changed 21 of 28 districts, and the Census Bureau's lookup still uses the old lines. Your county and state legislative districts are reliable; for the U.S. House race,", 'Florida adoptó un nuevo mapa congresional en mayo de 2026 que cambió 21 de los 28 distritos, y la búsqueda de la Oficina del Censo todavía usa las líneas antiguas. Su condado y sus distritos legislativos estatales son confiables; para la contienda de la Cámara de Representantes de EE. UU.,')} <a href="https://registration.elections.myflorida.com/CheckVoterStatus" target="_blank" rel="noopener">${T('look up your district on the state voter site', 'busque su distrito en el sitio estatal del votante')}</a> ${T('and', 'e')} <a href="#/where">${T('enter it manually', 'ingréselo manualmente')}</a> ${T('if it differs from', 'si es distinto de')} ${esc(String(prof.cd))}.</p>` : '';
    if (prof && compact) { const code = countyCodeFor(prof.county); return `<div class="card addr-bar"><div><span class="eyebrow" style="margin:0">${T('Your ballot', 'Su boleta')}</span> <strong>${esc(profileSummary(prof))}</strong> <small class="muted">${prof.label && !/preset/.test(prof.label) ? '· ' + esc(prof.label) : ''}</small></div><div class="btn-row" style="margin:0">${code ? `<a class="btn btn-sm" href="#/county/${esc(code)}">${T(`Official line-up for ${esc(prof.county)} County`, `Lista oficial del condado de ${esc(prof.county)}`)}</a>` : ''}<a class="btn btn-sm" href="#/where">${T('Change', 'Cambiar')}</a></div></div>${cdWarn}`; }
    return `<div class="card addr-panel">
      <div class="eyebrow">${T('Where do you vote?', '¿Dónde vota usted?')}</div>
      ${prof ? `<p>${T('Currently set to', 'Actualmente:')} <strong>${esc(profileSummary(prof))}</strong>${prof.label && !/preset/.test(prof.label) ? ` <small class="muted">(${esc(prof.label)})</small>` : ''}.</p>` : `<p class="muted">${T("Enter your Florida street address to see exactly the races and questions on your ballot. The address is sent once to the U.S. Census Bureau's public geocoder and is not stored; your county and district numbers are kept only while this page is open.", 'Ingrese su dirección en Florida para ver exactamente las contiendas y preguntas de su boleta. La dirección se envía una sola vez al geocodificador público de la Oficina del Censo de EE. UU. y no se guarda; su condado y sus números de distrito se conservan solo mientras esta página esté abierta.')}</p>`}
      <form class="addr-form" data-addr-form>
        <input class="search" type="text" name="address" placeholder="${T('Street address, city, FL  (e.g. 400 S Monroe St, Tallahassee, FL)', 'Dirección, ciudad, FL  (ej. 400 S Monroe St, Tallahassee, FL)')}" autocomplete="street-address" required />
        <button type="submit" class="btn btn-primary">${T('Find my ballot', 'Buscar mi boleta')}</button>
      </form>
      <div class="addr-status muted" data-addr-status></div>
      <details style="margin-top:10px"><summary>${T('Or pick your county and districts manually', 'O elija su condado y sus distritos manualmente')}</summary>
        <form class="addr-manual" data-manual-form>
          <label>${T('County', 'Condado')} <select name="county"><option value="">—</option>${COUNTY_NAMES.map(c => `<option value="${esc(c)}" ${prof && prof.county === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label>${T('Congressional district', 'Distrito congresional')} <input type="number" name="cd" min="1" max="28" value="${prof && prof.cd ? prof.cd : ''}" /></label>
          <label>${T('State Senate district', 'Distrito del Senado estatal')} <input type="number" name="sd" min="1" max="40" value="${prof && prof.sd ? prof.sd : ''}" /></label>
          <label>${T('State House district', 'Distrito de la Cámara estatal')} <input type="number" name="hd" min="1" max="120" value="${prof && prof.hd ? prof.hd : ''}" /></label>
          <button type="submit" class="btn btn-sm">${T('Save', 'Guardar')}</button>
          <a class="btn btn-sm" href="https://registration.elections.myflorida.com/CheckVoterStatus" target="_blank" rel="noopener">${T('Look up my districts on the state site ↗', 'Buscar mis distritos en el sitio estatal ↗')}</a>
        </form>
      </details>
      ${prof ? `<div class="btn-row"><button type="button" class="btn btn-sm" data-clear-profile>${T('Clear', 'Borrar')}</button></div>` : ''}
      <p class="muted" style="margin:10px 0 0"><small>${T("County and state legislative districts come from the U.S. Census Bureau's current files. Florida redrew its congressional districts in May 2026 and the Census files predate that map, so the congressional district is marked \"confirm\" until you check it on the state voter site and enter it manually if needed.", 'El condado y los distritos legislativos estatales provienen de los archivos actuales de la Oficina del Censo de EE. UU. Florida rediseñó sus distritos congresionales en mayo de 2026 y los archivos del Censo son anteriores a ese mapa, así que el distrito congresional se marca como "confirmar" hasta que lo verifique en el sitio estatal del votante y lo ingrese manualmente si es necesario.')}</small></p>
      ${cdWarn}
    </div>`;
  }
  function geocode(address) {
    return new Promise((resolve, reject) => {
      const cb = 'ccGeo' + Date.now();
      const script = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error(T('The Census geocoder did not respond. Try again or use the manual option.', 'El geocodificador del Censo no respondió. Intente de nuevo o use la opción manual.'))); }, 15000);
      function cleanup() { clearTimeout(timer); delete window[cb]; script.remove(); }
      window[cb] = data => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error(T('Could not reach the Census geocoder.', 'No se pudo conectar con el geocodificador del Censo.'))); };
      script.src = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=' + encodeURIComponent(address) + '&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=jsonp&callback=' + cb;
      document.head.appendChild(script);
    });
  }
  function profileFromGeo(data, address) {
    const m = data && data.result && data.result.addressMatches && data.result.addressMatches[0];
    if (!m) return null;
    const g = m.geographies || {};
    const pick = re => { const k = Object.keys(g).find(k => re.test(k)); return k && g[k] && g[k][0]; };
    const county = pick(/^Counties$/i), cd = pick(/Congressional Districts/i), sd = pick(/Legislative Districts - Upper/i), hd = pick(/Legislative Districts - Lower/i), st = pick(/^States$/i);
    if (st && st.BASENAME && st.BASENAME !== 'Florida') return { error: T(`That address geocodes to ${st.BASENAME}, not Florida.`, `Esa dirección corresponde a ${st.BASENAME}, no a Florida.`) };
    const num = o => { if (!o) return null; const v = parseInt(String(o.BASENAME || o.NAME || '').replace(/\D/g, ''), 10); return isNaN(v) ? null : v; };
    return { county: county ? String(county.BASENAME || county.NAME || '').replace(/ County$/, '') : null, cd: num(cd), cd_unconfirmed: true, sd: num(sd), hd: num(hd), label: m.matchedAddress || address };
  }
  function bindAddress(root) {
    const form = root.querySelector('[data-addr-form]'); const status = root.querySelector('[data-addr-status]');
    if (form) form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const addr = form.address.value.trim(); if (!addr) return;
      status.textContent = T('Looking up your districts…', 'Buscando sus distritos…');
      try {
        const data = await geocode(/florida|,\s*fl\b/i.test(addr) ? addr : addr + ', FL');
        const prof = profileFromGeo(data, addr);
        if (!prof) { status.textContent = T('No match for that address. Check the spelling, add the city, or use the manual option below.', 'No se encontró esa dirección. Revise la ortografía, añada la ciudad o use la opción manual de abajo.'); return; }
        if (prof.error) { status.textContent = prof.error; return; }
        saveProfile(prof); status.textContent = ''; render();
      } catch (e) { status.textContent = e.message; }
    });
    const manual = root.querySelector('[data-manual-form]');
    if (manual) manual.addEventListener('submit', ev => { ev.preventDefault(); const f = manual; const prof = { county: f.county.value || null, cd: f.cd.value ? Number(f.cd.value) : null, sd: f.sd.value ? Number(f.sd.value) : null, hd: f.hd.value ? Number(f.hd.value) : null, label: 'entered manually' }; if (!prof.county && !prof.cd && !prof.hd) return; saveProfile(prof); render(); });
    const clear = root.querySelector('[data-clear-profile]'); if (clear) clear.addEventListener('click', () => { saveProfile(null); render(); });
  }
  function viewWhere() { return `<h1>${T('Where do you vote?', '¿Dónde vota usted?')}</h1>${addressPanel(false)}<div class="btn-row"><a class="btn btn-primary" href="#/">${T('Back to my ballot →', 'Volver a mi boleta →')}</a></div>`; }

  /* ---------- Landscape axes ---------- */
  // Each axis is the mean of the candidate's coded stances on the listed statements, with the sign
  // giving the direction that counts toward the positive end. Requires >= 3 documented statements.
  const AXES = {
    x: { label: 'Economic issues', neg: 'Larger government role (more programs, more regulation)', pos: 'Smaller government (lower taxes, less spending)', parts: { taxes: 1, property_tax: 1, healthcare: -1, housing: -1, insurance: -1, energy: -1, social_security: -1 } },
    y: { label: 'Social & legal issues', neg: 'Progressive side of the statements', pos: 'Conservative side of the statements', parts: { immigration: 1, abortion: -1, guns: -1, education_choice: 1, elections: -1, crime: 1, lgbtq: 1, marijuana: -1, environment: -1, trump: 1 } }
  };
  function axisValue(getStance, axis) {
    let sum = 0, n = 0;
    for (const [iid, sign] of Object.entries(AXES[axis].parts)) { const v = getStance(iid); if (v == null) continue; sum += sign * v; n++; }
    return n >= 3 ? { v: sum / n, n } : null;
  }
  function candPoint(c) { const g = iid => (c.positions && c.positions[iid] && c.positions[iid].stance != null) ? c.positions[iid].stance : null; return { x: axisValue(g, 'x'), y: axisValue(g, 'y') }; }
  function userPoint(answers) { const g = iid => (answers[iid] && answers[iid].value != null) ? answers[iid].value : null; return { x: axisValue(g, 'x'), y: axisValue(g, 'y') }; }

  function landscapeMap(cands, opts = {}) {
    const W = 720, H = 560, m = { l: 28, r: 28, t: 64, b: 84 };
    const sx = v => m.l + ((v + 2) / 4) * (W - m.l - m.r), sy = v => m.t + ((2 - v) / 4) * (H - m.t - m.b);
    const placed = [], tray = [];
    cands.forEach(c => { const p = candPoint(c); if (p.x && p.y) placed.push({ c, p }); else tray.push(c); });
    const r = 22;
    const ticks = [-2, -1, 0, 1, 2];
    // Separate bubbles that would overlap so every candidate stays visible; positions move by at most a few pixels per pass.
    const pts = placed.map(({ p }) => ({ x: sx(p.x.v), y: sy(p.y.v) }));
    for (let pass = 0; pass < 30; pass++) {
      let moved = false;
      for (let a = 0; a < pts.length; a++) for (let b2 = a + 1; b2 < pts.length; b2++) {
        const dx = pts[b2].x - pts[a].x, dy = pts[b2].y - pts[a].y; const d = Math.hypot(dx, dy) || 0.01; const min = 2 * r + 6;
        if (d < min) { const push = (min - d) / 2; const ux = dx / d, uy = dy / d; pts[a].x -= ux * push; pts[a].y -= uy * push; pts[b2].x += ux * push; pts[b2].y += uy * push; moved = true; }
      }
      if (!moved) break;
    }
    pts.forEach(pt => { pt.x = Math.max(m.l + r, Math.min(W - m.r - r, pt.x)); pt.y = Math.max(m.t + r, Math.min(H - m.b - r, pt.y)); });
    const defs = placed.map(({ c }) => `<clipPath id="clip-${esc(c.id)}"><circle cx="0" cy="0" r="${r - 3}"/></clipPath>`).join('');
    const bubbles = placed.map(({ c, p }, idx) => {
      const x = pts[idx].x, y = pts[idx].y;
      const img = c.photo_local || c.photo_url;
      const color = `var(--${partyClass(c.party).replace('party-', '').toLowerCase().replace('republican', 'rep').replace('democratic', 'dem').replace('libertarian', 'lib').replace('write-in', 'wri').replace('nonpartisan', 'npa')})`;
      return `<g class="bubble" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" data-id="${esc(c.id)}" tabindex="0" role="img" aria-label="${esc(c.name)}: ${AXES.x.label} ${p.x.v.toFixed(1)}, ${AXES.y.label} ${p.y.v.toFixed(1)}">
        <g class="inner"><circle class="ring" r="${r + 2}"/>
        <circle r="${r}" fill="${color}"/>
        ${img ? `<image href="${esc(img)}" x="${-(r - 3)}" y="${-(r - 3)}" width="${2 * (r - 3)}" height="${2 * (r - 3)}" clip-path="url(#clip-${esc(c.id)})" preserveAspectRatio="xMidYMid slice"/>` : `<text text-anchor="middle" dy="5" fill="#fff" font-size="13" font-weight="700">${esc(initials(c.name))}</text>`}</g>
        <text class="name" x="${r + 6}" dy="4">${esc(c.name.split(' ').slice(-1)[0])}</text>
      </g>`;
    }).join('');
    let you = '';
    if (opts.you && opts.you.x && opts.you.y) {
      const x = sx(opts.you.x.v), y = sy(opts.you.y.v);
      you = `<g class="bubble" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" data-id="__you" tabindex="0" aria-label="You"><path class="you" d="M0,-16 L4.7,-4.9 L16.9,-4.9 L7.1,2.2 L10.6,13.4 L0,6.4 L-10.6,13.4 L-7.1,2.2 L-16.9,-4.9 L-4.7,-4.9 Z"/><text class="name" x="20" dy="4">You</text></g>`;
    }
    return `<div class="map-wrap"><svg class="map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Candidates plotted by economic and social policy positions">
      <defs>${defs}</defs>
      ${ticks.map(t => `<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${m.t}" y2="${H - m.b}"/><line class="grid" y1="${sy(t)}" y2="${sy(t)}" x1="${m.l}" x2="${W - m.r}"/>`).join('')}
      <line x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--text-muted)" stroke-width="1.5" opacity=".6"/>
      <line y1="${sy(0)}" y2="${sy(0)}" x1="${m.l}" x2="${W - m.r}" stroke="var(--text-muted)" stroke-width="1.5" opacity=".6"/>
      <text class="axis-label" x="${m.l}" y="${m.t - 40}">${esc(AXES.y.label)}</text>
      <text class="axis-end" x="${m.l}" y="${m.t - 20}">▲ Up = ${esc(AXES.y.pos)}</text>
      <text class="axis-end" x="${m.l}" y="${H - m.b + 22}">▼ Down = ${esc(AXES.y.neg)}</text>
      <text class="axis-label" x="${m.l}" y="${H - 34}">${esc(AXES.x.label)}</text>
      <text class="axis-end" x="${m.l}" y="${H - 14}">◀ Left = larger government role</text>
      <text class="axis-end" x="${W - m.r}" y="${H - 14}" text-anchor="end">Right = smaller government, lower taxes ▶</text>
      <text class="axis-end" x="${sx(0) + 6}" y="${m.t + 14}" opacity=".8">center line = neutral / mixed</text>
      ${bubbles}${you}
    </svg><div class="map-tip" role="tooltip"></div></div>
    <div class="map-legend" aria-label="Bubble colors by party">${(() => { const seen = new Map(); cands.forEach(c => { const k = partyClass(c.party); if (!seen.has(k)) seen.set(k, c.party || 'No Party Affiliation'); }); return [...seen.entries()].map(([k, label]) => `<span><i class="${k}"></i>${esc(label)}</span>`).join(''); })()}<span class="muted">· photo or initials inside each bubble · hover or tap for details</span></div>
    ${tray.length ? `<div class="map-tray">${T('Not enough documented positions to place:', 'Sin suficientes posiciones documentadas para ubicar:')} ${tray.map(c => `<a class="cand-chip" href="#/candidate/${esc(c.id)}">${avatar(c, 'sm')}${esc(c.name)}</a>`).join('')}</div>` : ''}
    <details style="margin-top:10px"><summary>How the axes are computed</summary><p class="muted" style="margin-top:8px">Each axis is the average of a candidate's coded stances (+2 to −2) on a fixed set of statements, so it comes straight from the documented positions and nothing else. A candidate needs at least three documented statements on an axis to be placed.</p>
      <p><strong>${esc(AXES.x.label)}</strong> (toward "${esc(AXES.x.pos)}"): ${Object.entries(AXES.x.parts).map(([k, v]) => `${esc(ISSUE_BY_ID[k] ? ISSUE_BY_ID[k].label : k)} (${v > 0 ? 'agree' : 'disagree'})`).join(', ')}.</p>
      <p><strong>${esc(AXES.y.label)}</strong> (toward "${esc(AXES.y.pos)}"): ${Object.entries(AXES.y.parts).map(([k, v]) => `${esc(ISSUE_BY_ID[k] ? ISSUE_BY_ID[k].label : k)} (${v > 0 ? 'agree' : 'disagree'})`).join(', ')}.</p>
      <div class="table-wrap"><table><thead><tr><th>Candidate</th><th>${esc(AXES.x.label)}</th><th>${esc(AXES.y.label)}</th></tr></thead><tbody>${cands.map(c => { const p = candPoint(c); return `<tr><td>${esc(c.name)}</td><td>${p.x ? `${p.x.v.toFixed(2)} (${p.x.n} statements)` : 'not enough data'}</td><td>${p.y ? `${p.y.v.toFixed(2)} (${p.y.n} statements)` : 'not enough data'}</td></tr>`; }).join('')}${opts.you && opts.you.x && opts.you.y ? `<tr><td><strong>You</strong></td><td>${opts.you.x.v.toFixed(2)}</td><td>${opts.you.y.v.toFixed(2)}</td></tr>` : ''}</tbody></table></div></details>`;
  }
  function bindMap(root) {
    root.querySelectorAll('.map-wrap').forEach(wrap => {
      const tip = wrap.querySelector('.map-tip');
      const show = (g, ev) => {
        const id = g.dataset.id;
        if (id === '__you') { tip.innerHTML = '<strong>You</strong><br><span class="muted">Placed from your answers.</span>'; }
        else { const c = CAND_BY_ID[id]; const p = candPoint(c); const r = RACE_BY_ID[c.race_id]; tip.innerHTML = `<strong>${esc(c.name)}</strong> <span class="muted">(${esc(partyShort(c.party))})</span><br><span class="muted">${esc(r.title)}</span><br>${esc(AXES.x.label)}: ${p.x.v.toFixed(1)} · ${esc(AXES.y.label)}: ${p.y.v.toFixed(1)}<br><span class="muted">${p.x.n + p.y.n} documented statements used. Click for profile.</span>`; }
        tip.style.display = 'block';
        const b = wrap.getBoundingClientRect();
        const px = (ev && ev.clientX ? ev.clientX - b.left : b.width / 2), py = (ev && ev.clientY ? ev.clientY - b.top : b.height / 2);
        tip.style.left = Math.min(px + 14, b.width - 270) + 'px'; tip.style.top = (py + 14) + 'px';
      };
      wrap.querySelectorAll('.bubble').forEach(g => {
        g.addEventListener('mousemove', ev => show(g, ev));
        g.addEventListener('focus', ev => show(g, ev));
        g.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        g.addEventListener('blur', () => { tip.style.display = 'none'; });
        g.addEventListener('click', () => { if (g.dataset.id !== '__you') location.hash = '#/candidate/' + g.dataset.id; });
      });
    });
  }

  /* ---------- Heat strip: where the candidates split ---------- */
  function heatStrip(r, cands, issues) {
    const cells = issues.map(issue => {
      const vals = cands.filter(c => !c.withdrawn).map(c => (c.positions || {})[issue.id]).filter(p => p && p.stance != null).map(p => p.stance);
      const spread = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null;
      const cls = spread == null ? 'hx' : spread === 0 ? 'h0' : 'h' + spread;
      const text = spread == null ? T(`${esc(issue.label)}: not enough documented positions to compare (${vals.length} candidate${vals.length === 1 ? '' : 's'} with a position).`, `${esc(iLabel(issue))}: no hay suficientes posiciones documentadas para comparar (${vals.length} candidato${vals.length === 1 ? '' : 's'} con posición).`) : spread === 0 ? T(`${esc(issue.label)}: the candidates with documented positions agree.`, `${esc(iLabel(issue))}: los candidatos con posiciones documentadas coinciden.`) : T(`${esc(issue.label)}: candidates differ by ${spread} step${spread > 1 ? 's' : ''} on the 5-point scale.`, `${esc(iLabel(issue))}: los candidatos difieren en ${spread} paso${spread > 1 ? 's' : ''} en la escala de 5 puntos.`);
      return `<button type="button" class="${cls}" data-issue="${esc(issue.id)}" data-text="${text}" aria-label="${text}"></button>`;
    }).join('');
    return `<div class="heat-legend"><span><i style="background:color-mix(in srgb, var(--success) 16%, var(--surface))"></i>${T('Agree', 'Coinciden')}</span><span><i style="background:color-mix(in srgb, var(--accent) 18%, var(--surface))"></i>${T('Differ a little', 'Difieren un poco')}</span><span><i style="background:var(--accent)"></i>${T('Differ strongly', 'Difieren mucho')}</span><span><i style="background:repeating-linear-gradient(45deg, var(--surface-2) 0 3px, var(--surface) 3px 6px)"></i>${T('Not enough data', 'Datos insuficientes')}</span><span class="muted">· ${T('hover for details, click to jump to the row', 'pase el cursor para ver detalles, haga clic para ir a la fila')}</span></div>
      <div class="heat" role="group" aria-label="${T('Where the candidates split, by issue', 'Dónde se dividen los candidatos, por tema')}">${cells}</div>
      <div class="heat-labels">${issues.map(i => `<span title="${esc(iLabel(i))}">${esc(iLabel(i))}</span>`).join('')}</div>
      <div class="heat-tip muted" aria-live="polite">${T('Where the candidates in this race split, issue by issue.', 'Dónde se dividen los candidatos de esta contienda, tema por tema.')}</div>`;
  }
  function bindColumns(root) {
    const pick = root.querySelector('[data-colpicker]'); if (!pick) return;
    const apply = () => { pick.querySelectorAll('[data-colcand]').forEach(cb => { root.querySelectorAll(`.compare [data-cand="${cb.dataset.colcand}"]`).forEach(cell => cell.classList.toggle('col-hidden', !cb.checked)); }); };
    pick.querySelectorAll('[data-colcand]').forEach(cb => cb.addEventListener('change', apply));
    const all = pick.querySelector('[data-colall]'); if (all) all.addEventListener('click', () => { pick.querySelectorAll('[data-colcand]').forEach(cb => { cb.checked = true; }); apply(); });
  }
  function bindHeat(root) {
    const tip = root.querySelector('.heat-tip'); if (!tip) return;
    root.querySelectorAll('.heat button').forEach(b => {
      const showT = () => { tip.textContent = b.dataset.text; };
      b.addEventListener('mouseenter', showT); b.addEventListener('focus', showT);
      b.addEventListener('click', () => { const row = root.querySelector(`tr[data-issue="${b.dataset.issue}"]`); if (row) { root.querySelectorAll('tr.highlight').forEach(x => x.classList.remove('highlight')); row.classList.add('highlight'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    });
  }

  /* ---------- Countdown ---------- */
  function countdown() {
    const items = [[T('Election Day', 'Día de la elección'), '2026-11-03', T('Tue, Nov 3', 'mar. 3 nov.')], [T('Registration deadline', 'Plazo de registro'), '2026-10-05', T('Mon, Oct 5', 'lun. 5 oct.')], [T('Mail-ballot request deadline', 'Plazo para pedir boleta por correo'), '2026-10-22', T('Thu, Oct 22', 'jue. 22 oct.')], [T('Early voting begins', 'Empieza la votación anticipada'), '2026-10-24', T('Sat, Oct 24 (confirm)', 'sáb. 24 oct. (confirmar)')]];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return `<div class="countdown">${items.map(([label, iso, pretty]) => { const d = Math.round((new Date(iso + 'T00:00:00') - today) / 86400000); const num = d > 0 ? d : d === 0 ? T('Today', 'Hoy') : T('Passed', 'Pasó'); return `<div class="cd-tile"><div class="cd-num">${esc(String(num))}</div><div class="cd-label">${d > 0 ? T('days until ', 'días hasta: ') : ''}${esc(label)}</div><div class="cd-date">${esc(pretty)}</div></div>`; }).join('')}</div>`;
  }

  /* ---------- views ---------- */
  function viewHome() {
    const prof = loadProfile();
    const mine = ballotRaces(prof);
    const groups = {};
    mine.forEach(r => { (groups[r.office_group] = groups[r.office_group] || []).push(r); });
    return `
      <section class="hero">
        <div class="eyebrow">${T('Florida · General Election · November 3, 2026', 'Florida · Elección General · 3 de noviembre de 2026')}</div>
        <h1>${T('Know every race on your ballot. Decide on the facts.', 'Conozca cada contienda en su boleta. Decida con los hechos.')}</h1>
        <p class="lead">${T("A nonpartisan, source-cited guide to the candidates and questions on Florida ballots this November, filtered to your address, plus a tool that matches your own views to each candidate's documented positions.", 'Una guía no partidista, con fuentes citadas, de los candidatos y las preguntas en las boletas de Florida este noviembre, filtrada según su dirección, más una herramienta que compara sus opiniones con las posiciones documentadas de cada candidato.')}</p>${LANG === 'es' ? ES_NOTE : ''}
        <div class="hero-cta">
          <a class="btn btn-primary btn-hero" href="#/match"><span class="btn-hero-main">${T('Take the 2-minute quiz', 'Haga el cuestionario de 2 minutos')}</span><span class="btn-hero-sub">${T('Answer 21 statements and see which candidates match your views →', 'Responda 21 afirmaciones y vea qué candidatos coinciden con usted →')}</span></a>
        </div>
        <div class="btn-row">
          <a class="btn" href="#/races">${T('Browse races', 'Ver contiendas')}</a>
          <a class="btn" href="#/counties">${T('All 67 counties', 'Los 67 condados')}</a>
          <a class="btn" href="#/vote">${T('How &amp; where to vote', 'Cómo y dónde votar')}</a>
        </div>
      </section>
      <section class="section">${addressPanel(!!prof)}</section>
      <section class="section">${countdown()}</section>
      <section class="section">
        <div class="section-head"><h2>${prof ? T('Races on your ballot', 'Contiendas en su boleta') : T('Statewide races (every Florida voter)', 'Contiendas estatales (todos los votantes de Florida)')}</h2><a href="#/races">${T('See all →', 'Ver todas →')}</a></div>
        ${!prof ? `<p class="muted">${T('Enter your address above to add your congressional, state legislative and county races, or <a href="#/counties">pick your county</a> to see the official line-up for every contest.', 'Ingrese su dirección arriba para añadir sus contiendas del Congreso, la Legislatura y el condado, o <a href="#/counties">elija su condado</a> para ver la lista oficial de cada contienda.')}</p>` : ''}
        ${Object.keys(groups).map(g => `<h3 style="margin-top:14px">${esc(g)}</h3><div class="grid grid-2">${groups[g].map(raceCard).join('')}</div>`).join('')}
      </section>
      <section class="section grid grid-3">
        <div class="card"><div class="eyebrow">${T('Ballot questions', 'Preguntas en la boleta')}</div><h3><a href="#/amendments">${(DATA.amendments || []).length || 3} ${T('constitutional amendments', 'enmiendas constitucionales')}</a></h3><p class="muted">${T('Official ballot language, what a Yes or No vote does, fiscal impact, and the arguments each side is making, attributed to who is making them.', 'Texto oficial de la boleta, qué significa votar Sí o No, impacto fiscal y los argumentos de cada lado, con su fuente.')}</p></div>
        <div class="card"><div class="eyebrow">${T('Judicial retention', 'Retención de jueces')}</div><h3><a href="#/judges">${T('Should these judges keep their seats?', '¿Deben estos jueces conservar su cargo?')}</a></h3><p class="muted">${T("Background on the Supreme Court justice and the appellate judges on your county's ballot.", 'Antecedentes del magistrado de la Corte Suprema y de los jueces de apelación en la boleta de su condado.')}</p></div>
        <div class="card"><div class="eyebrow">${T('How this guide works', 'Cómo funciona esta guía')}</div><h3><a href="#/about">${T('Methodology &amp; neutrality rules', 'Metodología y reglas de neutralidad')}</a></h3><p class="muted">${T('How positions are coded, why some are marked unknown, and how the match score is calculated.', 'Cómo se codifican las posiciones, por qué algunas se marcan como desconocidas y cómo se calcula el puntaje de coincidencia.')}</p></div>
      </section>`;
  }

  function raceCard(r) {
    const cands = r.candidates || [];
    return `<div class="card race-card">
      <div>${jurKey(r) !== 'statewide' ? `<span class="tag">${esc(jurLabel(r))}</span>` : ''}${r.coverage && r.coverage !== 'full' ? `<span class="tag" style="color:var(--warn)">${r.coverage === 'roster' ? T('Candidate list only', 'Solo lista de candidatos') : r.coverage === 'partial' ? T('Partly verified', 'Parcialmente verificado') : T('No data yet', 'Aún sin datos')}</span>` : ''}${r.on_november_ballot === false ? `<span class="tag">${T('Not on Nov. ballot', 'No está en la boleta de nov.')}</span>` : ''}</div>
      <h3><a href="#/race/${esc(r.id)}">${esc(r.title)}</a></h3>
      ${r.kind === 'measure' ? `<p class="muted">${esc(truncate(r.ballot_summary || T('Local ballot question.', 'Pregunta local en la boleta.'), 180))}</p><div><a class="btn btn-sm" href="#/race/${esc(r.id)}">${T('Read the question →', 'Leer la pregunta →')}</a></div>` : `<div class="cand-row">${cands.map(c => `<a class="cand-chip" href="#/candidate/${esc(c.id)}">${avatar(c, 'sm')}${esc(c.name)} <small>(${esc(partyShort(c.party))})</small></a>`).join('') || `<span class="empty">${T('No candidate data yet', 'Aún no hay datos de candidatos')}</span>`}</div>
      <div><a class="btn btn-sm" href="#/race/${esc(r.id)}">${cands.length ? T('Compare positions →', 'Comparar posiciones →') : T('Details →', 'Detalles →')}</a></div>`}
    </div>`;
  }

  function viewRaces(filter) {
    const prof = loadProfile();
    const match = r => !filter ? true : filter.kind === 'group' ? (r.office_group || '') === filter.value : jurKey(r) === filter.value;
    const mine = ballotRaces(prof).filter(match);
    const mineIds = new Set(mine.map(r => r.id));
    const others = RACES.filter(r => !mineIds.has(r.id) && match(r));
    const filterLabel = !filter ? '' : filter.kind === 'group' ? T(`${filter.value} races`, `Contiendas: ${filter.value}`) : (filter.value === 'statewide' ? T('Statewide races', 'Contiendas estatales') : (RACES.find(r => jurKey(r) === filter.value) ? jurLabel(RACES.find(r => jurKey(r) === filter.value)) : filter.value));
    const groupBy = list => { const g = {}; list.forEach(r => { const k = r.jurisdiction && r.jurisdiction.type === 'cd' ? T('U.S. House', 'Cámara de Representantes de EE. UU.') : r.jurisdiction && r.jurisdiction.type === 'sd' ? T('Florida Senate', 'Senado de Florida') : r.jurisdiction && r.jurisdiction.type === 'hd' ? T('Florida House', 'Cámara de Florida') : r.jurisdiction && r.jurisdiction.type === 'county' ? T('County & local', 'Condado y local') : r.office_group; (g[k] = g[k] || []).push(r); }); return g; };
    const gm = groupBy(mine), go = groupBy(others);
    const other = DATA.other_races || {};
    const sb = DATA.school_board || {};
    const isSumter = prof && /^sumter$/i.test(prof.county || '');
    return `<h1>${T('Races on the ballot', 'Contiendas en la boleta')}</h1>${LANG === 'es' ? ES_NOTE : ''}
      ${filter ? `<div class="card filter-bar"><span>${T('Showing', 'Mostrando')} <strong>${esc(filterLabel)}</strong> (${mine.length + others.length})</span> <a class="btn btn-sm" href="#/races">${T('Show all races', 'Mostrar todas las contiendas')}</a></div>` : ''}
      ${addressPanel(!!prof)}
      ${prof ? `<h2 class="section">${T('On your ballot', 'En su boleta')}</h2>` : `<h2 class="section">${T('Statewide races', 'Contiendas estatales')}</h2><p class="muted">${T('Every Florida voter sees these. Enter your address above to add your district and county races.', 'Todos los votantes de Florida ven estas contiendas. Ingrese su dirección arriba para añadir las de su distrito y su condado.')}</p>`}
      ${Object.keys(gm).map(g => `<section class="section" style="margin-top:20px"><h3>${esc(g)}</h3><div class="grid grid-2">${gm[g].map(raceCard).join('')}</div></section>`).join('')}
      <section class="section"><h2>${T('Also on the ballot', 'También en la boleta')}</h2>
        <div class="grid grid-2">
          <div class="card"><h3><a href="#/amendments">${T('Constitutional amendments', 'Enmiendas constitucionales')}</a></h3><p class="muted">${T('Three statewide amendments; each needs 60% to pass.', 'Tres enmiendas estatales; cada una necesita el 60% para aprobarse.')}</p></div>
          <div class="card"><h3><a href="#/judges">${T('Judicial merit retention', 'Retención de jueces por mérito')}</a></h3><p class="muted">${T('Yes/No votes on whether appellate judges keep their seats.', 'Votos de Sí/No sobre si los jueces de apelación conservan su cargo.')}</p></div>
        </div>
      </section>
      ${others.length ? `<section class="section"><details><summary>${T(`Other Florida races in this guide (${others.length}) — not on your ballot${prof ? '' : ' until you enter an address'}`, `Otras contiendas de Florida en esta guía (${others.length}): no están en su boleta${prof ? '' : ' hasta que ingrese una dirección'}`)}</summary>
        ${Object.keys(go).map(g => `<h3 style="margin-top:14px">${esc(g)}</h3><div class="grid grid-2">${go[g].map(raceCard).join('')}</div>`).join('')}
      </details></section>` : ''}
      ${isSumter && ((other.decided_or_unopposed && other.decided_or_unopposed.length) || (sb.contests && sb.contests.length)) ? `
      <section class="section"><h2>Sumter County: decided, uncontested, municipal and unverified items</h2>
        <p class="muted">Seats filled in the August 18 primary or without opposition, city council seats scheduled for November (candidates not yet verified), and items we could not confirm. Check your sample ballot for city races.</p>
        <div class="card">
          ${(other.decided_or_unopposed || []).length ? `<ul>${other.decided_or_unopposed.map(x => `<li><strong>${esc(x.office || x.title || x.race || '')}</strong>${x.status ? ` <span class="tag">${esc(x.status)}</span>` : ''}${x.result ? ': ' + esc(x.result) : ''}${x.note ? `<br><small class="muted">${esc(x.note)}</small>` : ''}${sourcesHtml(x.sources)}</li>`).join('')}</ul>` : ''}
          ${(other.municipal_and_district_races && (other.municipal_and_district_races.races || []).length) ? `<h3>City and Village district races (only in the precincts listed)</h3>${other.municipal_and_district_races.note ? `<p class="muted"><small>${esc(other.municipal_and_district_races.note)}</small></p>` : ''}<ul>${other.municipal_and_district_races.races.map(x => `<li><strong>${esc(x.office)}</strong>: ${(x.candidates || []).map(esc).join(' vs. ')}${x.precincts ? `<br><small class="muted">Precincts ${esc(x.precincts)}</small>` : ''}${sourcesHtml(x.sources)}</li>`).join('')}</ul>${other.municipal_and_district_races.uncontested_note ? `<p class="muted"><small>${esc(other.municipal_and_district_races.uncontested_note)}</small></p>` : ''}` : ''}
          ${(sb.contests || []).length ? `<h3>School Board (nonpartisan, decided August 18)</h3><ul>${sb.contests.map(x => `<li><strong>${esc(x.office || '')}</strong>: ${(x.results || []).map(r => `${esc(r.name)} ${r.pct != null ? r.pct + '%' : ''}${r.winner ? ' (won)' : ''}`).join(' vs. ')}${sourcesHtml(x.sources)}</li>`).join('')}</ul>` : ''}
          ${other.verified_ballot_note ? `<p class="muted"><small>${esc(other.verified_ballot_note)}</small></p>` : ''}
        </div>
      </section>` : ''}`;
  }

  function viewRace(id) {
    const r = RACE_BY_ID[id];
    if (!r) return notFound();
    const cands = r.candidates || [];
    const issues = issuesForLevel(r.level);
    if (r.kind === 'measure') return `<div class="breadcrumb"><a href="#/races">${T('Races', 'Contiendas')}</a> › ${esc(r.title)}</div><span class="tag tag-level">${esc(jurLabel(r))}</span><h1>${esc(r.title)}</h1>${LANG === 'es' ? ES_NOTE : ''}${r.ballot_summary ? `<div class="card"><h3>${T('Ballot summary', 'Resumen de la boleta')}</h3><p>${esc(r.ballot_summary)}</p><div class="grid grid-2"><div><h3>${T('A "Yes" vote means', 'Un voto "Sí" significa')}</h3><p>${esc(r.what_yes_means || '')}</p></div><div><h3>${T('A "No" vote means', 'Un voto "No" significa')}</h3><p>${esc(r.what_no_means || '')}</p></div></div></div>` : ''}${r.verified_ballot_note ? `<p class="muted"><small>${esc(r.verified_ballot_note)}</small></p>` : ''}`;
    return `<div class="breadcrumb"><a href="#/races">${T('Races', 'Contiendas')}</a> › ${esc(r.title)}</div>
      ${jurKey(r) !== 'statewide' ? `<span class="tag">${esc(jurLabel(r))}</span>` : ''}${(r.counties || []).length ? `<span class="tag">${esc(r.counties.join(', '))}</span>` : ''}
      <h1>${esc(r.title)}</h1>${LANG === 'es' ? ES_NOTE : ''}
      <p class="lead muted">${esc(r.what_it_does || '')} ${r.term ? `<strong>${T('Term:', 'Mandato:')}</strong> ${esc(r.term)}.` : ''}</p>
      ${r.on_november_ballot === false ? `<p class="notice"><strong>${T('Not on the November ballot.', 'No está en la boleta de noviembre.')}</strong> ${esc(r.decided_note || T('This seat was decided before the general election.', 'Este cargo se decidió antes de la elección general.'))}</p>` : ''}
      ${coverageNote(r)}
      ${r.verified_ballot_note ? `<details class="notice" style="border-radius:0 var(--radius-sm) var(--radius-sm) 0"><summary>${T('How we verified who is on the ballot', 'Cómo verificamos quién está en la boleta')}</summary><p style="margin:8px 0 0">${esc(r.verified_ballot_note)}</p>${sourcesHtml(r.verified_ballot_sources)}</details>` : ''}
      ${(r.events || []).length ? `<div class="card"><h3 style="margin:0 0 6px">${T('Debates and forums', 'Debates y foros')}</h3><ul style="margin:0">${r.events.map(e => `<li>${e.date ? `<strong>${esc(e.date)}</strong> · ` : ''}${esc(e.host || '')}${e.who ? ` · ${esc(e.who)}` : ''}${sourcesHtml(e.sources)}</li>`).join('')}</ul></div>` : ''}
      <div class="btn-row"><a class="btn btn-primary" href="#/match">${T('See how you match in this race →', 'Vea su coincidencia en esta contienda →')}</a></div>
      <section class="section"><div class="section-head"><h2>${T('Candidates', 'Candidatos')}</h2><small>${reportLink(r.title)}</small></div>${cands.some(c => c.withdrawn) ? `<p class="notice notice-warn">${T('Candidates marked "Withdrew", "Defeated in the primary" or "Did not qualify" are not running in November, according to the Florida Division of Elections candidate list. A name may still be printed on the ballot if the withdrawal came late; such votes are not counted. They are excluded from match results.', 'Los candidatos marcados como "Se retiró", "Derrotado en la primaria" o "No calificó" no compiten en noviembre, según la lista de candidatos de la División de Elecciones de Florida. Un nombre puede seguir impreso en la boleta si el retiro fue tardío; esos votos no se cuentan. Se excluyen de los resultados de coincidencia.')}</p>` : ''}<div class="stack">${cands.map(c => candidateCard(c)).join('')}</div></section>
      <section class="section">
        <div class="section-head"><h2>${T('Side-by-side on the major issues', 'Comparación en los temas principales')}</h2></div>
        ${heatStrip(r, cands, issues)}
        <div class="legend" style="margin-top:14px"><span class="stance stance-2">${stanceLabel('2')}</span><span class="stance stance-1">${stanceLabel('1')}</span><span class="stance stance-0">${stanceLabel('0')}</span><span class="stance stance--1">${stanceLabel('-1')}</span><span class="stance stance--2">${stanceLabel('-2')}</span><span class="stance stance-null">${stanceLabel('null')}</span></div>
        <p class="muted">${T('Each row is a statement. The chips show how each candidate\'s stated positions or record relate to that statement. Expand a row to read the evidence and sources. "No public position found" means we could not find a statement or record on the topic, not that the candidate has none.', 'Cada fila es una afirmación. Las etiquetas muestran cómo se relacionan con ella las posiciones declaradas o el historial de cada candidato. Abra una fila para leer la evidencia y las fuentes. "No se encontró una posición pública" significa que no encontramos una declaración ni un registro sobre el tema, no que el candidato no tenga posición.')}</p>
        ${cands.length > 2 ? `<div class="col-picker" data-colpicker><span class="muted">${T('Show:', 'Mostrar:')}</span>${cands.map(c => `<label><input type="checkbox" checked data-colcand="${esc(c.id)}"> ${esc(c.name.split(' ').slice(-1)[0])}</label>`).join('')}<button type="button" class="btn btn-sm" data-colall>${T('All', 'Todos')}</button></div>` : ''}
        <div class="table-wrap"><table class="compare">
          <thead><tr><th>${T('Issue', 'Tema')}</th>${cands.map(c => `<th class="cand-col" data-cand="${esc(c.id)}"><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a><br>${partyTag(c)}</th>`).join('')}</tr></thead>
          <tbody>${issues.map(issue => `<tr data-issue="${esc(issue.id)}">
            <td class="issue-cell">${esc(iLabel(issue))}<small>${esc(iStmt(issue))}</small></td>
            ${cands.map(c => { const p = (c.positions || {})[issue.id]; return `<td data-cand="${esc(c.id)}">${stanceChip(p)}${p && p.summary && p.stance != null ? `<div class="cell-summary">${esc(p.summary)}${sourcesHtml(p.sources)}</div>` : ''}</td>`; }).join('')}
          </tr>`).join('')}</tbody>
        </table></div>
      </section>
      <section class="section"><div class="section-head"><h2>${T('Where they sit on the map', 'Dónde se ubican en el mapa')}</h2></div><p class="muted">${T('Each candidate is placed by the average of their documented stances. It is a summary of the table above, not an extra judgment.', 'Cada candidato se ubica según el promedio de sus posiciones documentadas. Es un resumen de la tabla anterior, no un juicio adicional.')}</p><div class="card">${landscapeMap(cands)}</div></section>
      <section class="section"><h2>${T('Other issues the candidates have raised', 'Otros temas que los candidatos han planteado')}</h2>
        <p class="muted">${T('Priorities each candidate has brought up on their own, beyond the major-issue list above.', 'Prioridades que cada candidato ha planteado por su cuenta, más allá de la lista de temas principales.')}</p>
        <div class="grid grid-2">${cands.map(c => `<div class="card"><h3><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a></h3>${otherIssuesHtml(c, true)}</div>`).join('')}</div>
      </section>`;
  }

  function coverage(c) {
    const r = RACE_BY_ID[c.race_id]; if (!r) return '';
    const rel = issuesForLevel(r.level);
    const known = rel.filter(i => c.positions && c.positions[i.id] && c.positions[i.id].stance != null).length;
    return `<span class="tag" title="${T('Number of major issues relevant to this office on which a sourced position was found', 'Número de temas principales relevantes para este cargo con una posición documentada')}">${T('Positions documented:', 'Posiciones documentadas:')} ${known} ${T('of', 'de')} ${rel.length}</span>`;
  }
  function candidateCard(c) {
    return `<div class="card cand-card">
      <a href="#/candidate/${esc(c.id)}" aria-label="${esc(c.name)} ${T('profile', 'perfil')}">${avatar(c, 'lg')}</a>
      <div>
        <h3><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a>${c.running_mate ? ` <small class="muted">${T('with', 'con')} ${esc(c.running_mate)}</small>` : ''}</h3>
        <div class="cand-meta">${partyTag(c)}${c.incumbent ? `<span class="tag badge-incumbent">${T('Incumbent', 'Titular')}</span>` : ''}${c.withdrawn ? `<span class="tag" style="color:var(--danger)"${c.withdrawn_note ? ` title="${esc(c.withdrawn_note)}"` : ''}>${esc(withdrawnLabel(c))}</span>` : ''}${coverage(c)}${c.occupation ? `<span class="muted">${esc(c.occupation)}</span>` : ''}</div>
        <p>${esc(truncate(c.background || '', 320))}</p>${c.withdrawn && c.withdrawn_note ? `<p class="muted"><small>${esc(c.withdrawn_note)}${sourcesHtml(c.withdrawn_sources)}</small></p>` : ''}
        <div class="btn-row" style="margin-top:8px"><a class="btn btn-sm" href="#/candidate/${esc(c.id)}">${T('Full profile', 'Perfil completo')}</a>${c.website ? `<a class="btn btn-sm" href="${esc(c.website)}" target="_blank" rel="noopener">${T('Campaign site ↗', 'Sitio de campaña ↗')}</a>` : ''}</div>
      </div>
    </div>`;
  }

  function otherIssuesHtml(c, compact) {
    const list = c.other_issues || [];
    if (!list.length) return `<p class="empty">${T('No additional issues found in public statements as of the last data review.', 'No se encontraron temas adicionales en declaraciones públicas hasta la última revisión de datos.')}</p>`;
    return `<ul class="clean">${list.map(o => `<li><strong>${esc(o.title)}</strong>${o.summary ? ` — ${esc(o.summary)}` : ''}${sourcesHtml(o.sources)}</li>`).join('')}</ul>`;
  }

  function viewCandidate(id) {
    const c = CAND_BY_ID[id];
    if (!c) return notFound();
    const r = RACE_BY_ID[c.race_id];
    const issues = issuesForLevel(r.level);
    const known = issues.filter(i => c.positions && c.positions[i.id] && c.positions[i.id].stance != null);
    const unknown = issues.filter(i => !(c.positions && c.positions[i.id] && c.positions[i.id].stance != null));
    const allOther = ISSUES.filter(i => !issues.includes(i) && c.positions && c.positions[i.id] && c.positions[i.id].stance != null);
    const posBlock = i => { const p = c.positions[i.id]; return `<div class="issue-block" id="issue-${esc(i.id)}">
        <h4>${esc(iLabel(i))} ${stanceChip(p)}</h4>
        <div class="issue-statement">${T('Statement', 'Afirmación')}: "${esc(iStmt(i))}"</div>
        ${p.summary ? `<p class="issue-summary">${esc(p.summary)}</p>` : ''}
        ${p.quote ? `<blockquote>"${esc(p.quote)}"</blockquote>` : ''}
        ${sourcesHtml(p.sources)}
      </div>`; };
    return `<div class="breadcrumb"><a href="#/races">${T('Races', 'Contiendas')}</a> › <a href="#/race/${esc(r.id)}">${esc(r.title)}</a> › ${esc(c.name)}</div>
      <div class="card profile-head">
        <div>${avatar(c, 'xl')}${c.photo_source ? `<div class="sources" style="margin-top:8px">${T('Photo', 'Foto')}: ${esc(c.photo_source)}</div>` : ''}</div>
        <div>
          <span class="tag tag-level">${esc(r.title)}</span>
          <h1 style="margin-top:8px">${esc(c.name)}</h1>
          ${c.running_mate ? `<p class="muted">${T('Running mate', 'Compañero de fórmula')}: ${esc(c.running_mate)}</p>` : ''}
          <div class="cand-meta">${partyTag(c)}${c.incumbent ? `<span class="tag badge-incumbent">${T('Incumbent', 'Titular')}</span>` : ''}${c.withdrawn ? `<span class="tag" style="color:var(--danger)">${esc(withdrawnLabel(c))}</span>` : ''}${c.occupation ? `<span class="tag">${esc(c.occupation)}</span>` : ''}${c.residence ? `<span class="tag">${esc(c.residence)}</span>` : ''}</div>
          <p>${esc(c.background || '')}</p>
          ${c.primary_result ? `<p><strong>${T('How they got on the ballot:', 'Cómo llegó a la boleta:')}</strong> ${esc(c.primary_result)}</p>` : ''}
          <div class="profile-links">${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">${T('Campaign website ↗', 'Sitio de campaña ↗')}</a>` : ''}${(c.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)} ↗</a>`).join('')}</div>
          ${financeHtml(c, r)}
          <p class="muted"><small>${c.last_checked ? `${T('Sources last checked', 'Fuentes revisadas por última vez el')} ${esc(c.last_checked)}. ` : ''}${reportLink(c.name)}</small></p>
        </div>
      </div>
      <section class="section">
        <div class="section-head"><h2>${T('Positions on the major issues', 'Posiciones sobre los temas principales')}</h2><a href="#/race/${esc(r.id)}">${T('Compare with opponents →', 'Comparar con los oponentes →')}</a></div>
        <p class="muted">${T('Each entry describes what the candidate has said or done, and what they say they will do, in neutral terms with sources. The chip shows how that relates to the statement voters rate in the matching tool.', 'Cada entrada describe lo que el candidato ha dicho o hecho, y lo que dice que hará, en términos neutrales y con fuentes. La etiqueta muestra cómo se relaciona con la afirmación que los votantes califican en la herramienta de coincidencia.')}</p>
        <div class="card">${known.length ? known.map(posBlock).join('') : `<p class="empty">${T('No public positions on the major issues were found.', 'No se encontraron posiciones públicas sobre los temas principales.')}</p>`}</div>
        ${unknown.length ? `<details style="margin-top:12px"><summary>${T(`No public position found on ${unknown.length} issue${unknown.length > 1 ? 's' : ''}`, `No se encontró posición pública en ${unknown.length} tema${unknown.length > 1 ? 's' : ''}`)}</summary><p class="muted" style="margin-top:8px">${T('We searched campaign sites, questionnaires, interviews, votes and official actions and did not find a clear stance on:', 'Buscamos en sitios de campaña, cuestionarios, entrevistas, votos y acciones oficiales y no encontramos una postura clara sobre:')} ${unknown.map(i => esc(iLabel(i))).join(', ')}. ${T("This is reported as unknown rather than guessed from party affiliation; these issues are excluded from this candidate's match score.", 'Se reporta como desconocido en lugar de adivinarlo por la afiliación partidista; estos temas se excluyen del puntaje de coincidencia de este candidato.')}</p>${unknown.filter(i => c.positions && c.positions[i.id] && c.positions[i.id].summary && !/No public position found/i.test(c.positions[i.id].summary)).map(i => `<p><strong>${esc(iLabel(i))}:</strong> ${esc(c.positions[i.id].summary)}${sourcesHtml(c.positions[i.id].sources)}</p>`).join('')}</details>` : ''}
        ${allOther.length ? `<details style="margin-top:12px"><summary>${T(`Positions on issues outside this office's scope (${allOther.length})`, `Posiciones sobre temas fuera del ámbito de este cargo (${allOther.length})`)}</summary><div style="margin-top:8px">${allOther.map(posBlock).join('')}</div></details>` : ''}
      </section>
      <section class="section"><h2>${T('Other issues this candidate has raised', 'Otros temas que este candidato ha planteado')}</h2><div class="card">${otherIssuesHtml(c)}</div></section>
      ${(c.record || []).length ? `<section class="section"><h2>${T('Record: votes, actions and documented facts', 'Historial: votos, acciones y hechos documentados')}</h2><div class="card"><ul>${c.record.map(x => `<li>${esc(x.item)}${sourcesHtml(x.sources)}</li>`).join('')}</ul></div></section>` : ''}
      ${(c.endorsements || []).length ? `<section class="section"><h2>${T('Endorsements (as reported)', 'Respaldos (según se informa)')}</h2><div class="card"><ul>${c.endorsements.map(x => `<li>${esc(x.by)}${sourcesHtml(x.sources)}</li>`).join('')}</ul></div></section>` : ''}
      <div class="btn-row"><a class="btn btn-primary" href="#/match">${T('See how you match with', 'Vea su coincidencia con')} ${esc(c.name.split(' ')[0])} →</a><a class="btn" href="#/race/${esc(r.id)}">${T('Back to race', 'Volver a la contienda')}</a></div>`;
  }

  /* ---------- Match quiz (swipe cards + live leaderboard) ---------- */
  let quizIndex = 0;
  let lbRace = null;
  function viewMatch() {
    const answers = loadAnswers();
    const total = ISSUES.length;
    const answered = Object.values(answers).filter(a => a && a.value != null).length;
    const i = Math.min(quizIndex, total - 1);
    const issue = ISSUES[i];
    const a = answers[issue.id] || {};
    const applies = (issue.levels || []).map(l => ({ federal: 'federal', state: 'state', county: 'county' }[l])).join(', ');
    return `<h1>${T('Match me to the candidates', 'Compárame con los candidatos')}</h1>
      <p class="lead muted">${T('Swipe right to agree, left to disagree (or use the buttons). The leaderboard updates after every answer. Answers stay in your browser only.', 'Deslice a la derecha para estar de acuerdo, a la izquierda para estar en desacuerdo (o use los botones). La tabla se actualiza con cada respuesta. Sus respuestas se quedan solo en su navegador.')}</p>${LANG === 'es' ? ES_NOTE : ''}
      <div class="quiz-progress" aria-hidden="true"><span style="width:${Math.round(100 * answered / total)}%"></span></div>
      <div class="quiz-layout">
        <div>
          <div class="swipe-stage">
            ${i < total - 1 ? '<div class="stack-peek" aria-hidden="true"></div>' : ''}
            <div class="swipe-card" id="swipe-card" tabindex="0" aria-label="${T('Statement', 'Afirmación')} ${i + 1} ${T('of', 'de')} ${total}">
              <div class="swipe-stamp stamp-agree">${T('Agree', 'De acuerdo')}</div><div class="swipe-stamp stamp-disagree">${T('Disagree', 'En desacuerdo')}</div>
              <div class="eyebrow">${i + 1} ${T('of', 'de')} ${total} · ${esc(iLabel(issue))} <span class="muted">· ${T(esc(applies) + ' races', 'contiendas: ' + esc(applies))}</span></div>
              <div class="q-statement">"${esc(iStmt(issue))}"</div>
              <div class="importance"><span class="muted">${T('Matters a lot to me?', '¿Me importa mucho?')}</span>
                <span class="toggle"><button type="button" data-imp="0" class="${!a.important ? 'selected' : ''}">${T('Normal', 'Normal')}</button><button type="button" data-imp="1" class="${a.important ? 'selected' : ''}">${T('Double weight', 'Doble peso')}</button></span>
              </div>
            </div>
          </div>
          <div class="swipe-buttons" role="group" aria-label="${T('Your answer', 'Su respuesta')}">${USER_SCALE.slice().reverse().map(s => `<button type="button" data-answer="${s.v}" class="${a.value === s.v ? 'selected' : ''}">${esc(T(s.label, s.es))}</button>`).join('')}</div>
          <div class="swipe-hint">${T('Drag the card, press ← / → (hold Shift for "strongly"), or tap a button. Space or ↓ skips.', 'Arrastre la tarjeta, pulse ← / → (Shift para "muy"), o toque un botón. Espacio o ↓ salta.')}</div>
          <div class="q-nav">
            <button type="button" class="btn" data-prev="1" ${i === 0 ? 'disabled' : ''}>${T('← Back', '← Atrás')}</button>
            <div><button type="button" class="btn btn-sm" data-skip="1">${T('Skip', 'Saltar')}</button> <a class="btn btn-primary" href="#/match/results">${T('See full results', 'Ver resultados completos')} (${answered})</a></div>
          </div>
          <p class="muted" style="margin-top:12px"><button type="button" class="btn btn-sm" data-reset="1">${T('Clear my answers', 'Borrar mis respuestas')}</button></p>
        </div>
        <aside class="leaderboard card" aria-live="polite">
          <div class="eyebrow">${T('Live leaderboard', 'Tabla en vivo')}</div>
          <select class="lb-race" data-lbrace aria-label="${T('Race to show', 'Contienda a mostrar')}">${lbRaces().map(r => `<option value="${esc(r.id)}" ${(lbRace || lbRaces()[0].id) === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select>
          <div data-lbrows>${leaderboardRows(lbRace || lbRaces()[0].id, answers)}</div>
          <p class="lb-sub" style="margin-top:10px">${T('Scores use only issues that apply to this office and that the candidate has a documented position on. "—" means fewer than three scorable issues so far.', 'Los puntajes usan solo los temas que aplican a este cargo y sobre los que el candidato tiene una posición documentada. "—" significa menos de tres temas puntuables hasta ahora.')}</p>
        </aside>
      </div>`;
  }
  let lbPrevOrder = {};
  function lbRaces() { const list = ballotRaces(loadProfile()).filter(r => (r.candidates || []).some(c => !c.withdrawn)); return list.length ? list : RACES.slice(0, 1); }
  function leaderboardRows(raceId, answers) {
    const r = RACE_BY_ID[raceId];
    const scored = (r.candidates || []).filter(c => !c.withdrawn).map(c => Object.assign({ cand: c }, scoreCandidate(c, r, answers))).sort((a, b) => (b.pct == null || b.used < 3 ? -1 : b.pct) - (a.pct == null || a.used < 3 ? -1 : a.pct));
    const prev = lbPrevOrder[raceId] || [];
    lbPrevOrder[raceId] = scored.map(s => s.cand.id);
    return scored.map((sc, idx) => {
      const pi = prev.indexOf(sc.cand.id);
      const mv = pi === -1 || pi === idx ? '' : pi > idx ? '<span class="lb-move up">▲</span>' : '<span class="lb-move down">▼</span>';
      const ok = sc.pct != null && sc.used >= 3;
      return `<div class="lb-row">${avatar(sc.cand)}<div><div class="lb-name">${esc(sc.cand.name)} <small class="muted">${esc(partyShort(sc.cand.party))}</small>${mv}</div><div class="lb-bar"><span style="width:${ok ? sc.pct : 0}%"></span></div><div class="lb-sub">${T(`${sc.used} of ${sc.answered} answered issues scorable`, `${sc.used} de ${sc.answered} temas respondidos puntuables`)}</div></div><div class="lb-pct">${ok ? sc.pct + '%' : '—'}</div></div>`;
    }).join('');
  }
  function bindMatch(root) {
    const answers = loadAnswers();
    const issue = ISSUES[Math.min(quizIndex, ISSUES.length - 1)];
    const card = root.querySelector('#swipe-card');
    const set = (patch) => { answers[issue.id] = Object.assign({}, answers[issue.id] || {}, patch); saveAnswers(answers); };
    const refreshLb = () => { const rows = root.querySelector('[data-lbrows]'); if (rows) rows.innerHTML = leaderboardRows(lbRace || lbRaces()[0].id, answers); const prog = root.querySelector('.quiz-progress span'); if (prog) prog.style.width = Math.round(100 * Object.values(answers).filter(a => a && a.value != null).length / ISSUES.length) + '%'; };
    const answer = (v, dir) => {
      set({ value: v });
      refreshLb();
      card.classList.add(dir === 'right' ? 'fly-right' : dir === 'left' ? 'fly-left' : 'fly-down');
      setTimeout(advance, 260);
    };
    root.querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => { const v = Number(b.dataset.answer); answer(v, v > 0 ? 'right' : v < 0 ? 'left' : 'down'); }));
    root.querySelectorAll('[data-imp]').forEach(b => b.addEventListener('click', () => { set({ important: b.dataset.imp === '1' }); root.querySelectorAll('[data-imp]').forEach(x => x.classList.toggle('selected', x === b)); refreshLb(); }));
    const skip = root.querySelector('[data-skip]'); if (skip) skip.addEventListener('click', () => answer(null, 'down'));
    const prev = root.querySelector('[data-prev]'); if (prev) prev.addEventListener('click', () => { quizIndex = Math.max(0, quizIndex - 1); render(); });
    const reset = root.querySelector('[data-reset]'); if (reset) reset.addEventListener('click', () => { if (confirm('Clear all of your answers?')) { saveAnswers({}); lbPrevOrder = {}; quizIndex = 0; render(); } });
    const sel = root.querySelector('[data-lbrace]'); if (sel) sel.addEventListener('change', () => { lbRace = sel.value; refreshLb(); });
    function advance() { if (quizIndex >= ISSUES.length - 1) { location.hash = '#/match/results'; } else { quizIndex++; render(); } }
    // drag / swipe
    let startX = 0, startY = 0, dx = 0, dragging = false;
    const stampA = card.querySelector('.stamp-agree'), stampD = card.querySelector('.stamp-disagree');
    const onMove = ev => { if (!dragging) return; const pt = ev.touches ? ev.touches[0] : ev; dx = pt.clientX - startX; const dy = pt.clientY - startY; if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return; card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`; stampA.style.opacity = Math.min(1, Math.max(0, dx / 90)); stampD.style.opacity = Math.min(1, Math.max(0, -dx / 90)); };
    const onEnd = () => { if (!dragging) return; dragging = false; card.classList.remove('dragging'); const strong = Math.abs(dx) > 200; if (dx > 80) { card.style.transform = ''; answer(strong ? 2 : 1, 'right'); } else if (dx < -80) { card.style.transform = ''; answer(strong ? -2 : -1, 'left'); } else { card.style.transform = ''; stampA.style.opacity = 0; stampD.style.opacity = 0; } dx = 0; };
    const onStart = ev => { if (ev.target.closest('button')) return; const pt = ev.touches ? ev.touches[0] : ev; startX = pt.clientX; startY = pt.clientY; dragging = true; card.classList.add('dragging'); };
    card.addEventListener('mousedown', onStart); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onEnd);
    card.addEventListener('touchstart', onStart, { passive: true }); card.addEventListener('touchmove', onMove, { passive: true }); card.addEventListener('touchend', onEnd);
    card.focus({ preventScroll: true });
    card.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') { ev.preventDefault(); answer(ev.shiftKey ? 2 : 1, 'right'); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); answer(ev.shiftKey ? -2 : -1, 'left'); } else if (ev.key === ' ' || ev.key === 'ArrowDown') { ev.preventDefault(); answer(null, 'down'); } else if (ev.key === '0') { answer(0, 'down'); } });
  }

  function viewResults() {
    const answers = loadAnswers();
    const answered = Object.values(answers).filter(a => a && a.value != null).length;
    if (!answered) return `<h1>${T('Your matches', 'Sus coincidencias')}</h1><p class="notice">${T('You have not answered any statements yet.', 'Todavía no ha respondido ninguna afirmación.')}</p><div class="btn-row"><a class="btn btn-primary" href="#/match">${T('Start the questionnaire →', 'Comenzar el cuestionario →')}</a></div>`;
    const prof = loadProfile();
    const scope = ballotRaces(prof).filter(r => (r.candidates || []).some(c => !c.withdrawn));
    const sections = scope.map(r => {
      const scored = (r.candidates || []).filter(c => !c.withdrawn).map(c => Object.assign({ cand: c }, scoreCandidate(c, r, answers))).sort((a, b) => (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct));
      const answeredHere = issuesForLevel(r.level).filter(i => answers[i.id] && answers[i.id].value != null).length;
      return `<div class="card">
        <div class="eyebrow">${esc(r.office_group)}</div>
        <h3><a href="#/race/${esc(r.id)}">${esc(r.title)}</a></h3>
        ${scored.map(s => `<div class="match-row">
          ${avatar(s.cand)}
          <div>
            <div><a href="#/candidate/${esc(s.cand.id)}"><strong>${esc(s.cand.name)}</strong></a> ${partyTag(s.cand)}</div>
            ${s.pct == null || s.used < 3 ? `<div class="match-detail">${T(`Not enough documented positions to score (${s.used} of the ${answeredHere} statements you answered for this office).`, `No hay suficientes posiciones documentadas para puntuar (${s.used} de las ${answeredHere} afirmaciones que respondió para este cargo).`)}</div>` : `<div class="match-bar"><span style="width:${s.pct}%"></span></div><div class="match-detail">${T(`Based on ${s.used} of ${answeredHere} statements you answered that apply to this office.`, `Basado en ${s.used} de las ${answeredHere} afirmaciones que respondió y que aplican a este cargo.`)}${s.used < answeredHere ? T(' Issues without a documented position are left out.', ' Se omiten los temas sin posición documentada.') : ''}</div>
            <div class="pill-row">${s.agree.slice(0, 6).map(i => `<span class="pill agree">✓ ${esc(iLabel(i))}</span>`).join('')}${s.disagree.slice(0, 6).map(i => `<span class="pill disagree">✕ ${esc(iLabel(i))}</span>`).join('')}</div>`}
          </div>
          <div class="match-pct">${s.pct == null || s.used < 3 ? '—' : s.pct + '%'}</div>
        </div>`).join('')}
      </div>`;
    });
    return `<h1>${T('Your matches', 'Sus coincidencias')}</h1>
      <p class="lead muted">${T("Higher percentages mean a candidate's documented positions are closer to your answers on the issues that apply to that office. Percentages are only as good as the public record: a candidate who has said little will match on fewer issues, and that is shown under each name. Read the full profiles before deciding.", 'Un porcentaje más alto significa que las posiciones documentadas del candidato están más cerca de sus respuestas en los temas que aplican a ese cargo. Los porcentajes valen tanto como el registro público: un candidato que ha dicho poco coincidirá en menos temas, y eso se muestra bajo cada nombre. Lea los perfiles completos antes de decidir.')}</p>${LANG === 'es' ? ES_NOTE : ''}
      ${prof ? `<p class="muted"><small>${T('Scored for', 'Puntuado para')} ${esc(profileSummary(prof))}. <a href="#/where">${T('Change where you vote', 'Cambiar dónde vota')}</a></small></p>` : `<p class="notice">${T('Showing statewide races only.', 'Mostrando solo las contiendas estatales.')} <a href="#/where">${T('Enter where you vote', 'Ingrese dónde vota')}</a> ${T('to score your congressional, legislative and county races too.', 'para puntuar también sus contiendas del Congreso, la Legislatura y el condado.')}</p>`}
      <div class="btn-row"><a class="btn btn-primary" href="#/match/cheatsheet">${T('Printable ballot cheat sheet →', 'Guía rápida imprimible →')}</a><a class="btn" href="#/match">${T('Change my answers', 'Cambiar mis respuestas')}</a><button type="button" class="btn" data-print="1">${T('Print this page', 'Imprimir esta página')}</button></div>
      <section class="section"><h2>${T('You on the map', 'Usted en el mapa')}</h2><p class="muted">${T('Your star is placed from your answers using the same formula as the candidates. Use the buttons to show one race at a time.', 'Su estrella se ubica a partir de sus respuestas con la misma fórmula que los candidatos. Use los botones para ver una contienda a la vez.')}</p>
        <div class="map-filters" data-mapfilter>${['all'].concat(scope.map(r => r.id)).map(id => `<button type="button" data-race="${esc(id)}" class="${id === 'all' ? 'selected' : ''}">${esc(id === 'all' ? T('All my races', 'Todas mis contiendas') : RACE_BY_ID[id].title)}</button>`).join('')}</div>
        <div class="card" data-mapcard>${landscapeMap(scope.flatMap(r => r.candidates || []).filter(c => !c.withdrawn), { you: userPoint(answers) })}</div>
      </section>
      <div class="stack section">${sections.join('')}</div>
      <p class="muted section">${T('How the score works: for each statement you answered, the distance between your answer and the candidate\'s coded stance (both on a 5-point scale) is turned into agreement from 0% to 100%, then averaged with your "matters a lot" statements counting double. Only issues relevant to the office and with a documented candidate position are included.', 'Cómo funciona el puntaje: para cada afirmación que respondió, la distancia entre su respuesta y la posición codificada del candidato (ambas en una escala de 5 puntos) se convierte en un acuerdo de 0% a 100% y luego se promedia, contando doble las afirmaciones que marcó como "me importa mucho". Solo se incluyen los temas relevantes para el cargo y con una posición documentada del candidato.')} <a href="#/about">${T('Full methodology →', 'Metodología completa →')}</a></p>`;
  }


  /* ---------- Printable cheat sheet ---------- */
  function viewCheatsheet() {
    const answers = loadAnswers();
    const prof = loadProfile();
    const races = ballotRaces(prof);
    const answered = Object.values(answers).filter(a => a && a.value != null).length;
    const code = countyCodeFor(prof && prof.county);
    const sw = window.STATEWIDE_DATA; const swc = code && sw ? sw.counties[code] : null;
    const ev = prof && prof.county && COUNTY_INFO[prof.county] && COUNTY_INFO[prof.county].early_voting;
    const box = '<span class="cs-box" aria-hidden="true"></span>';
    const ok = s => s.pct != null && s.used >= 3;
    const contest = r => {
      const cands = (r.candidates || []).filter(c => !c.withdrawn);
      const scored = cands.map(c => Object.assign({ cand: c }, scoreCandidate(c, r, answers)));
      const scorable = scored.filter(ok).sort((a, b) => b.pct - a.pct);
      const best = scorable.length > 1 && scorable[0].pct > scorable[1].pct ? scorable[0] : null;
      const rows = scored.map(s => `<li>${box}<span class="cs-name">${esc(s.cand.name)}${s.cand.running_mate ? ` <small class="muted">/ ${esc(String(s.cand.running_mate).replace(/\s*\(.*$/, ''))}</small>` : ''}</span> <small class="muted">${esc(partyShort(s.cand.party))}</small>${answered ? (ok(s) ? `<span class="cs-pct">${s.pct}%</span>` : '<span class="cs-pct muted">—</span>') : ''}${best && s === best ? `<span class="cs-best">${T('Best match', 'Mejor coincidencia')}</span>` : ''}</li>`).join('');
      return `<div class="cs-race"><h3>${esc(r.title)}</h3>${cands.length ? `<ul class="cs-list">${rows}</ul>` : `<p class="muted small">${T('No candidate data yet; see your sample ballot.', 'Aún no hay datos de candidatos; vea su boleta de muestra.')}</p>`}</div>`;
    };
    const yesno = (title, sub) => `<div class="cs-race"><h3>${esc(title)}</h3>${sub ? `<p class="muted small" style="margin:0 0 4px">${esc(sub)}</p>` : ''}<ul class="cs-list cs-yesno"><li>${box}${T('Yes', 'Sí')}</li><li>${box}No</li></ul></div>`;
    const contests = races.filter(r => r.kind !== 'measure'); const measures = races.filter(r => r.kind === 'measure');
    const dca = prof ? dcaFor(prof.county) : null;
    const judges = sw ? [].concat((sw.races.supreme_court || []).map(j => ({ name: j.name, court: T('Florida Supreme Court', 'Corte Suprema de Florida') })), dca && sw.races.dca_judges[String(dca)] ? sw.races.dca_judges[String(dca)].map(j => ({ name: j.name, court: (FL.dca_names && FL.dca_names[dca]) || `District Court of Appeal ${dca}` })) : []) : [];
    const intro = answered
      ? T(`Match percentages come from your ${answered} answers on flvotersguide.org compared with each candidate's documented positions; "—" means fewer than three scorable issues. Tick your choices and take this sheet to the polls or use it with your mail ballot. It is a worksheet, not an endorsement.`, `Los porcentajes de coincidencia provienen de sus ${answered} respuestas en flvotersguide.org comparadas con las posiciones documentadas de cada candidato; "—" significa menos de tres temas puntuables. Marque sus opciones y lleve esta hoja a las urnas o úsela con su boleta por correo. Es una hoja de trabajo, no un respaldo.`)
      : T('You have not answered the questionnaire, so no match percentages are shown. Tick your choices and take this sheet to the polls or use it with your mail ballot.', 'No ha respondido el cuestionario, así que no se muestran porcentajes de coincidencia. Marque sus opciones y lleve esta hoja a las urnas o úsela con su boleta por correo.');
    return `<div class="cheatsheet">
      <div class="cs-head"><div><div class="eyebrow">flvotersguide.org</div><h1>${T('My ballot cheat sheet', 'Mi guía rápida para la boleta')}</h1><p class="muted" style="margin:4px 0 0">${prof ? esc(profileSummary(prof)) : T('Statewide races only (no address entered)', 'Solo contiendas estatales (no ingresó una dirección)')} · ${T('General Election, Tuesday, November 3, 2026', 'Elección General, martes 3 de noviembre de 2026')}</p></div>
      <div class="btn-row no-print" style="margin:0"><button type="button" class="btn btn-primary" data-print="1">${T('Print or save as PDF', 'Imprimir o guardar como PDF')}</button>${answered ? `<a class="btn" href="#/match/results">${T('Back to results', 'Volver a los resultados')}</a>` : `<a class="btn" href="#/match">${T('Take the quiz first', 'Haga el cuestionario primero')}</a>`}${!prof ? `<a class="btn" href="#/where">${T('Enter where you vote', 'Ingrese dónde vota')}</a>` : ''}</div></div>
      <p class="muted small">${intro}</p>
      ${contests.length ? `<h2>${T('Candidates', 'Candidatos')}</h2><div class="cs-grid">${contests.map(contest).join('')}</div>` : ''}
      <h2>${T('Constitutional amendments (each needs 60% Yes)', 'Enmiendas constitucionales (cada una necesita 60% de Sí)')}</h2><div class="cs-grid">${(DATA.amendments || []).map(a => yesno(`${T('Amendment', 'Enmienda')} ${a.number}: ${a.title}`)).join('')}</div>
      ${measures.length ? `<h2>${T('Local questions', 'Preguntas locales')}</h2><div class="cs-grid">${measures.map(r => yesno(r.title)).join('')}</div>` : ''}
      ${judges.length ? `<h2>${T('Judicial retention (shall the judge be retained?)', 'Retención de jueces (¿debe permanecer en el cargo?)')}</h2><div class="cs-grid">${judges.map(j => yesno(j.name, j.court)).join('')}</div>` : ''}
      <div class="cs-foot"><h2>${T('Voting details', 'Detalles de la votación')}</h2><ul>
        <li>${T('Election Day: Tuesday, Nov. 3, 7 a.m.–7 p.m. at your assigned precinct. Bring photo and signature ID.', 'Día de la elección: martes 3 de nov., 7 a.m.–7 p.m. en su recinto asignado. Lleve identificación con foto y firma.')}</li>
        <li>${T('Mail ballots must arrive at the Supervisor of Elections by 7 p.m. on Election Day; postmarks do not count.', 'Las boletas por correo deben llegar al Supervisor de Elecciones antes de las 7 p.m. del día de la elección; el matasellos no cuenta.')}</li>
        ${ev && ev.dates ? `<li>${T('Early voting', 'Votación anticipada')} (${esc(prof.county)}): ${esc(ev.dates)}${ev.hours ? `, ${esc(ev.hours)}` : ''}${ev.sites_url ? ` · ${esc(ev.sites_url)}` : ''}</li>` : `<li>${T('Early voting: at least Sat. Oct. 24 through Sat. Oct. 31; your county sets the exact dates, hours and sites.', 'Votación anticipada: al menos del sáb. 24 al sáb. 31 de oct.; su condado fija las fechas, horarios y sitios exactos.')}</li>`}
        ${swc ? `<li>${esc(prof.county)} ${T('County Supervisor of Elections', 'Supervisor de Elecciones del condado')}: ${esc(swc.supervisor.phone || '')}${swc.supervisor.website ? ` · ${esc(swc.supervisor.website)}` : ''}</li>` : ''}
        <li>${T('Full candidate profiles and every source: flvotersguide.org', 'Perfiles completos de los candidatos y todas las fuentes: flvotersguide.org')}</li>
      </ul></div>
    </div>`;
  }

  /* ---------- Amendments / judges / vote / about ---------- */
  function viewAmendments() {
    const list = DATA.amendments || [];
    return `<h1>${T('Constitutional amendments', 'Enmiendas constitucionales')}</h1>
      <p class="lead muted">${T('Statewide questions on every Florida ballot. Each needs at least 60% "Yes" to pass. Arguments are attributed to the organizations and officials making them; this guide takes no position.', 'Preguntas estatales en todas las boletas de Florida. Cada una necesita al menos 60% de votos "Sí" para aprobarse. Los argumentos se atribuyen a las organizaciones y funcionarios que los plantean; esta guía no toma posición.')}</p>${LANG === 'es' ? ES_NOTE : ''}
      ${list.length ? list.map(a => `<div class="card" id="amend-${esc(a.number)}">
        <div class="eyebrow">${T('Amendment', 'Enmienda')} ${esc(a.number)}${a.sponsor ? ` · ${esc(a.sponsor)}` : ''}</div>
        <h2>${esc(a.title)}</h2>
        ${a.original_title ? `<p class="muted"><small>${T('Originally titled', 'Título original:')} "${esc(a.original_title)}". ${a.ballot_language_litigation ? esc(a.ballot_language_litigation.summary || '') : ''}${a.ballot_language_litigation && a.ballot_language_litigation.sources ? ' ' + a.ballot_language_litigation.sources.map(u => `<a href="${esc(typeof u === 'string' ? u : u.url)}" target="_blank" rel="noopener">${esc(hostOf(typeof u === 'string' ? u : u.url))}</a>`).join(' · ') : ''}</small></p>` : ''}
        ${a.ballot_summary ? `<details open><summary>${T('Official ballot summary', 'Resumen oficial de la boleta')}</summary><p style="margin-top:8px">${esc(a.ballot_summary)}</p>${a.ballot_summary_note ? `<p class="muted"><small>${esc(a.ballot_summary_note)}</small></p>` : ''}</details>` : ''}
        <div class="grid grid-2" style="margin-top:14px">
          <div><h3>${T('A "Yes" vote means', 'Un voto "Sí" significa')}</h3><p>${esc(a.what_yes_means || '')}</p></div>
          <div><h3>${T('A "No" vote means', 'Un voto "No" significa')}</h3><p>${esc(a.what_no_means || '')}</p></div>
        </div>
        ${a.fiscal_impact ? `<h3>${T('Estimated fiscal impact', 'Impacto fiscal estimado')}</h3><p>${esc(a.fiscal_impact)}${sourcesHtml(a.fiscal_impact_sources)}</p>` : ''}
        ${(a.developments || []).length ? `<h3>${T('Recent developments', 'Novedades recientes')}</h3><ul>${a.developments.slice().reverse().map(x => `<li><small class="muted">${esc(x.date || '')}</small> ${esc(x.item)}${sourcesHtml(x.sources)}</li>`).join('')}</ul>` : ''}
        ${(a.neutral_analyses || []).length ? `<h3>${T('Independent analyses', 'Análisis independientes')}</h3><ul>${a.neutral_analyses.map(n => `<li>${typeof n === 'string' ? esc(n) : `<strong>${esc(n.who || n.title || '')}</strong>${n.summary ? ': ' + esc(n.summary) : ''}${sourcesHtml(n.sources || (n.url ? [{url: n.url, title: n.title}] : []))}`}</li>`).join('')}</ul>` : ''}
        <div class="grid grid-2">
          <div><h3>${T('Who supports it, and why', 'Quién la apoya, y por qué')}</h3>${(a.supporters || []).length ? `<ul>${a.supporters.map(s => `<li><strong>${esc(s.who)}</strong>: ${esc(s.argument)}${sourcesHtml(s.sources)}</li>`).join('')}</ul>` : `<p class="empty">${T('No organized support found.', 'No se encontró apoyo organizado.')}</p>`}</div>
          <div><h3>${T('Who opposes it, and why', 'Quién se opone, y por qué')}</h3>${(a.opponents || []).length ? `<ul>${a.opponents.map(s => `<li><strong>${esc(s.who)}</strong>: ${esc(s.argument)}${sourcesHtml(s.sources)}</li>`).join('')}</ul>` : `<p class="empty">${T('No organized opposition found.', 'No se encontró oposición organizada.')}</p>`}</div>
        </div>
        ${sourcesHtml(a.sources)}
      </div>`).join('') : `<p class="empty">${T('Amendment data pending.', 'Datos de enmiendas pendientes.')}</p>`}`;
  }

  function viewJudges() {
    const j = DATA.judicial || {};
    const prof = loadProfile();
    const dca = dcaFor(prof && prof.county);
    const byDist = j.dca_judges_on_2026_ballot_by_district || {};
    const ordinal = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
    const judges = (j.judges || []);
    const supreme = judges.filter(x => /Supreme/i.test(x.court || ''));
    const fifth = judges.filter(x => /Fifth/i.test(x.court || ''));
    const judgeCard = x => `<div class="card cand-card">${avatar(x, 'lg')}<div><h3>${esc(x.name)}</h3><div class="cand-meta"><span class="tag tag-level">${esc(x.court || '')}</span>${x.appointed_by ? `<span class="tag">${T('Appointed by', 'Nombrado por')} ${esc(x.appointed_by)}${x.appointed_year ? ` (${esc(x.appointed_year)})` : ''}</span>` : ''}</div><p>${esc(x.background || '')}</p>${x.notable ? `<p><strong>${T('Notable:', 'Destacado:')}</strong> ${esc(x.notable)}</p>` : ''}${x.bar_poll ? `<p><strong>${T('Florida Bar retention poll:', 'Encuesta de retención del Colegio de Abogados de Florida:')}</strong> ${esc(x.bar_poll)}</p>` : ''}${sourcesHtml(x.sources)}</div></div>`;
    const nameOnly = (names, label) => `<div class="card"><h3>${esc(label)}</h3><p class="muted">${T('Judges standing for retention, as listed by The Florida Bar. Backgrounds for these judges have not been researched yet; The Florida Bar publishes biographies for every judge on the ballot.', 'Jueces sujetos a retención, según la lista del Colegio de Abogados de Florida. Los antecedentes de estos jueces aún no se han investigado; el Colegio de Abogados publica biografías de cada juez en la boleta.')}</p><ul>${names.filter(n => !/^\(/.test(n)).map(n => `<li>${esc(n)}</li>`).join('')}</ul>${sourcesHtml(byDist.source ? [{ title: 'Florida Bar News: judges standing for merit retention in 2026', url: byDist.source }] : [])}</div>`;
    const dcaBlock = d => { const label = (FL.dca_names && FL.dca_names[d]) || `${ordinal[d]} District Court of Appeal`; if (d === 5) return `<h2 class="section">${esc(label)}</h2>${j.list_complete === false ? `<p class="notice notice-warn">${T('This list may be incomplete: the full 2026 Fifth District roster could not be confirmed from The Florida Bar during the last data review. Check your sample ballot for the exact names.', 'Esta lista puede estar incompleta: la lista completa del Quinto Distrito para 2026 no pudo confirmarse con el Colegio de Abogados de Florida en la última revisión de datos. Consulte su boleta de muestra para ver los nombres exactos.')}</p>` : ''}<div class="stack">${fifth.map(judgeCard).join('')}</div>`; const names = byDist[`${ordinal[d]} DCA`] || []; return `<h2 class="section">${esc(label)}</h2>${names.length ? nameOnly(names, T('On the ballot in this district', 'En la boleta de este distrito')) : `<p class="muted">${T('No appellate judges from this district are on the 2026 ballot, according to The Florida Bar.', 'Ningún juez de apelación de este distrito está en la boleta de 2026, según el Colegio de Abogados de Florida.')}</p>`}`; };
    return `<h1>${T('Judicial merit retention', 'Retención de jueces por mérito')}</h1>
      <p class="lead muted">${esc(T(j.how_it_works || j.how_merit_retention_works || 'Florida Supreme Court justices and District Court of Appeal judges do not run against opponents. Voters answer "Shall Justice/Judge X be retained in office?" A majority Yes gives a new six-year term; a majority No creates a vacancy the governor fills.', 'Los magistrados de la Corte Suprema de Florida y los jueces de los Tribunales de Apelación de Distrito no compiten contra oponentes. Los votantes responden "¿Debe el juez X permanecer en su cargo?". Una mayoría de Sí otorga un nuevo mandato de seis años; una mayoría de No crea una vacante que el gobernador cubre.'))}</p>${LANG === 'es' ? ES_NOTE : ''}
      ${sourcesHtml(j.sources || j.how_it_works_sources)}
      ${addressPanel(!!prof)}
      ${j.ballot_context ? `<p class="notice">${esc(j.ballot_context)}</p>` : ''}
      <h2 class="section">${T('Florida Supreme Court (every Florida ballot)', 'Corte Suprema de Florida (en todas las boletas de Florida)')}</h2><div class="stack">${supreme.map(judgeCard).join('')}</div>
      ${dca ? dcaBlock(dca) : `<h2 class="section">${T('District Courts of Appeal', 'Tribunales de Apelación de Distrito')}</h2><p class="muted">${T('Which appellate judges appear on your ballot depends on your county. Enter your address above to see yours, or expand a district below.', 'Los jueces de apelación que aparecen en su boleta dependen de su condado. Ingrese su dirección arriba para ver los suyos, o abra un distrito abajo.')}</p>${[1,2,3,4,5,6].map(d => `<details style="margin-top:8px"><summary>${esc((FL.dca_names && FL.dca_names[d]) || ordinal[d] + ' DCA')}</summary>${dcaBlock(d)}</details>`).join('')}`}
      ${j.not_on_2026_ballot_note ? `<p class="muted section"><small>${esc(j.not_on_2026_ballot_note)}</small>${sourcesHtml(j.not_on_2026_sources)}</p>` : ''}`;
  }

  function viewVote() {
    const v = DATA.voting_info || {};
    const soe = v.supervisor_of_elections || {};
    const row = (k, val) => val ? `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>` : '';
    const prof = loadProfile();
    const county = prof && prof.county;
    if (!county || !/^sumter$/i.test(county)) {
      const ci = county ? (COUNTY_INFO[county] || {}) : {};
      const code = countyCodeFor(county);
      const sw = window.STATEWIDE_DATA; const soeSw = code && sw ? sw.counties[code].supervisor : null;
      return `<h1>${county ? T(`How and where to vote in ${esc(county)} County`, `Cómo y dónde votar en el condado de ${esc(county)}`) : T('How and where to vote in Florida', 'Cómo y dónde votar en Florida')}</h1>${county ? addressPanel(true) : addressPanel(false)}
        <div class="card"><dl class="kv">${row(T('Election Day', 'Día de la elección'), T('Tuesday, November 3, 2026, 7 a.m. to 7 p.m. at your assigned precinct', 'Martes 3 de noviembre de 2026, de 7 a.m. a 7 p.m. en su recinto asignado'))}${row(T('Register / update party by', 'Regístrese o cambie de partido antes del'), T('Monday, October 5, 2026', 'Lunes 5 de octubre de 2026'))}${row(T('Request a mail ballot by', 'Solicite una boleta por correo antes del'), T('Thursday, October 22, 2026, 5 p.m.', 'Jueves 22 de octubre de 2026, 5 p.m.'))}${row(T('Mail ballot must arrive by', 'La boleta por correo debe llegar antes de'), T('7 p.m. on Election Day (postmarks do not count); drop boxes at early-voting sites and the Supervisor\'s office', 'las 7 p.m. del día de la elección (el matasellos no cuenta); buzones en los sitios de votación anticipada y en la oficina del Supervisor'))}${row(T('Early voting', 'Votación anticipada'), T('At least Saturday, Oct. 24 through Saturday, Oct. 31 (counties may add Oct. 19–23 and Nov. 1); dates, hours and sites are set by your county', 'Al menos del sábado 24 de octubre al sábado 31 de octubre (los condados pueden añadir del 19 al 23 de octubre y el 1 de noviembre); las fechas, horarios y sitios los fija su condado'))}${row(T('ID required', 'Identificación requerida'), v.id_requirements)}</dl>
        <div class="btn-row">${ci.soe_url || (soeSw && soeSw.website) ? `<a class="btn btn-primary" href="${esc(ci.soe_url || soeSw.website)}" target="_blank" rel="noopener">${T(`${esc(county)} County Supervisor of Elections ↗`, `Supervisor de Elecciones del condado de ${esc(county)} ↗`)}</a>` : `<a class="btn btn-primary" href="#/counties">${T("Find your county's Supervisor of Elections", 'Encuentre el Supervisor de Elecciones de su condado')}</a>`}${soeSw ? `<span class="muted" style="align-self:center">${esc(soeSw.supervisor)} · ${esc(soeSw.phone)}</span>` : ''}<a class="btn" href="https://registration.elections.myflorida.com/CheckVoterStatus" target="_blank" rel="noopener">${T('Check registration &amp; precinct ↗', 'Verificar registro y recinto ↗')}</a><a class="btn" href="#/match/cheatsheet">${T('Printable ballot cheat sheet', 'Guía rápida imprimible')}</a><a class="btn" href="https://registertovoteflorida.gov/" target="_blank" rel="noopener">${T('Register ↗', 'Registrarse ↗')}</a></div>
        ${ci.notes ? `<p class="muted">${esc(ci.notes)}</p>` : ''}</div>
        <p class="notice notice-warn">${T('Statewide deadlines above come from Florida law. Early-voting days, hours and locations are set by each county: confirm them with your Supervisor of Elections.', 'Los plazos estatales anteriores provienen de la ley de Florida. Los días, horarios y lugares de votación anticipada los fija cada condado: confírmelos con su Supervisor de Elecciones.')}</p>`;
    }
    return `<h1>${T('How and where to vote in Sumter County', 'Cómo y dónde votar en el condado de Sumter')}</h1>${addressPanel(!!prof)}
      <div class="card">
        <dl class="kv">
          ${row(T('Election Day', 'Día de la elección'), v.election_date)}${row(T('Polls open', 'Horario de votación'), v.election_day_hours)}${row(T('Register / update party by', 'Regístrese o cambie de partido antes del'), v.registration_deadline)}
          ${row(T('Request a mail ballot by', 'Solicite una boleta por correo antes del'), v.vote_by_mail_request_deadline)}${row(T('Mail ballot must arrive by', 'La boleta por correo debe llegar antes de'), v.vote_by_mail_return_deadline)}
          ${row(T('Early voting', 'Votación anticipada'), v.early_voting_dates)}${row(T('Early voting hours', 'Horario de votación anticipada'), v.early_voting_hours)}${row(T('ID required', 'Identificación requerida'), v.id_requirements)}
        </dl>
        <div class="btn-row">
          ${v.sample_ballot_url ? `<a class="btn btn-primary" href="${esc(v.sample_ballot_url)}" target="_blank" rel="noopener">${T('My sample ballot ↗', 'Mi boleta de muestra ↗')}</a>` : ''}
          ${v.precinct_lookup_url ? `<a class="btn" href="${esc(v.precinct_lookup_url)}" target="_blank" rel="noopener">${T('Find my precinct ↗', 'Buscar mi recinto ↗')}</a>` : ''}
          <a class="btn" href="https://registertovoteflorida.gov/" target="_blank" rel="noopener">${T('Register / check registration ↗', 'Registrarse / verificar registro ↗')}</a>
        </div>
      </div>
      ${(v.early_voting_locations || []).length ? `<section class="section"><h2>${T('Early voting locations', 'Lugares de votación anticipada')}</h2><div class="card"><ul>${v.early_voting_locations.map(l => `<li><strong>${esc(l.name)}</strong>${l.address ? ` — ${esc(l.address)}` : ''}</li>`).join('')}</ul></div></section>` : ''}
      <section class="section"><h2>${T('Supervisor of Elections', 'Supervisor de Elecciones')}</h2><div class="card"><dl class="kv">${row(T('Office', 'Oficina'), soe.name)}${row(T('Phone', 'Teléfono'), soe.phone)}${row(T('Address', 'Dirección'), soe.address)}</dl>${soe.website ? `<p><a href="${esc(soe.website)}" target="_blank" rel="noopener">${esc(soe.website)} ↗</a></p>` : ''}${sourcesHtml(v.sources)}</div></section>
      ${(v.unverified || []).length ? `<details class="section"><summary>${T('Items we could not confirm on the county website', 'Datos que no pudimos confirmar en el sitio del condado')}</summary><ul style="margin-top:8px">${v.unverified.map(u => `<li>${esc(typeof u === 'string' ? u : (u.item || u.note || JSON.stringify(u)))}</li>`).join('')}</ul></details>` : ''}
      <p class="notice notice-warn">${T('Dates and locations should be confirmed with the Supervisor of Elections before you vote; they are the official source.', 'Confirme las fechas y los lugares con el Supervisor de Elecciones antes de votar; es la fuente oficial.')}</p>`;
  }

  function viewAbout() {
    return `<h1>${T('Methodology and neutrality rules', 'Metodología y reglas de neutralidad')}</h1>${LANG === 'es' ? '<p class="notice">La metodología completa está disponible solo en inglés por ahora.</p>' : ''}
      <div class="card stack">
        <div><h2>${T('What this guide is', 'Qué es esta guía')}</h2><p>An independent voter guide for Florida's November 3, 2026 general election. It is not affiliated with any party, candidate, committee or government office, and it does not endorse anyone.</p></div>
        <div><h2>${T('Sourcing rules', 'Reglas sobre las fuentes')}</h2><ul>
          <li>Every factual claim links to its source: candidate websites and questionnaires, official government records (votes, bills, court filings, agency actions), campaign-finance filings, or reporting from established news outlets.</li>
          <li>Positions are described in the candidate's own words wherever possible. Opinion columns and attack ads are not used as evidence of what a candidate believes.</li>
          <li>Loaded labels are avoided. A position is described by what it is, not by how supporters or opponents characterize it.</li>
          <li>Both accomplishments and criticisms of incumbents appear only as documented facts (a vote, an action, a court ruling, a published fact-check), never as characterizations.</li>
        </ul></div>
        <div><h2>${T('How positions are coded', 'Cómo se codifican las posiciones')}</h2><p>Each of the ${ISSUES.length} statements below is rated by voters on a five-point scale. Candidates are coded on the same scale (+2 strongly agrees through −2 strongly disagrees) from explicit statements ("stated") or from votes and official actions ("record"). When neither exists, the position is <strong>null / "No public position found"</strong>. Nothing is inferred from party label. Unknown positions are excluded from that candidate's match score and are listed openly on the profile, so a candidate with a thin public record shows a smaller evidence base rather than a fake score.</p>
        <ul>${ISSUES.map(i => `<li><strong>${esc(i.label)}:</strong> "${esc(i.statement)}" <small class="muted">(${(i.levels || []).join(', ')})</small></li>`).join('')}</ul></div>
        <div><h2>${T('The map and the heat strip', 'El mapa y la franja de calor')}</h2><p>The "landscape map" places each candidate by the average of their coded stances on two fixed groups of statements (economic and social/legal), listed under every map. It is a summary of the same documented positions, not a separate judgment, and a candidate with fewer than three documented statements on an axis is shown in a tray instead of being placed. The colored strip above each comparison table shows how far apart the candidates are on each issue, using a single color that darkens as the gap widens; hatched cells mean fewer than two candidates have a documented position.</p></div>
        <div><h2>${T('How the match score works', 'Cómo funciona el puntaje de coincidencia')}</h2><p>For each statement you answered, agreement = 1 − |your answer − candidate stance| ÷ 4. Scores are averaged over the statements that apply to that office and for which the candidate has a documented position, with statements you mark "matters a lot" counted twice. A candidate needs at least three scorable statements to receive a percentage. Answers are stored only in your browser.</p></div>
        <div><h2>${T('Which offices use which issues', 'Qué cargos usan qué temas')}</h2><p>Federal races (U.S. Senate, U.S. House) are scored on federal issues such as Social Security, tariffs and foreign aid. State races (Governor, Cabinet, Florida House) are scored on state issues such as property taxes, insurance and school choice. County races are scored on growth, property taxes, public safety, housing and the environment. Positions a candidate has stated on issues outside their office's scope are still shown on the profile, in a separate section.</p></div>
        <div><h2>${T('Coverage across Florida', 'Cobertura en Florida')}</h2><p>${(() => { const by = {}; RACES.forEach(r => { const k = r.jurisdiction && r.jurisdiction.type; const cov = r.coverage || 'roster'; by[k] = by[k] || {}; by[k][cov] = (by[k][cov] || 0) + 1; }); const label = { statewide: 'Statewide offices', cd: 'U.S. House districts', sd: 'Florida Senate districts', hd: 'Florida House districts', county: 'County and local contests' }; return Object.keys(label).filter(k => by[k]).map(k => `<strong>${label[k]}:</strong> ${Object.entries(by[k]).map(([c, n]) => `${n} ${c === 'full' ? 'fully researched' : c === 'partial' ? 'partly researched' : c === 'roster' ? 'candidate list only' : 'no data'}`).join(', ')}`).join('<br>'); })()}</p><p class="muted">Sumter County's races carry the deepest research because the guide started there. Elsewhere the candidate lists are verified from primary results and qualifying reports, and position research is added as time allows. Florida House districts not listed in this guide have not been researched yet; your county Supervisor of Elections sample ballot is the authoritative list.</p></div>
        <div><h2>${T('Limitations', 'Limitaciones')}</h2><ul>
          <li>Information reflects what was publicly available as of the "last reviewed" date in the footer. Candidates change positions and new reporting appears; check the sources for anything that matters to you.</li>
          <li>Photos are official portraits or campaign images loaded from their original public locations; if one fails to load, initials are shown instead.</li>
          <li>Position research is deepest for the statewide races and for the races on the Sumter County ballot, where the guide began; elsewhere the guide shows verified candidate lists and adds positions as research allows. Seats decided in the August primary or filled without opposition are marked as not on the November ballot.</li>
        </ul></div>
      </div>`;
  }

  /* ---------- All Florida counties (official line-ups from the Division of Elections) ---------- */
  const SW = window.STATEWIDE_DATA || null;
  const COUNTY_KEY = 'flguide.county';
  function loadCounty() { return ''; }
  function saveCounty() { /* the county choice is never stored; the URL carries it */ }
  function countyList() { return SW ? Object.values(SW.counties).sort((a, b) => a.name.localeCompare(b.name)) : []; }
  function countyPicker(selected) {
    if (!SW) return '';
    return `<label class="county-picker"><span class="eyebrow">${T('Choose your county to see your ballot', 'Elija su condado para ver su boleta')}</span>
      <select data-county-picker aria-label="${T('Choose your Florida county', 'Elija su condado de Florida')}">
        <option value="">${T('Select a county…', 'Seleccione un condado…')}</option>
        ${countyList().map(c => `<option value="${esc(c.code)}"${c.code === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select></label>`;
  }
  function bindCountyPicker(root) {
    root.querySelectorAll('[data-county-picker]').forEach(sel => sel.addEventListener('change', () => { if (sel.value) { saveCounty(sel.value); location.hash = '#/county/' + sel.value; } }));
  }
  function swParty(c) { return `<span class="tag tag-party ${partyClass(c.party_label)}">${esc(c.party_label || c.party)}</span>`; }
  function swCandList(list, opts) {
    opts = opts || {};
    if (!list || !list.length) return `<p class="empty">${T('No candidate listed.', 'Ningún candidato en la lista.')}</p>`;
    const unopposed = list.length === 1 && list[0].status === 'UNO';
    if (unopposed) return `<p><strong>${esc(list[0].name)}</strong> ${swParty(list[0])} <span class="tag">${T('Elected without opposition — no vote held', 'Electo sin oposición: no hay votación')}</span></p>`;
    const printed = list.filter(c => c.party !== 'WRI'); const wri = list.filter(c => c.party === 'WRI');
    return `<ul class="sw-cands">${printed.map(c => `<li><strong>${esc(c.name)}</strong> ${swParty(c)}${c.status === 'UNO' ? ` <span class="tag">${T('Unopposed', 'Sin oposición')}</span>` : ''}${opts.seatLabel && c.seat ? ` <span class="muted">${esc(opts.seatLabel)} ${esc(c.seat)}</span>` : ''}</li>`).join('')}${wri.length ? `<li><em>Write-in line</em> <span class="muted">(${wri.length} qualified write-in candidate${wri.length > 1 ? 's' : ''}: ${wri.map(c => esc(c.name)).join(', ')}; write-in names are not printed on the ballot)</span></li>` : ''}</ul>`;
  }
  function swBySeat(list, seatLabel) {
    const groups = {}; (list || []).forEach(c => { (groups[c.seat || ''] = groups[c.seat || ''] || []).push(c); });
    return Object.keys(groups).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0) || a.localeCompare(b)).map(seat => `<div class="sw-seat">${seat ? `<h4>${esc(seatLabel)} ${esc(seat)}</h4>` : ''}${swCandList(groups[seat])}</div>`).join('');
  }
  function viewCounties() {
    if (!SW) return notFound();
    return `<h1>${T('Florida counties', 'Condados de Florida')}</h1>
      <p class="lead muted">${T('Pick your county to see the districts that cover it, the official candidate line-up for every federal, state, judicial and county contest on its November 3, 2026 ballot, and your Supervisor of Elections. Line-ups come from the Florida Division of Elections candidate list; in-depth candidate research is available for the races on the Sumter County ballot.', 'Elija su condado para ver los distritos que lo cubren, la lista oficial de candidatos de cada contienda federal, estatal, judicial y de condado en su boleta del 3 de noviembre de 2026, y su Supervisor de Elecciones. Las listas provienen de la lista de candidatos de la División de Elecciones de Florida; la investigación a fondo de candidatos está disponible para las contiendas de la boleta del condado de Sumter.')}</p>
      ${countyPicker(loadCounty())}
      <div class="grid grid-3 section">${countyList().map(c => `<a class="card county-card" href="#/county/${esc(c.code)}"><h3>${esc(c.name)}</h3><p class="muted">${T('U.S. House', 'Cámara de EE. UU.')} ${c.congressional.map(d => d.district).join(', ')} · ${T('Senate', 'Senado')} ${c.senate.map(d => d.district).join(', ')} · ${T('House', 'Cámara')} ${c.house.map(d => d.district).join(', ')}</p></a>`).join('')}</div>`;
  }
  function viewCounty(code) {
    if (!SW) return notFound();
    const c = SW.counties[(code || '').toUpperCase()];
    if (!c) return notFound();
    saveCounty(c.code);
    const R = SW.races; const isSumter = c.code === 'SUM';
    const ourRace = id => RACE_BY_ID[id];
    const cdBlocks = c.congressional.map(d => {
      const list = R.us_house[String(d.district)] || [];
      const ours = ourRace('us_house_' + d.district);
      return `<div class="card"><h3>${T('U.S. House, District', 'Cámara de EE. UU., Distrito')} ${d.district}${c.congressional.length > 1 ? ` <span class="muted">${T(`(about ${esc(d.pct_land)}% of the county's land area)`, `(cerca del ${esc(d.pct_land)}% del área del condado)`)}</span>` : ''}</h3>${swCandList(list)}${ours ? `<p><a class="btn btn-sm" href="#/race/${esc(ours.id)}">${ours.coverage === 'full' || ours.coverage === 'partial' ? T('Researched positions and comparison →', 'Posiciones investigadas y comparación →') : T('Race page →', 'Página de la contienda →')}</a></p>` : ''}</div>`;
    }).join('');
    const senBlocks = c.senate.map(d => d.on_ballot
      ? `<div class="card"><h3>${T('Florida Senate, District', 'Senado de Florida, Distrito')} ${d.district}${d.whole_county ? '' : ` <span class="muted">${T('(part of the county)', '(parte del condado)')}</span>`}</h3><p class="muted"><small>${T('Covers:', 'Cubre:')} ${esc(SW.senate_district_counties[String(d.district)] || '')}</small></p>${swCandList(R.state_senate[String(d.district)] || [])}${ourRace('state_senate_' + d.district) ? `<p><a class="btn btn-sm" href="#/race/state_senate_${d.district}">${T('Race page →', 'Página de la contienda →')}</a></p>` : ''}</div>`
      : `<div class="card"><h3>${T('Florida Senate, District', 'Senado de Florida, Distrito')} ${d.district}${d.whole_county ? '' : ` <span class="muted">${T('(part of the county)', '(parte del condado)')}</span>`}</h3><p class="muted">${T('Not on the 2026 ballot: odd-numbered Senate districts are next up in 2028.', 'No está en la boleta de 2026: los distritos impares del Senado se eligen en 2028.')}</p></div>`).join('');
    const houseBlocks = c.house.map(d => {
      const ours = ourRace('state_house_' + d.district);
      return `<div class="card"><h3>${T('Florida House, District', 'Cámara de Florida, Distrito')} ${d.district}${d.whole_county ? '' : ` <span class="muted">${T('(part of the county)', '(parte del condado)')}</span>`}</h3><p class="muted"><small>${T('Covers:', 'Cubre:')} ${esc(SW.house_district_counties[String(d.district)] || '')}</small></p>${swCandList(R.state_house[String(d.district)] || [])}${ours ? `<p><a class="btn btn-sm" href="#/race/${esc(ours.id)}">${ours.coverage === 'full' || ours.coverage === 'partial' ? T('Researched positions and comparison →', 'Posiciones investigadas y comparación →') : T('Race page →', 'Página de la contienda →')}</a></p>` : ''}</div>`;
    }).join('');
    const dcaList = R.dca_judges[String(c.dca)] || [];
    const circuitList = (R.circuit_judges[String(c.circuit)] || []).filter(x => x.status === 'QUA');
    const localOrder = ['BCC', 'SCB', 'COJ', 'STA', 'PUB', 'COC', 'SOE', 'TAX', 'PRA', 'SHF', 'COF', 'CMB'];
    const seatLabels = { BCC: T('District', 'Distrito'), SCB: T('District', 'Distrito'), COJ: T('Group', 'Grupo'), CTJ: T('Group', 'Grupo') };
    const localBlocks = localOrder.filter(k => c.local_offices[k]).map(k => `<div class="card"><h3>${esc(SW.office_labels[k] || k)}</h3>${swBySeat(c.local_offices[k], seatLabels[k] || T('Seat', 'Escaño'))}</div>`).join('');
    const specialKeys = Object.keys(c.special_districts || {});
    const specialBlocks = specialKeys.length ? `<details class="card"><summary><strong>${T('Special districts', 'Distritos especiales')}</strong> (${specialKeys.map(k => esc(SW.office_labels[k] || k)).join(', ')}) ${T('— contested seats and unopposed members', ': escaños en disputa y miembros sin oposición')}</summary>${specialKeys.map(k => `<h4>${esc(SW.office_labels[k] || k)}</h4>${swBySeat(c.special_districts[k], T('Seat', 'Escaño'))}`).join('')}</details>` : '';
    const soe = c.supervisor;
    return `<div class="county-head">${countyPicker(c.code)}</div>
      <h1>${T(`${esc(c.name)} County ballot — November 3, 2026`, `Boleta del condado de ${esc(c.name)}: 3 de noviembre de 2026`)}</h1>${LANG === 'es' ? ES_NOTE : ''}
      <p class="lead muted">${T(`Official candidate line-up from the Florida Division of Elections (downloaded ${esc(SW.generated_at)}), plus the districts that cover ${esc(c.name)} County. Where a district covers only part of the county, your address decides which one you vote in: use the state's`, `Lista oficial de candidatos de la División de Elecciones de Florida (descargada el ${esc(SW.generated_at)}), más los distritos que cubren el condado de ${esc(c.name)}. Cuando un distrito cubre solo parte del condado, su dirección decide en cuál vota: use la`)} <a href="https://registration.elections.myflorida.com/CheckVoterStatus" target="_blank" rel="noopener">${T('voter lookup ↗', 'búsqueda de votantes del estado ↗')}</a> ${T('or your county sample ballot.', 'o la boleta de muestra de su condado.')}</p>
      <p class="notice">${T("This page is the official line-up from the state's candidate list. For researched positions and the match tool on the races you actually vote in,", 'Esta página es la lista oficial de la lista estatal de candidatos. Para ver posiciones investigadas y la herramienta de coincidencia en las contiendas en las que usted vota,')} <a href="#/where">${T('enter where you vote', 'ingrese dónde vota')}</a>${T('; races this guide has researched are linked below where they apply.', '; las contiendas que esta guía ha investigado están enlazadas abajo donde corresponde.')}</p>
      <section class="section"><h2>${T('Statewide (same everywhere in Florida)', 'Estatales (iguales en toda Florida)')}</h2><div class="grid grid-2">
        ${['us_senate_special', 'governor', 'attorney_general', 'cfo', 'agriculture_commissioner'].map(id => ourRace(id)).filter(Boolean).map(raceCard).join('')}
        <div class="card"><h3><a href="#/amendments">${T('Constitutional amendments 1, 2 and 3', 'Enmiendas constitucionales 1, 2 y 3')}</a></h3><p class="muted">${T('Official language, what Yes and No mean, and who supports and opposes each.', 'Texto oficial, qué significan Sí y No, y quién apoya y quién se opone a cada una.')}</p></div>
        <div class="card"><h3>${T('Supreme Court retention', 'Retención en la Corte Suprema')}</h3>${swCandList(R.supreme_court)}<p><a class="btn btn-sm" href="#/judges">${T('About Justice Muñiz →', 'Sobre el magistrado Muñiz →')}</a></p></div>
      </div></section>
      <section class="section"><h2>${T('Congress', 'Congreso')}</h2><div class="grid grid-2">${cdBlocks}</div></section>
      <section class="section"><h2>${T('Florida Legislature', 'Legislatura de Florida')}</h2><div class="grid grid-2">${senBlocks}${houseBlocks}</div></section>
      <section class="section"><h2>${T('Judges', 'Jueces')}</h2><div class="grid grid-2">
        <div class="card"><h3>${T(`${['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'][c.dca - 1]} District Court of Appeal — merit retention`, `Tribunal de Apelación del ${['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto'][c.dca - 1]} Distrito: retención por mérito`)}</h3><p class="muted"><small>${T(`${esc(c.name)} County is in the ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th'][c.circuit - 1]} Judicial Circuit, whose appeals go to this court. Each judge is a separate Yes/No question.`, `El condado de ${esc(c.name)} está en el Circuito Judicial ${c.circuit}, cuyas apelaciones van a este tribunal. Cada juez es una pregunta separada de Sí/No.`)}</small></p><ul class="sw-cands">${dcaList.map(j => T(`<li>Shall Judge <strong>${esc(j.name)}</strong> be retained in office?</li>`, `<li>¿Debe el juez <strong>${esc(j.name)}</strong> permanecer en su cargo?</li>`)).join('')}</ul>${c.dca === 5 ? `<p><a class="btn btn-sm" href="#/judges">${T('Judge backgrounds →', 'Antecedentes de los jueces →')}</a></p>` : ''}</div>
        <div class="card"><h3>${T(`Circuit Judge, ${['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th'][c.circuit - 1]} Circuit`, `Juez de Circuito, Circuito ${c.circuit}`)}</h3>${circuitList.length ? swBySeat(circuitList, T('Group', 'Grupo')) : `<p class="muted">${T('No contested circuit-judge seat on the November ballot in this circuit (contested groups were decided in August or all candidates were unopposed).', 'No hay escaños de juez de circuito en disputa en la boleta de noviembre en este circuito (los grupos en disputa se decidieron en agosto o todos los candidatos no tuvieron oposición).')}</p>`}</div>
      </div></section>
      <section class="section"><h2>${T(`${esc(c.name)} County offices`, `Cargos del condado de ${esc(c.name)}`)}</h2>${localBlocks ? `<div class="grid grid-2">${localBlocks}</div>` : `<p class="muted">${T('No county office appears in the state list for this county in 2026.', 'Ningún cargo de condado aparece en la lista estatal para este condado en 2026.')}</p>`}<p class="muted"><small>${T('"Elected without opposition" seats do not appear on the ballot. Seats decided in the August primary are not listed. City and town elections and local referendums are run by each county and are not in the state candidate list: check your county\'s sample ballot.', 'Los escaños "electos sin oposición" no aparecen en la boleta. Los escaños decididos en la primaria de agosto no se listan. Las elecciones municipales y los referendos locales los administra cada condado y no están en la lista estatal de candidatos: consulte la boleta de muestra de su condado.')}</small></p>${specialBlocks}</section>
      <section class="section"><h2>${T(`${esc(c.name)} County Supervisor of Elections`, `Supervisor de Elecciones del condado de ${esc(c.name)}`)}</h2><div class="card"><dl class="kv"><dt>${T('Supervisor', 'Supervisor')}</dt><dd>${esc(soe.supervisor || '')}</dd><dt>${T('Phone', 'Teléfono')}</dt><dd>${esc(soe.phone || '')}</dd><dt>${T('Address', 'Dirección')}</dt><dd>${esc(soe.address || '')}</dd></dl>${soe.website ? `<p><a class="btn btn-primary" href="${esc(soe.website)}" target="_blank" rel="noopener">${T('Sample ballot, early voting and mail ballots ↗', 'Boleta de muestra, votación anticipada y boletas por correo ↗')}</a></p>` : ''}<p class="muted"><small>${T('Statewide deadlines: register by Oct. 5, 2026; request a mail ballot by 5 p.m. Oct. 22; mandatory early voting Oct. 24–31 (counties may add days); polls open 7 a.m.–7 p.m. on Nov. 3.', 'Plazos estatales: regístrese antes del 5 de octubre de 2026; solicite una boleta por correo antes de las 5 p.m. del 22 de octubre; votación anticipada obligatoria del 24 al 31 de octubre (los condados pueden añadir días); las urnas abren de 7 a.m. a 7 p.m. el 3 de noviembre.')}</small></p></div></section>
      <section class="section"><h2>${T(`Early voting in ${esc(c.name)} County`, `Votación anticipada en el condado de ${esc(c.name)}`)}</h2><div class="card">${(() => { const ev = (DATA.counties && DATA.counties[c.name] && DATA.counties[c.name].early_voting) || null; return ev ? `<p><strong>${T('Dates:', 'Fechas:')}</strong> ${esc(ev.dates || '')}${ev.hours ? ` · <strong>${T('Hours:', 'Horario:')}</strong> ${esc(ev.hours)}` : ''}</p>${ev.sites_url ? `<p><a class="btn" href="${esc(ev.sites_url)}" target="_blank" rel="noopener">${T('Early voting sites and hours ↗', 'Sitios y horarios de votación anticipada ↗')}</a></p>` : ''}${ev.note ? `<p class="muted"><small>${esc(ev.note)}</small></p>` : ''}` : `<p>${T(`Florida law requires every county to offer early voting at least <strong>Saturday, Oct. 24 through Saturday, Oct. 31</strong>, for 8 to 12 hours a day; counties may start as early as Oct. 19 and run through Nov. 1. ${esc(c.name)} County's site list and hours are published by the Supervisor of Elections in October (the state posts the statewide list after Oct. 4).`, `La ley de Florida exige que cada condado ofrezca votación anticipada al menos del <strong>sábado 24 de octubre al sábado 31 de octubre</strong>, de 8 a 12 horas por día; los condados pueden empezar desde el 19 de octubre y continuar hasta el 1 de noviembre. El Supervisor de Elecciones del condado de ${esc(c.name)} publica la lista de sitios y horarios en octubre (el estado publica la lista estatal después del 4 de octubre).`)}</p>${soe.website ? `<p><a class="btn" href="${esc(soe.website)}" target="_blank" rel="noopener">${T(`${esc(c.name)} County early voting sites ↗`, `Sitios de votación anticipada del condado de ${esc(c.name)} ↗`)}</a></p>` : ''}`; })()}<p class="muted"><small>${T('Any early-voting site in your county can be used; on Election Day you must vote at your assigned precinct. Mail ballots can be returned to secure intake stations at early-voting sites during voting hours.', 'Puede usar cualquier sitio de votación anticipada de su condado; el día de la elección debe votar en su recinto asignado. Las boletas por correo pueden devolverse en las estaciones seguras de recepción en los sitios de votación anticipada durante el horario de votación.')}</small></p></div></section>
      <section class="section"><details><summary class="muted">${T('Sources for this page', 'Fuentes de esta página')}</summary><ul class="muted"><li>${esc(SW.sources.candidates)}</li><li>${esc(SW.sources.congressional)}</li><li>${esc(SW.sources.legislative)}</li><li>${esc(SW.sources.judicial)}</li><li>${esc(SW.sources.supervisors)}</li></ul></details></section>`;
  }


  function notFound() { return `<h1>${T('Not found', 'No encontrado')}</h1><p>${T('That page does not exist.', 'Esa página no existe.')} <a href="#/">${T('Go home', 'Ir al inicio')}</a>.</p>`; }

  /* ---------- Router ---------- */
  function route() {
    const pre = $('#main') && $('#main').dataset.route;
    const hash = location.hash.replace(/^#/, '') || (pre ? pre.replace(/^#/, '') : '/');
    const parts = hash.split('/').filter(Boolean);
    const main = $('#main');
    let html = '', nav = 'home', after = null;
    if (parts.length === 0) { html = viewHome(); }
    else if (parts[0] === 'races') { const f = parts[1] === 'group' && parts[2] ? { kind: 'group', value: decodeURIComponent(parts[2]) } : parts[1] === 'jur' && parts[2] ? { kind: 'jur', value: decodeURIComponent(parts[2]) } : null; html = viewRaces(f); nav = 'races'; }
    else if (parts[0] === 'race' && parts[1]) { html = viewRace(decodeURIComponent(parts[1])); nav = 'races'; after = r => { bindHeat(r); bindMap(r); bindColumns(r); }; }
    else if (parts[0] === 'candidate' && parts[1]) { html = viewCandidate(decodeURIComponent(parts[1])); nav = 'races'; }
    else if (parts[0] === 'match' && parts[1] === 'cheatsheet') { html = viewCheatsheet(); nav = 'match'; after = r => { const p = r.querySelector('[data-print]'); if (p) p.addEventListener('click', () => window.print()); }; }
    else if (parts[0] === 'match' && parts[1] === 'results') { html = viewResults(); nav = 'match'; after = r => { const p = r.querySelector('[data-print]'); if (p) p.addEventListener('click', () => window.print()); bindMap(r); const f = r.querySelector('[data-mapfilter]'); if (f) f.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { f.querySelectorAll('button').forEach(x => x.classList.toggle('selected', x === b)); const id = b.dataset.race; const cands = (id === 'all' ? ballotRaces(loadProfile()).flatMap(r => r.candidates || []) : (RACE_BY_ID[id].candidates || [])).filter(c => !c.withdrawn); r.querySelector('[data-mapcard]').innerHTML = landscapeMap(cands, { you: userPoint(loadAnswers()) }); bindMap(r); })); }; }
    else if (parts[0] === 'match') { html = viewMatch(); nav = 'match'; after = bindMatch; }
    else if (parts[0] === 'amendments') { html = viewAmendments(); nav = 'amendments'; }
    else if (parts[0] === 'judges') { html = viewJudges(); nav = 'judges'; }
    else if (parts[0] === 'vote') { html = viewVote(); nav = 'vote'; }
    else if (parts[0] === 'about') { html = viewAbout(); nav = 'about'; }
    else if (parts[0] === 'where') { html = viewWhere(); nav = 'home'; after = bindAddress; }
    else if (parts[0] === 'counties') { html = viewCounties(); nav = 'counties'; after = bindCountyPicker; }
    else if (parts[0] === 'county' && parts[1]) { html = viewCounty(decodeURIComponent(parts[1])); nav = 'counties'; after = bindCountyPicker; }
    else { html = notFound(); }
    main.innerHTML = html;
    if (after) after(main);
    if (main.querySelector('[data-addr-form]')) bindAddress(main);
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
    $('#site-nav').classList.remove('open');
    $('#nav-toggle').setAttribute('aria-expanded', 'false');
  }
  let lastHash = null;
  function render() { route(); }
  window.addEventListener('hashchange', () => { if (location.hash !== lastHash) { window.scrollTo({ top: 0 }); lastHash = location.hash; } route(); });
  document.addEventListener('DOMContentLoaded', () => {
    $('#nav-toggle').addEventListener('click', () => { const n = $('#site-nav'); const open = n.classList.toggle('open'); $('#nav-toggle').setAttribute('aria-expanded', String(open)); });
    const dd = $('#data-date'); if (dd) dd.textContent = DATA.generated_at || 'September 2026';
    applyChrome();
    const lt = document.getElementById('lang-toggle'); if (lt) lt.addEventListener('click', () => setLang(LANG === 'es' ? 'en' : 'es'));
    lastHash = location.hash; route();
  });
})();
