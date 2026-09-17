#!/usr/bin/env python3
"""Merge the JSON research files into data/guide.js so the site runs without a server.

Usage:  python3 scripts/build_data.py
Inputs: data/issues.json, data/races.json, data/research/*.json
Output: data/guide.js  (window.GUIDE_DATA = {...})
"""
import json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
RESEARCH = os.path.join(DATA, 'research')

def load(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default

def main():
    issues = load(os.path.join(DATA, 'issues.json'))['issues']
    issue_ids = {i['id'] for i in issues}
    races_meta = load(os.path.join(DATA, 'races.json'))['races']
    supplements = (load(os.path.join(RESEARCH, 'supplements.json'), {}) or {}).get('candidates', {})
    races = []
    problems = []
    IMG_RE = re.compile(r'\.(jpe?g|png|webp|gif)(\?.*)?$', re.I)
    IMG_HOST_OK = ('Special:FilePath', 'congress.gov/img/member', 'ballotpedia-api4', 'FileStores/Web/Imaging')
    for meta in races_meta:
        r = dict(meta)
        research = load(os.path.join(RESEARCH, f"{meta['id']}.json"), {})
        note = research.get('verified_ballot_note') or ''
        urls = re.findall(r'https?://[^\s;)\]]+', note)
        text = re.split(r'\bSources?:', note)[0].strip()
        text = re.sub(r'\(?https?://[^\s;)\]]+\)?', '', text).strip()
        r['verified_ballot_note'] = text
        r['verified_ballot_sources'] = [{'title': re.sub(r'^www\.', '', u.split('/')[2]), 'url': u.rstrip('.,')} for u in urls]
        cands = []
        for c in research.get('candidates', []):
            c = dict(c)
            positions = c.get('positions') or {}
            # --- editor supplements: fill null stances only, append record/other_issues ---
            sup = supplements.get(c.get('id'))
            if sup:
                for iid, sp in (sup.get('positions') or {}).items():
                    cur = positions.get(iid)
                    if not cur or cur.get('stance') is None:
                        positions[iid] = sp
                for key in ('record', 'other_issues', 'endorsements'):
                    if sup.get(key):
                        c[key] = (c.get(key) or []) + sup[key]
            # --- photo sanity: only keep URLs that look like image files; move page URLs into links ---
            purl = c.get('photo_url')
            if purl and not (IMG_RE.search(purl) or any(k in purl for k in IMG_HOST_OK)):
                c.setdefault('links', []).append({'title': 'Official page / photo source', 'url': purl})
                c['photo_url'] = None
            if c.get('withdrawn'):
                c['party'] = c.get('party') or 'No Party Affiliation'
            for iid in issue_ids:
                p = positions.get(iid)
                if not p:
                    positions[iid] = {'stance': None, 'confidence': 'unknown', 'summary': 'No public position found as of Sept 2026.', 'quote': None, 'sources': []}
                    continue
                st = p.get('stance')
                if st is not None:
                    try:
                        st = int(st)
                    except (TypeError, ValueError):
                        problems.append(f"{c.get('id')}: bad stance {st!r} on {iid}")
                        st = None
                    if st is not None and not -2 <= st <= 2:
                        problems.append(f"{c.get('id')}: stance out of range on {iid}")
                        st = max(-2, min(2, st))
                    if st is not None and not p.get('sources'):
                        problems.append(f"{c.get('id')}: coded stance on {iid} has no sources -> set to unknown")
                        st = None
                p['stance'] = st
                if st is None and p.get('confidence') != 'unknown':
                    p['confidence'] = 'unknown'
                positions[iid] = p
            unknown_extra = [k for k in positions if k not in issue_ids]
            for k in unknown_extra:
                problems.append(f"{c.get('id')}: unknown issue id {k} dropped")
                positions.pop(k)
            c['positions'] = positions
            cands.append(c)
        r['candidates'] = cands
        if not cands:
            problems.append(f"race {meta['id']}: no candidates (research file missing?)")
        races.append(r)

    voting = load(os.path.join(RESEARCH, 'voting_info.json'), {}) or {}
    voting.setdefault('short', {
        'election_date': 'Tue, Nov 3, 2026',
        'registration_deadline': 'Mon, Oct 5, 2026',
        'vote_by_mail_request_deadline': 'Thu, Oct 22, 2026 (5 p.m.)',
        'early_voting_dates': 'Oct 24 – Oct 31 (confirm county hours)',
    })
    out = {
        'generated_at': datetime.date.today().strftime('%B %d, %Y'),
        'issues': issues,
        'races': races,
        'amendments': (load(os.path.join(RESEARCH, 'amendments.json'), {}) or {}).get('amendments', []),
        'judicial': load(os.path.join(RESEARCH, 'judicial.json'), {}) or {},
        'voting_info': voting,
        'other_races': load(os.path.join(RESEARCH, 'county_commission_other.json'), {}) or {},
        'school_board': load(os.path.join(RESEARCH, 'school_board_results.json'), {}) or {},
    }
    js = 'window.GUIDE_DATA = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
    with open(os.path.join(DATA, 'guide.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    ncand = sum(len(r['candidates']) for r in races)
    print(f"wrote data/guide.js: {len(races)} races, {ncand} candidates, {len(out['amendments'])} amendments, {len(out['judicial'].get('judges', []))} judges")
    for p in problems:
        print('WARN', p)
    return 0

if __name__ == '__main__':
    sys.exit(main())
