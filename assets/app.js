/* Sumter County Voter Guide 2026 — single-page app (no build step, no framework). */
(function () {
  'use strict';

  const DATA = window.GUIDE_DATA || { issues: [], races: [], amendments: [], judicial: {}, voting_info: {}, other_races: {}, school_board: {} };
  const ISSUES = DATA.issues || [];
  const ISSUE_BY_ID = Object.fromEntries(ISSUES.map(i => [i.id, i]));
  const RACES = (DATA.races || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99));
  const RACE_BY_ID = Object.fromEntries(RACES.map(r => [r.id, r]));
  const CANDIDATES = RACES.flatMap(r => (r.candidates || []).map(c => Object.assign({ race_id: r.id }, c)));
  const CAND_BY_ID = Object.fromEntries(CANDIDATES.map(c => [c.id, c]));
  const STORAGE_KEY = 'scvg2026_answers_v1';

  const STANCE_LABEL = { '2': 'Strongly agrees', '1': 'Leans agree', '0': 'Mixed / neutral', '-1': 'Leans disagree', '-2': 'Strongly disagrees', 'null': 'No public position found' };
  const CONF_LABEL = { stated: 'stated position', record: 'based on record', unknown: 'unknown' };
  const USER_SCALE = [
    { v: 2, label: 'Strongly agree' }, { v: 1, label: 'Agree' }, { v: 0, label: 'Neutral / unsure' }, { v: -1, label: 'Disagree' }, { v: -2, label: 'Strongly disagree' }
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
    if (c.photo_url) {
      return `<span class="${cls}" data-initials="${esc(initials(c.name))}"><img src="${esc(c.photo_url)}" alt="Photo of ${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.textContent=this.parentNode.dataset.initials"></span>`;
    }
    return `<span class="${cls}" aria-hidden="true">${esc(initials(c.name))}</span>`;
  }
  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    return `<div class="sources">Sources: ${sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || '')}">${esc(s.title ? truncate(s.title, 60) : hostOf(s.url))}${s.date ? ` (${esc(s.date)})` : ''}</a>`).join(' · ')}</div>`;
  }
  const truncate = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + '…' : s;
  function stanceChip(pos) {
    const st = pos && pos.stance != null ? pos.stance : null;
    const key = st == null ? 'null' : String(st);
    const conf = pos && pos.confidence && pos.confidence !== 'unknown' ? `<span class="conf">· ${CONF_LABEL[pos.confidence] || pos.confidence}</span>` : '';
    return `<span class="stance stance-${key}">${STANCE_LABEL[key]}${conf}</span>`;
  }
  function issuesForLevel(level) { return ISSUES.filter(i => (i.levels || []).includes(level)); }
  function partyTag(c) { return `<span class="tag tag-party ${partyClass(c.party)}">${esc(c.party || 'No Party Affiliation')}</span>`; }

  /* ---------- storage ---------- */
  function loadAnswers() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveAnswers(a) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch (e) { /* ignore */ } }

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

  /* ---------- views ---------- */
  function viewHome() {
    const vi = (DATA.voting_info || {}).short || {};
    const dates = [
      ['Register by', vi.registration_deadline], ['Mail ballot request by', vi.vote_by_mail_request_deadline],
      ['Early voting', vi.early_voting_dates], ['Election Day', vi.election_date || 'Tue, Nov 3, 2026']
    ].filter(d => d[1]);
    return `
      <section class="hero">
        <div class="eyebrow">Sumter County, Florida · General Election · November 3, 2026</div>
        <h1>Know every race on your ballot. Decide on the facts.</h1>
        <p class="lead">A nonpartisan, source-cited guide to the candidates and questions Sumter County voters will see this November, plus a tool that matches your own views to each candidate's stated positions.</p>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/match">Find my closest match →</a>
          <a class="btn" href="#/races">Browse all races</a>
          <a class="btn" href="#/vote">How &amp; where to vote</a>
        </div>
      </section>
      ${dates.length ? `<section class="section"><div class="dates-grid">${dates.map(d => `<div class="date-tile"><div class="muted">${esc(d[0])}</div><div class="d">${esc(d[1])}</div></div>`).join('')}</div></section>` : ''}
      <section class="section">
        <div class="section-head"><h2>Races on the Sumter County ballot</h2><a href="#/races">See all →</a></div>
        <div class="grid grid-2">${RACES.map(raceCard).join('')}</div>
      </section>
      <section class="section grid grid-3">
        <div class="card"><div class="eyebrow">Ballot questions</div><h3><a href="#/amendments">${(DATA.amendments || []).length || 3} constitutional amendments</a></h3><p class="muted">Official ballot language, what a Yes or No vote does, fiscal impact, and the arguments each side is making, attributed to who is making them.</p></div>
        <div class="card"><div class="eyebrow">Judicial retention</div><h3><a href="#/judges">Should these judges keep their seats?</a></h3><p class="muted">Background on the Supreme Court justice and appellate judges you will be asked to retain or remove.</p></div>
        <div class="card"><div class="eyebrow">How this guide works</div><h3><a href="#/about">Methodology &amp; neutrality rules</a></h3><p class="muted">How positions are coded, why some are marked unknown, and how the match score is calculated.</p></div>
      </section>`;
  }

  function raceCard(r) {
    const cands = r.candidates || [];
    return `<div class="card race-card">
      <div><span class="tag tag-level">${esc(r.office_group)}</span></div>
      <h3><a href="#/race/${esc(r.id)}">${esc(r.title)}</a></h3>
      <div class="cand-row">${cands.map(c => `<a class="cand-chip" href="#/candidate/${esc(c.id)}">${avatar(c, 'sm')}${esc(c.name)} <small>(${esc(partyShort(c.party))})</small></a>`).join('') || '<span class="empty">Candidate data pending</span>'}</div>
      <div><a class="btn btn-sm" href="#/race/${esc(r.id)}">Compare positions →</a></div>
    </div>`;
  }

  function viewRaces() {
    const groups = {};
    RACES.forEach(r => { (groups[r.office_group] = groups[r.office_group] || []).push(r); });
    const other = DATA.other_races || {};
    const sb = DATA.school_board || {};
    return `<h1>Races on the ballot</h1>
      <p class="lead muted">Every contested race Sumter County voters will see on November 3, 2026. Click a race to compare candidates issue by issue, or a candidate to read a full profile.</p>
      ${Object.keys(groups).map(g => `<section class="section"><h2>${esc(g)}</h2><div class="grid grid-2">${groups[g].map(raceCard).join('')}</div></section>`).join('')}
      <section class="section"><h2>Also on the ballot</h2>
        <div class="grid grid-2">
          <div class="card"><h3><a href="#/amendments">Constitutional amendments</a></h3><p class="muted">Three statewide amendments; each needs 60% to pass.</p></div>
          <div class="card"><h3><a href="#/judges">Judicial merit retention</a></h3><p class="muted">Yes/No votes on whether appellate judges keep their seats.</p></div>
        </div>
      </section>
      ${(other.decided_or_unopposed && other.decided_or_unopposed.length) || (other.unverified && other.unverified.length) || (sb.results && sb.results.length) ? `
      <section class="section"><h2>Also on or off the ballot: decided, uncontested, municipal and unverified items</h2>
        <p class="muted">Seats filled in the August 18 primary or without opposition, city council seats scheduled for November (candidates not yet verified), and items we could not confirm. Check your sample ballot for city races.</p>
        <div class="card">
          ${(other.decided_or_unopposed || []).length ? `<h3>Decided in August or unopposed</h3><ul>${other.decided_or_unopposed.map(x => `<li><strong>${esc(x.office || x.title || x.race || '')}</strong>${x.status ? ` <span class="tag">${esc(x.status)}</span>` : ''}${x.result ? ': ' + esc(x.result) : ''}${x.note ? `<br><small class="muted">${esc(x.note)}</small>` : ''}${sourcesHtml(x.sources)}</li>`).join('')}</ul>` : ''}
          ${(other.unverified || []).length ? `<h3>Could not be verified</h3><ul>${other.unverified.map(x => `<li><strong>${esc(x.office || x.title || '')}</strong>${x.note ? `<br><small class="muted">${esc(x.note)}</small>` : ''}${sourcesHtml(x.sources)}</li>`).join('')}</ul>` : ''}
          ${other.verified_ballot_note ? `<p class="muted"><small>${esc(other.verified_ballot_note)}</small></p>` : ''}
          ${(sb.results || []).length ? `<h3>Sumter County School Board (nonpartisan, decided August 18)</h3><ul>${sb.results.map(x => `<li><strong>${esc(x.seat || x.district || x.office || '')}</strong>: ${esc(x.result || x.summary || (x.winner ? `${x.winner} won` : ''))}${x.note ? ` <small class="muted">— ${esc(x.note)}</small>` : ''}${sourcesHtml(x.sources)}</li>`).join('')}</ul>${sb.note ? `<p class="muted">${esc(sb.note)}</p>` : ''}${sourcesHtml(sb.sources)}` : ''}
        </div>
      </section>` : ''}`;
  }

  function viewRace(id) {
    const r = RACE_BY_ID[id];
    if (!r) return notFound();
    const cands = r.candidates || [];
    const issues = issuesForLevel(r.level);
    return `<div class="breadcrumb"><a href="#/races">Races</a> › ${esc(r.title)}</div>
      <span class="tag tag-level">${esc(r.office_group)}</span>
      <h1>${esc(r.title)}</h1>
      <p class="lead muted">${esc(r.what_it_does || '')} ${r.term ? `<strong>Term:</strong> ${esc(r.term)}.` : ''}</p>
      ${r.verified_ballot_note ? `<details class="notice" style="border-radius:0 var(--radius-sm) var(--radius-sm) 0"><summary>How we verified who is on the ballot</summary><p style="margin:8px 0 0">${esc(r.verified_ballot_note)}</p>${sourcesHtml(r.verified_ballot_sources)}</details>` : ''}
      <div class="btn-row"><a class="btn btn-primary" href="#/match">See how you match in this race →</a></div>
      <section class="section"><h2>Candidates</h2>${cands.some(c => c.withdrawn) ? '<p class="notice notice-warn">A candidate marked "Withdrew" ended their campaign after qualifying. Their name may still be printed on the ballot; votes for a withdrawn candidate are not counted. They are excluded from match results.</p>' : ''}<div class="stack">${cands.map(c => candidateCard(c)).join('')}</div></section>
      <section class="section">
        <div class="section-head"><h2>Side-by-side on the major issues</h2></div>
        <div class="legend"><span class="stance stance-2">Strongly agrees</span><span class="stance stance-1">Leans agree</span><span class="stance stance-0">Mixed / neutral</span><span class="stance stance--1">Leans disagree</span><span class="stance stance--2">Strongly disagrees</span><span class="stance stance-null">No public position found</span></div>
        <p class="muted">Each row is a statement. The chips show how each candidate's stated positions or record relate to that statement. Expand a row to read the evidence and sources. "No public position found" means we could not find a statement or record on the topic, not that the candidate has none.</p>
        <div class="table-wrap"><table class="compare">
          <thead><tr><th>Issue</th>${cands.map(c => `<th class="cand-col"><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a><br>${partyTag(c)}</th>`).join('')}</tr></thead>
          <tbody>${issues.map(issue => `<tr>
            <td class="issue-cell">${esc(issue.label)}<small>${esc(issue.statement)}</small></td>
            ${cands.map(c => { const p = (c.positions || {})[issue.id]; return `<td>${stanceChip(p)}${p && p.summary && p.stance != null ? `<div class="cell-summary">${esc(p.summary)}${sourcesHtml(p.sources)}</div>` : ''}</td>`; }).join('')}
          </tr>`).join('')}</tbody>
        </table></div>
      </section>
      <section class="section"><h2>Other issues the candidates have raised</h2>
        <p class="muted">Priorities each candidate has brought up on their own, beyond the major-issue list above.</p>
        <div class="grid grid-2">${cands.map(c => `<div class="card"><h3><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a></h3>${otherIssuesHtml(c, true)}</div>`).join('')}</div>
      </section>`;
  }

  function coverage(c) {
    const r = RACE_BY_ID[c.race_id]; if (!r) return '';
    const rel = issuesForLevel(r.level);
    const known = rel.filter(i => c.positions && c.positions[i.id] && c.positions[i.id].stance != null).length;
    return `<span class="tag" title="Number of major issues relevant to this office on which a sourced position was found">Positions documented: ${known} of ${rel.length}</span>`;
  }
  function candidateCard(c) {
    return `<div class="card cand-card">
      <a href="#/candidate/${esc(c.id)}" aria-label="${esc(c.name)} profile">${avatar(c, 'lg')}</a>
      <div>
        <h3><a href="#/candidate/${esc(c.id)}">${esc(c.name)}</a>${c.running_mate ? ` <small class="muted">with ${esc(c.running_mate)}</small>` : ''}</h3>
        <div class="cand-meta">${partyTag(c)}${c.incumbent ? '<span class="tag badge-incumbent">Incumbent</span>' : ''}${c.withdrawn ? `<span class="tag" style="color:var(--danger)">Withdrew ${esc(c.withdrawn === true ? '' : c.withdrawn)}</span>` : ''}${coverage(c)}${c.occupation ? `<span class="muted">${esc(c.occupation)}</span>` : ''}</div>
        <p>${esc(truncate(c.background || '', 320))}</p>
        <div class="btn-row" style="margin-top:8px"><a class="btn btn-sm" href="#/candidate/${esc(c.id)}">Full profile</a>${c.website ? `<a class="btn btn-sm" href="${esc(c.website)}" target="_blank" rel="noopener">Campaign site ↗</a>` : ''}</div>
      </div>
    </div>`;
  }

  function otherIssuesHtml(c, compact) {
    const list = c.other_issues || [];
    if (!list.length) return '<p class="empty">No additional issues found in public statements as of the last data review.</p>';
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
        <h4>${esc(i.label)} ${stanceChip(p)}</h4>
        <div class="issue-statement">Statement: "${esc(i.statement)}"</div>
        ${p.summary ? `<p class="issue-summary">${esc(p.summary)}</p>` : ''}
        ${p.quote ? `<blockquote>"${esc(p.quote)}"</blockquote>` : ''}
        ${sourcesHtml(p.sources)}
      </div>`; };
    return `<div class="breadcrumb"><a href="#/races">Races</a> › <a href="#/race/${esc(r.id)}">${esc(r.title)}</a> › ${esc(c.name)}</div>
      <div class="card profile-head">
        <div>${avatar(c, 'xl')}${c.photo_source ? `<div class="sources" style="margin-top:8px">Photo: ${esc(c.photo_source)}</div>` : ''}</div>
        <div>
          <span class="tag tag-level">${esc(r.title)}</span>
          <h1 style="margin-top:8px">${esc(c.name)}</h1>
          ${c.running_mate ? `<p class="muted">Running mate: ${esc(c.running_mate)}</p>` : ''}
          <div class="cand-meta">${partyTag(c)}${c.incumbent ? '<span class="tag badge-incumbent">Incumbent</span>' : ''}${c.withdrawn ? `<span class="tag" style="color:var(--danger)">Withdrew ${esc(c.withdrawn === true ? '' : c.withdrawn)}</span>` : ''}${c.occupation ? `<span class="tag">${esc(c.occupation)}</span>` : ''}${c.residence ? `<span class="tag">${esc(c.residence)}</span>` : ''}</div>
          <p>${esc(c.background || '')}</p>
          ${c.primary_result ? `<p><strong>How they got on the ballot:</strong> ${esc(c.primary_result)}</p>` : ''}
          <div class="profile-links">${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">Campaign website ↗</a>` : ''}${(c.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)} ↗</a>`).join('')}</div>
        </div>
      </div>
      <section class="section">
        <div class="section-head"><h2>Positions on the major issues</h2><a href="#/race/${esc(r.id)}">Compare with opponents →</a></div>
        <p class="muted">Each entry describes what the candidate has said or done, and what they say they will do, in neutral terms with sources. The chip shows how that relates to the statement voters rate in the matching tool.</p>
        <div class="card">${known.length ? known.map(posBlock).join('') : '<p class="empty">No public positions on the major issues were found.</p>'}</div>
        ${unknown.length ? `<details style="margin-top:12px"><summary>No public position found on ${unknown.length} issue${unknown.length > 1 ? 's' : ''}</summary><p class="muted" style="margin-top:8px">We searched campaign sites, questionnaires, interviews, votes and official actions and did not find a clear stance on: ${unknown.map(i => esc(i.label)).join(', ')}. This is reported as unknown rather than guessed from party affiliation; these issues are excluded from this candidate's match score.</p>${unknown.filter(i => c.positions && c.positions[i.id] && c.positions[i.id].summary && !/No public position found/i.test(c.positions[i.id].summary)).map(i => `<p><strong>${esc(i.label)}:</strong> ${esc(c.positions[i.id].summary)}${sourcesHtml(c.positions[i.id].sources)}</p>`).join('')}</details>` : ''}
        ${allOther.length ? `<details style="margin-top:12px"><summary>Positions on issues outside this office's scope (${allOther.length})</summary><div style="margin-top:8px">${allOther.map(posBlock).join('')}</div></details>` : ''}
      </section>
      <section class="section"><h2>Other issues this candidate has raised</h2><div class="card">${otherIssuesHtml(c)}</div></section>
      ${(c.record || []).length ? `<section class="section"><h2>Record: votes, actions and documented facts</h2><div class="card"><ul>${c.record.map(x => `<li>${esc(x.item)}${sourcesHtml(x.sources)}</li>`).join('')}</ul></div></section>` : ''}
      ${(c.endorsements || []).length ? `<section class="section"><h2>Endorsements (as reported)</h2><div class="card"><ul>${c.endorsements.map(x => `<li>${esc(x.by)}${sourcesHtml(x.sources)}</li>`).join('')}</ul></div></section>` : ''}
      <div class="btn-row"><a class="btn btn-primary" href="#/match">See how you match with ${esc(c.name.split(' ')[0])} →</a><a class="btn" href="#/race/${esc(r.id)}">Back to race</a></div>`;
  }

  /* ---------- Match quiz ---------- */
  let quizIndex = 0;
  function viewMatch() {
    const answers = loadAnswers();
    const total = ISSUES.length;
    const answered = Object.values(answers).filter(a => a && a.value != null).length;
    const i = Math.min(quizIndex, total - 1);
    const issue = ISSUES[i];
    const a = answers[issue.id] || {};
    const applies = (issue.levels || []).map(l => ({ federal: 'federal races', state: 'state races', county: 'county races' }[l])).join(', ');
    return `<h1>Match me to the candidates</h1>
      <p class="lead muted">Rate ${total} statements. Your answers are compared with each candidate's documented positions on the issues that apply to their office. Answers stay in your browser only. Skip anything you do not care about.</p>
      <div class="quiz-progress" aria-hidden="true"><span style="width:${Math.round(100 * answered / total)}%"></span></div>
      <div class="card q-card">
        <div class="eyebrow">${i + 1} of ${total} · ${esc(issue.label)} <span class="muted">(used for ${esc(applies)})</span></div>
        <div class="q-statement">"${esc(issue.statement)}"</div>
        <div class="scale" role="group" aria-label="Your answer">${USER_SCALE.map(s => `<button type="button" data-answer="${s.v}" class="${a.value === s.v ? 'selected' : ''}">${esc(s.label)}</button>`).join('')}</div>
        <div class="importance"><span class="muted">How much does this matter to you?</span>
          <span class="toggle"><button type="button" data-imp="0" class="${!a.important ? 'selected' : ''}">Normal</button><button type="button" data-imp="1" class="${a.important ? 'selected' : ''}">A lot (double weight)</button></span>
          <button type="button" class="btn btn-sm" data-skip="1">Skip this one</button>
        </div>
        <div class="q-nav">
          <button type="button" class="btn" data-prev="1" ${i === 0 ? 'disabled' : ''}>← Back</button>
          <div><a class="btn" href="#/match/results">See results (${answered} answered)</a> <button type="button" class="btn btn-primary" data-next="1">${i === total - 1 ? 'Finish →' : 'Next →'}</button></div>
        </div>
      </div>
      <p class="muted" style="margin-top:12px"><button type="button" class="btn btn-sm" data-reset="1">Clear my answers</button></p>`;
  }
  function bindMatch(root) {
    const answers = loadAnswers();
    const issue = ISSUES[Math.min(quizIndex, ISSUES.length - 1)];
    const set = (patch) => { answers[issue.id] = Object.assign({}, answers[issue.id] || {}, patch); saveAnswers(answers); };
    root.querySelectorAll('[data-answer]').forEach(b => b.addEventListener('click', () => { set({ value: Number(b.dataset.answer) }); advance(); }));
    root.querySelectorAll('[data-imp]').forEach(b => b.addEventListener('click', () => { set({ important: b.dataset.imp === '1' }); render(); }));
    const skip = root.querySelector('[data-skip]'); if (skip) skip.addEventListener('click', () => { set({ value: null }); advance(); });
    const prev = root.querySelector('[data-prev]'); if (prev) prev.addEventListener('click', () => { quizIndex = Math.max(0, quizIndex - 1); render(); });
    const next = root.querySelector('[data-next]'); if (next) next.addEventListener('click', advance);
    const reset = root.querySelector('[data-reset]'); if (reset) reset.addEventListener('click', () => { if (confirm('Clear all of your answers?')) { saveAnswers({}); quizIndex = 0; render(); } });
    function advance() { if (quizIndex >= ISSUES.length - 1) { location.hash = '#/match/results'; } else { quizIndex++; render(); } }
  }

  function viewResults() {
    const answers = loadAnswers();
    const answered = Object.values(answers).filter(a => a && a.value != null).length;
    if (!answered) return `<h1>Your matches</h1><p class="notice">You have not answered any statements yet.</p><div class="btn-row"><a class="btn btn-primary" href="#/match">Start the questionnaire →</a></div>`;
    const sections = RACES.map(r => {
      const scored = (r.candidates || []).filter(c => !c.withdrawn).map(c => Object.assign({ cand: c }, scoreCandidate(c, r, answers))).sort((a, b) => (b.pct == null ? -1 : b.pct) - (a.pct == null ? -1 : a.pct));
      const answeredHere = issuesForLevel(r.level).filter(i => answers[i.id] && answers[i.id].value != null).length;
      return `<div class="card">
        <div class="eyebrow">${esc(r.office_group)}</div>
        <h3><a href="#/race/${esc(r.id)}">${esc(r.title)}</a></h3>
        ${scored.map(s => `<div class="match-row">
          ${avatar(s.cand)}
          <div>
            <div><a href="#/candidate/${esc(s.cand.id)}"><strong>${esc(s.cand.name)}</strong></a> ${partyTag(s.cand)}</div>
            ${s.pct == null || s.used < 3 ? `<div class="match-detail">Not enough documented positions to score (${s.used} of the ${answeredHere} statements you answered for this office).</div>` : `<div class="match-bar"><span style="width:${s.pct}%"></span></div><div class="match-detail">Based on ${s.used} of ${answeredHere} statements you answered that apply to this office.${s.used < answeredHere ? ' Issues without a documented position are left out.' : ''}</div>
            <div class="pill-row">${s.agree.slice(0, 6).map(i => `<span class="pill agree">✓ ${esc(i.label)}</span>`).join('')}${s.disagree.slice(0, 6).map(i => `<span class="pill disagree">✕ ${esc(i.label)}</span>`).join('')}</div>`}
          </div>
          <div class="match-pct">${s.pct == null || s.used < 3 ? '—' : s.pct + '%'}</div>
        </div>`).join('')}
      </div>`;
    });
    return `<h1>Your matches</h1>
      <p class="lead muted">Higher percentages mean a candidate's documented positions are closer to your answers on the issues that apply to that office. Percentages are only as good as the public record: a candidate who has said little will match on fewer issues, and that is shown under each name. Read the full profiles before deciding.</p>
      <div class="btn-row"><a class="btn" href="#/match">Change my answers</a><button type="button" class="btn" data-print="1">Print or save as PDF</button></div>
      <div class="stack section">${sections.join('')}</div>
      <p class="muted section">How the score works: for each statement you answered, the distance between your answer and the candidate's coded stance (both on a 5-point scale) is turned into agreement from 0% to 100%, then averaged with your "matters a lot" statements counting double. Only issues relevant to the office and with a documented candidate position are included. <a href="#/about">Full methodology →</a></p>`;
  }

  /* ---------- Amendments / judges / vote / about ---------- */
  function viewAmendments() {
    const list = DATA.amendments || [];
    return `<h1>Constitutional amendments</h1>
      <p class="lead muted">Statewide questions on every Florida ballot. Each needs at least 60% "Yes" to pass. Arguments are attributed to the organizations and officials making them; this guide takes no position.</p>
      ${list.length ? list.map(a => `<div class="card" id="amend-${esc(a.number)}">
        <div class="eyebrow">Amendment ${esc(a.number)}${a.sponsor ? ` · ${esc(a.sponsor)}` : ''}</div>
        <h2>${esc(a.title)}</h2>
        ${a.original_title ? `<p class="muted"><small>Originally titled "${esc(a.original_title)}". ${a.ballot_language_litigation ? esc(a.ballot_language_litigation.summary || '') : ''}${a.ballot_language_litigation && a.ballot_language_litigation.sources ? ' ' + a.ballot_language_litigation.sources.map(u => `<a href="${esc(typeof u === 'string' ? u : u.url)}" target="_blank" rel="noopener">${esc(hostOf(typeof u === 'string' ? u : u.url))}</a>`).join(' · ') : ''}</small></p>` : ''}
        ${a.ballot_summary ? `<details open><summary>Official ballot summary</summary><p style="margin-top:8px">${esc(a.ballot_summary)}</p>${a.ballot_summary_note ? `<p class="muted"><small>${esc(a.ballot_summary_note)}</small></p>` : ''}</details>` : ''}
        <div class="grid grid-2" style="margin-top:14px">
          <div><h3>A "Yes" vote means</h3><p>${esc(a.what_yes_means || '')}</p></div>
          <div><h3>A "No" vote means</h3><p>${esc(a.what_no_means || '')}</p></div>
        </div>
        ${a.fiscal_impact ? `<h3>Estimated fiscal impact</h3><p>${esc(a.fiscal_impact)}${sourcesHtml(a.fiscal_impact_sources)}</p>` : ''}
        ${(a.neutral_analyses || []).length ? `<h3>Independent analyses</h3><ul>${a.neutral_analyses.map(n => `<li>${typeof n === 'string' ? esc(n) : `<strong>${esc(n.who || n.title || '')}</strong>${n.summary ? ': ' + esc(n.summary) : ''}${sourcesHtml(n.sources || (n.url ? [{url: n.url, title: n.title}] : []))}`}</li>`).join('')}</ul>` : ''}
        <div class="grid grid-2">
          <div><h3>Who supports it, and why</h3>${(a.supporters || []).length ? `<ul>${a.supporters.map(s => `<li><strong>${esc(s.who)}</strong>: ${esc(s.argument)}${sourcesHtml(s.sources)}</li>`).join('')}</ul>` : '<p class="empty">No organized support found.</p>'}</div>
          <div><h3>Who opposes it, and why</h3>${(a.opponents || []).length ? `<ul>${a.opponents.map(s => `<li><strong>${esc(s.who)}</strong>: ${esc(s.argument)}${sourcesHtml(s.sources)}</li>`).join('')}</ul>` : '<p class="empty">No organized opposition found.</p>'}</div>
        </div>
        ${sourcesHtml(a.sources)}
      </div>`).join('') : '<p class="empty">Amendment data pending.</p>'}`;
  }

  function viewJudges() {
    const j = DATA.judicial || {};
    const judges = j.judges || [];
    return `<h1>Judicial merit retention</h1>
      <p class="lead muted">${esc(j.how_it_works || j.how_merit_retention_works || 'Florida Supreme Court justices and District Court of Appeal judges do not run against opponents. Voters answer "Shall Justice/Judge X be retained in office?" A majority Yes gives a new six-year term; a majority No creates a vacancy the governor fills.')}${j.sources ? '' : ''}</p>
      ${sourcesHtml(j.sources || j.how_it_works_sources)}
      ${j.ballot_context ? `<p class="notice">${esc(j.ballot_context)}</p>` : ''}
      ${j.list_complete === false ? `<p class="notice notice-warn">This list may be incomplete: the full 2026 Fifth District Court of Appeal retention roster could not be confirmed from the Florida Bar during the last data review. Check your sample ballot for the exact names. ${esc(j.research_note || '')}</p>` : ''}
      ${j.not_on_2026_ballot_note ? `<p class="muted"><small>${esc(j.not_on_2026_ballot_note)}</small>${sourcesHtml(j.not_on_2026_sources)}</p>` : ''}
      <div class="stack section">${judges.length ? judges.map(x => `<div class="card cand-card">
        ${avatar(x, 'lg')}
        <div>
          <h3>${esc(x.name)}</h3>
          <div class="cand-meta"><span class="tag tag-level">${esc(x.court || '')}</span>${x.appointed_by ? `<span class="tag">Appointed by ${esc(x.appointed_by)}${x.appointed_year ? ` (${esc(x.appointed_year)})` : ''}</span>` : ''}</div>
          <p>${esc(x.background || '')}</p>
          ${x.notable ? `<p><strong>Notable:</strong> ${esc(x.notable)}</p>` : ''}
          ${x.bar_poll ? `<p><strong>Florida Bar retention poll:</strong> ${esc(x.bar_poll)}</p>` : ''}
          ${sourcesHtml(x.sources)}
        </div>
      </div>`).join('') : '<p class="empty">Judicial data pending.</p>'}</div>`;
  }

  function viewVote() {
    const v = DATA.voting_info || {};
    const soe = v.supervisor_of_elections || {};
    const row = (k, val) => val ? `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>` : '';
    return `<h1>How and where to vote in Sumter County</h1>
      <div class="card">
        <dl class="kv">
          ${row('Election Day', v.election_date)}${row('Polls open', v.election_day_hours)}${row('Register / update party by', v.registration_deadline)}
          ${row('Request a mail ballot by', v.vote_by_mail_request_deadline)}${row('Mail ballot must arrive by', v.vote_by_mail_return_deadline)}
          ${row('Early voting', v.early_voting_dates)}${row('Early voting hours', v.early_voting_hours)}${row('ID required', v.id_requirements)}
        </dl>
        <div class="btn-row">
          ${v.sample_ballot_url ? `<a class="btn btn-primary" href="${esc(v.sample_ballot_url)}" target="_blank" rel="noopener">My sample ballot ↗</a>` : ''}
          ${v.precinct_lookup_url ? `<a class="btn" href="${esc(v.precinct_lookup_url)}" target="_blank" rel="noopener">Find my precinct ↗</a>` : ''}
          <a class="btn" href="https://registertovoteflorida.gov/" target="_blank" rel="noopener">Register / check registration ↗</a>
        </div>
      </div>
      ${(v.early_voting_locations || []).length ? `<section class="section"><h2>Early voting locations</h2><div class="card"><ul>${v.early_voting_locations.map(l => `<li><strong>${esc(l.name)}</strong>${l.address ? ` — ${esc(l.address)}` : ''}</li>`).join('')}</ul></div></section>` : ''}
      <section class="section"><h2>Supervisor of Elections</h2><div class="card"><dl class="kv">${row('Office', soe.name)}${row('Phone', soe.phone)}${row('Address', soe.address)}</dl>${soe.website ? `<p><a href="${esc(soe.website)}" target="_blank" rel="noopener">${esc(soe.website)} ↗</a></p>` : ''}${sourcesHtml(v.sources)}</div></section>
      ${(v.unverified || []).length ? `<details class="section"><summary>Items we could not confirm on the county website</summary><ul style="margin-top:8px">${v.unverified.map(u => `<li>${esc(typeof u === 'string' ? u : (u.item || u.note || JSON.stringify(u)))}</li>`).join('')}</ul></details>` : ''}
      <p class="notice notice-warn">Dates and locations should be confirmed with the Supervisor of Elections before you vote; they are the official source.</p>`;
  }

  function viewAbout() {
    return `<h1>Methodology and neutrality rules</h1>
      <div class="card stack">
        <div><h2>What this guide is</h2><p>An independent voter guide for the November 3, 2026 general election as seen by a voter in Sumter County, Florida. It is not affiliated with any party, candidate, committee or government office, and it does not endorse anyone.</p></div>
        <div><h2>Sourcing rules</h2><ul>
          <li>Every factual claim links to its source: candidate websites and questionnaires, official government records (votes, bills, court filings, agency actions), campaign-finance filings, or reporting from established news outlets.</li>
          <li>Positions are described in the candidate's own words wherever possible. Opinion columns and attack ads are not used as evidence of what a candidate believes.</li>
          <li>Loaded labels are avoided. A position is described by what it is, not by how supporters or opponents characterize it.</li>
          <li>Both accomplishments and criticisms of incumbents appear only as documented facts (a vote, an action, a court ruling, a published fact-check), never as characterizations.</li>
        </ul></div>
        <div><h2>How positions are coded</h2><p>Each of the ${ISSUES.length} statements below is rated by voters on a five-point scale. Candidates are coded on the same scale (+2 strongly agrees through −2 strongly disagrees) from explicit statements ("stated") or from votes and official actions ("record"). When neither exists, the position is <strong>null / "No public position found"</strong>. Nothing is inferred from party label. Unknown positions are excluded from that candidate's match score and are listed openly on the profile, so a candidate with a thin public record shows a smaller evidence base rather than a fake score.</p>
        <ul>${ISSUES.map(i => `<li><strong>${esc(i.label)}:</strong> "${esc(i.statement)}" <small class="muted">(${(i.levels || []).join(', ')})</small></li>`).join('')}</ul></div>
        <div><h2>How the match score works</h2><p>For each statement you answered, agreement = 1 − |your answer − candidate stance| ÷ 4. Scores are averaged over the statements that apply to that office and for which the candidate has a documented position, with statements you mark "matters a lot" counted twice. A candidate needs at least three scorable statements to receive a percentage. Answers are stored only in your browser.</p></div>
        <div><h2>Which offices use which issues</h2><p>Federal races (U.S. Senate, U.S. House) are scored on federal issues such as Social Security, tariffs and foreign aid. State races (Governor, Cabinet, Florida House) are scored on state issues such as property taxes, insurance and school choice. County races are scored on growth, property taxes, public safety, housing and the environment. Positions a candidate has stated on issues outside their office's scope are still shown on the profile, in a separate section.</p></div>
        <div><h2>Limitations</h2><ul>
          <li>Information reflects what was publicly available as of the "last reviewed" date in the footer. Candidates change positions and new reporting appears; check the sources for anything that matters to you.</li>
          <li>Photos are official portraits or campaign images loaded from their original public locations; if one fails to load, initials are shown instead.</li>
          <li>The guide covers contested races that appear on the Sumter County ballot. Seats decided in the August primary or filled without opposition are listed under Races for completeness.</li>
        </ul></div>
      </div>`;
  }

  function notFound() { return `<h1>Not found</h1><p>That page does not exist. <a href="#/">Go home</a>.</p>`; }

  /* ---------- Router ---------- */
  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    const main = $('#main');
    let html = '', nav = 'home', after = null;
    if (parts.length === 0) { html = viewHome(); }
    else if (parts[0] === 'races') { html = viewRaces(); nav = 'races'; }
    else if (parts[0] === 'race' && parts[1]) { html = viewRace(decodeURIComponent(parts[1])); nav = 'races'; }
    else if (parts[0] === 'candidate' && parts[1]) { html = viewCandidate(decodeURIComponent(parts[1])); nav = 'races'; }
    else if (parts[0] === 'match' && parts[1] === 'results') { html = viewResults(); nav = 'match'; after = r => { const p = r.querySelector('[data-print]'); if (p) p.addEventListener('click', () => window.print()); }; }
    else if (parts[0] === 'match') { html = viewMatch(); nav = 'match'; after = bindMatch; }
    else if (parts[0] === 'amendments') { html = viewAmendments(); nav = 'amendments'; }
    else if (parts[0] === 'judges') { html = viewJudges(); nav = 'judges'; }
    else if (parts[0] === 'vote') { html = viewVote(); nav = 'vote'; }
    else if (parts[0] === 'about') { html = viewAbout(); nav = 'about'; }
    else { html = notFound(); }
    main.innerHTML = html;
    if (after) after(main);
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
    lastHash = location.hash; route();
  });
})();
