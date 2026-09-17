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
    known_ids = {m['id'] for m in races_meta}
    # Auto-register statewide race files (us_house_<n>, state_senate_<n>, state_house_<n>, county_<x>) that carry their own metadata
    ORDER_BY_TYPE = {'statewide': 10, 'cd': 20, 'sd': 40, 'hd': 50, 'county': 60}
    for fn in sorted(os.listdir(RESEARCH)):
        if not fn.endswith('.json') or fn.startswith('_'): continue
        rid = fn[:-5]
        if rid in known_ids or not re.match(r'^(us_house_\d+|state_senate_\d+|state_house_\d+|county_[a-z0-9_]+)$', rid): continue
        rf = load(os.path.join(RESEARCH, fn), {}) or {}
        if not rf.get('title') or not rf.get('jurisdiction'): continue
        num = int(rf['jurisdiction'].get('id')) if str(rf['jurisdiction'].get('id', '')).isdigit() else 0
        races_meta.append({'id': rid, 'order': ORDER_BY_TYPE.get(rf['jurisdiction']['type'], 90) * 1000 + num, 'title': rf['title'], 'level': rf.get('level', 'state'),
                           'office_group': rf.get('office_group', 'State'), 'term': rf.get('term', ''), 'what_it_does': rf.get('what_it_does', ''),
                           'jurisdiction': rf['jurisdiction'], 'counties': rf.get('counties', []), 'coverage': rf.get('coverage', 'roster'),
                           'on_november_ballot': rf.get('on_november_ballot', True), 'decided_note': rf.get('decided_note'), 'kind': rf.get('kind', 'race'),
                           'ballot_summary': rf.get('ballot_summary'), 'what_yes_means': rf.get('what_yes_means'), 'what_no_means': rf.get('what_no_means')})
        known_ids.add(rid)
    # Sumter-era races keep their hand-written order (1..8) but sit inside the same groups
    for m in races_meta:
        if m['id'] in ('us_senate_special','governor','attorney_general','cfo','agriculture_commissioner'): m['order'] = 10000 + m['order']
        elif m['id'] == 'us_house_11': m['order'] = 20011
        elif m['id'] == 'state_house_52': m['order'] = 50052
        elif m['id'] == 'county_commission_4': m['order'] = 60000
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
            # --- local photo (assets/photos/<id>.jpg|jpeg|png) takes precedence ---
            for ext in ('jpg', 'jpeg', 'png'):
                lp = os.path.join(ROOT, 'assets', 'photos', f"{c.get('id')}.{ext}")
                if os.path.exists(lp):
                    c['photo_local'] = f"assets/photos/{c.get('id')}.{ext}"
                    c['photo_source'] = 'Ballotpedia candidate photo (downloaded copy in assets/photos)'
                    break
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
        if not cands and meta.get('kind', 'race') != 'measure':
            problems.append(f"race {meta['id']}: no candidates (research file missing?)")
        races.append(r)

    voting = load(os.path.join(RESEARCH, 'voting_info.json'), {}) or {}
    voting.setdefault('short', {
        'election_date': 'Tue, Nov 3, 2026',
        'registration_deadline': 'Mon, Oct 5, 2026',
        'vote_by_mail_request_deadline': 'Thu, Oct 22, 2026 (5 p.m.)',
        'early_voting_dates': 'Oct 24 – Oct 31 (confirm county hours)',
    })
    judicial = load(os.path.join(RESEARCH, 'judicial.json'), {}) or {}
    for j in judicial.get('judges', []):
        slug = 'judge_' + re.sub(r'[^a-z_]', '', j['name'].lower().replace(' ', '_').replace('ñ', 'n'))
        for ext in ('jpg', 'jpeg', 'png'):
            if os.path.exists(os.path.join(ROOT, 'assets', 'photos', f'{slug}.{ext}')):
                j['photo_local'] = f'assets/photos/{slug}.{ext}'
                break
    out = {
        'generated_at': datetime.date.today().strftime('%B %d, %Y'),
        'issues': issues,
        'races': races,
        'amendments': (load(os.path.join(RESEARCH, 'amendments.json'), {}) or {}).get('amendments', []),
        'judicial': judicial,
        'voting_info': voting,
        'other_races': load(os.path.join(RESEARCH, 'county_commission_other.json'), {}) or {},
        'florida': load(os.path.join(DATA, 'florida.json'), {}) or {},
        'counties': (load(os.path.join(RESEARCH, 'counties.json'), {}) or {}).get('counties', {}),
        'coverage': {fn[1:-5]: load(os.path.join(RESEARCH, fn), {}) for fn in os.listdir(RESEARCH) if fn.startswith('_coverage') and fn.endswith('.json')},
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
