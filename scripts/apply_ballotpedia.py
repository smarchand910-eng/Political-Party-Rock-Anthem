"""Write scripts/fetch_ballotpedia.py results into data/research/*.json: website (if missing), photo (if missing), Ballotpedia link."""
import json, sys, glob
res = json.load(open(sys.argv[1]))
files = {}
for p in glob.glob('data/research/*.json'):
    raw = open(p, encoding='utf-8').read()
    try: d = json.loads(raw)
    except Exception: continue
    if not isinstance(d, dict) or not isinstance(d.get('candidates'), list): continue
    files[p] = (raw, d)
n = {'website': 0, 'photo': 0, 'link': 0}
for p, (raw, d) in files.items():
    changed = False
    for c in d['candidates']:
        r = res.get(c.get('id'))
        if not r or not r.get('ballotpedia'): continue
        if r.get('website') and not c.get('website'): c['website'] = r['website']; n['website'] += 1; changed = True
        if r.get('photo_url') and not c.get('photo_url'): c['photo_url'] = r['photo_url']; c['photo_source'] = r['photo_source']; n['photo'] += 1; changed = True
        links = c.get('links') or []
        if not any('ballotpedia.org' in (l.get('url') or '') for l in links):
            links.append({'title': 'Ballotpedia profile', 'url': r['ballotpedia']}); c['links'] = links; n['link'] += 1; changed = True
    if changed:
        ind = 1 if raw.startswith('{\n "') else 2
        open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + '\n')
print(n)
