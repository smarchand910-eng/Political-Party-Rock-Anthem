"""Check a research spec (the add_positions.py input format, optionally with status_change/_debates/_amendments keys)
against the current data before applying it: race and candidate ids must exist, issue ids must exist and apply to the
race's level, stances must be -2..2, every position needs a source with an http URL and a date, quotes stay under 60 words.
Usage: python3 scripts/validate_spec.py spec.json [--strip]   (--strip writes spec.clean.json with the bad entries removed)"""
import json, sys, re
spec_path = sys.argv[1]; strip = '--strip' in sys.argv
spec = json.load(open(spec_path, encoding='utf-8'))
js = open('data/guide.js', encoding='utf-8').read(); D = json.loads(js[js.index('{'):js.rindex('}') + 1])
races = {r['id']: r for r in D['races']}
issues = {i['id']: i for i in json.load(open('data/issues.json', encoding='utf-8'))['issues']}
problems = []; kept = {}
def src_ok(s):
    if isinstance(s, (list, tuple)): s = {'title': s[0], 'url': s[1], 'date': s[2] if len(s) > 2 else None}
    return isinstance(s, dict) and isinstance(s.get('url'), str) and s['url'].startswith('http') and isinstance(s.get('date'), str) and re.match(r'^\d{4}-\d{2}(-\d{2})?$', s['date'])
for rid, cands in spec.items():
    if rid.startswith('_'): kept[rid] = cands; continue
    r = races.get(rid)
    if not r: problems.append(f'unknown race {rid}'); continue
    byid = {c['id']: c for c in r['candidates']}
    for cid, sp in cands.items():
        if cid not in byid: problems.append(f'{rid}: unknown candidate {cid}'); continue
        out = {}; cur = byid[cid]
        if sp.get('website') and not cur.get('website'): out['website'] = sp['website']
        if sp.get('occupation') and not cur.get('occupation'): out['occupation'] = sp['occupation']
        if sp.get('background') and len(cur.get('background') or '') < 80 and len(str(sp['background'])) > 40: out['background'] = sp['background']
        pos = {}
        for iid, v in (sp.get('positions') or {}).items():
            if iid not in issues: problems.append(f'{rid}/{cid}: unknown issue {iid}'); continue
            if r.get('level') not in (issues[iid].get('levels') or []): problems.append(f'{rid}/{cid}: issue {iid} not used at level {r.get("level")}'); continue
            if not isinstance(v, list) or len(v) < 4: problems.append(f'{rid}/{cid}/{iid}: malformed'); continue
            st, summ, quote, srcs = v[:4]
            if st not in (-2, -1, 0, 1, 2): problems.append(f'{rid}/{cid}/{iid}: stance {st}'); continue
            if not summ or len(str(summ)) < 15: problems.append(f'{rid}/{cid}/{iid}: no summary'); continue
            srcs = [s for s in (srcs or []) if src_ok(s)]
            if not srcs: problems.append(f'{rid}/{cid}/{iid}: no usable source'); continue
            if quote and len(str(quote).split()) > 60: quote = ''
            conf = v[4] if len(v) > 4 and v[4] in ('stated', 'record') else 'stated'
            pos[iid] = [st, summ, quote or '', [[s[0], s[1], s[2]] if isinstance(s, list) else [s.get('title') or '', s['url'], s['date']] for s in srcs], conf]
        if pos: out['positions'] = pos
        for k in ('other_issues', 'record', 'endorsements'):
            items = [x for x in (sp.get(k) or []) if isinstance(x, dict) and any(src_ok(s) for s in (x.get('sources') or []))]
            for x in items: x['sources'] = [s for s in x['sources'] if src_ok(s)]
            if items: out[k] = items
        sc = sp.get('status_change')
        if sc and isinstance(sc, dict) and any(src_ok(s) for s in (sc.get('sources') or [])): out['status_change'] = sc
        elif sc: problems.append(f'{rid}/{cid}: status_change without a usable source')
        if out: kept.setdefault(rid, {})[cid] = out
npos = sum(len(c.get('positions', {})) for r in kept.values() if isinstance(r, dict) for c in r.values() if isinstance(c, dict))
print(f'{spec_path}: {len(problems)} problems, kept {sum(1 for r in kept.values() if isinstance(r, dict) for c in r.values() if isinstance(c, dict))} candidates, {npos} positions')
for p in problems[:60]: print('  -', p)
if strip: json.dump(kept, open(spec_path.replace('.json', '.clean.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('wrote', spec_path.replace('.json', '.clean.json'))
