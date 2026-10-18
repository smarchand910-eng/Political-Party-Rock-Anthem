"""Apply status_change entries (withdrawals etc.) and _debates from a validated spec to the research files.
Usage: python3 scripts/apply_status.py spec.clean.json"""
import json, sys
spec = json.load(open(sys.argv[1], encoding='utf-8'))
n = 0
for rid, cands in spec.items():
    if rid.startswith('_'): continue
    changes = {cid: sp['status_change'] for cid, sp in cands.items() if isinstance(sp, dict) and sp.get('status_change')}
    if not changes: continue
    p = f'data/research/{rid}.json'; raw = open(p, encoding='utf-8').read(); d = json.loads(raw)
    for c in d['candidates']:
        sc = changes.get(c['id'])
        if not sc: continue
        c['withdrawn'] = sc.get('withdrawn') or 'Withdrew'
        c['withdrawn_note'] = sc.get('note'); c['withdrawn_sources'] = sc.get('sources'); n += 1
    ind = 1 if raw.startswith('{\n "') else 2
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + '\n')
for ev in spec.get('_debates') or []:
    rid = ev.get('race_id'); p = f'data/research/{rid}.json'
    try: raw = open(p, encoding='utf-8').read(); d = json.loads(raw)
    except Exception: print('skip debate for unknown race', rid); continue
    d.setdefault('events', [])
    import re as _re
    day = lambda x: _re.sub(r'\s*—.*$', '', str(x.get('date') or '')).strip()
    # A "checked, nothing scheduled" line has no real date; the newest check replaces older ones.
    is_check = lambda x: not _re.match(r'\d{4}-\d{2}-\d{2}', day(x)) and _re.match(r'\s*no\b', str(x.get('host') or ''), _re.I)
    entry = {k: ev.get(k) for k in ('date', 'host', 'who', 'sources') if ev.get(k)}
    if is_check(ev):
        d['events'] = [e for e in d['events'] if not is_check(e)] + [entry]; n += 1
    else:
        same = [i for i, e in enumerate(d['events']) if (day(e) == day(ev) and day(ev)) or (not day(ev) and e.get('host') == ev.get('host'))]
        if same:
            # newer reporting wins: a forum that was "scheduled" last week and "held" now must read as held
            d['events'][same[0]] = entry; n += 1
        else:
            d['events'].append(entry); n += 1
    ind = 1 if raw.startswith('{\n "') else 2
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + '\n')
print('applied', n)
