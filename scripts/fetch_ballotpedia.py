"""Look up candidates on Ballotpedia and collect what the guide is missing: campaign website, a portrait, and the profile link.

Usage:  python3 scripts/fetch_ballotpedia.py needs.json out.json [--photos]
  needs.json: [{id, name, race_id, title, jur:{type,district?}, website, photo, counties?}] (see scripts/README.md)
  out.json:   {cand_id: {website, photo_url, photo_source, ballotpedia}}  (only fields that were found)
The page must be a person infobox that mentions Florida and 2026 and, for district races, the district number; otherwise it is skipped.
Photos are downloaded to assets/photos/<id>.jpg when --photos is given and the candidate has none."""
import json, re, sys, time, html, subprocess, os
from urllib.parse import quote
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
needs = json.load(open(sys.argv[1])); outp = sys.argv[2]; want_photos = '--photos' in sys.argv
out = json.load(open(outp)) if os.path.exists(outp) else {}

def get(url, binary=False):
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True, text=not binary, errors=None if binary else 'ignore')
    if binary:
        body, _, code = r.stdout.rpartition(b'\n'); return code.decode(), body
    body, _, code = r.stdout.rpartition('\n'); return code, body

def variants(name):
    n = re.sub(r'\s*["“(].*?[")”]\s*', ' ', name)  # drop nicknames in quotes/parens
    n = re.sub(r',?\s+(Jr\.?|Sr\.?|II|III|IV)$', '', n.strip(), flags=re.I)
    toks = [t for t in n.split() if t]
    v = [' '.join(toks)]
    noinit = [t for t in toks if not re.fullmatch(r'[A-Z]\.?', t)]
    if noinit != toks: v.append(' '.join(noinit))
    if len(noinit) > 2: v.append(noinit[0] + ' ' + noinit[-1])
    v += [x + ' (Florida)' for x in list(v)]
    seen = set(); res = []
    for x in v:
        if x not in seen: seen.add(x); res.append(x)
    return res

def text_of(h):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S); t = re.sub(r'<[^>]+>', ' ', t); return html.unescape(re.sub(r'\s+', ' ', t))

def check(page, c):
    if 'class="infobox person"' not in page: return False
    t = text_of(page)
    if 'may refer to' in t[:3000]: return False
    if 'Florida' not in t or '2026' not in t: return False
    j = c.get('jur') or {}
    if j.get('type') in ('cd', 'sd', 'hd') and j.get('district') and not re.search(r'District\s+%s\b' % j['district'], t): return False
    if j.get('type') == 'county' and c.get('counties') and not any(cn in t for cn in c['counties']): return False
    return True

done = 0
for c in needs:
    if c['id'] in out: continue
    found = None
    for v in variants(c['name']):
        url = 'https://ballotpedia.org/' + quote(v.replace(' ', '_'))
        code, page = get(url); time.sleep(0.6)
        if code != '200': continue
        if check(page, c): found = (url, page); break
    rec = {}
    if found:
        url, page = found
        rec['ballotpedia'] = url
        m = re.search(r'<a href="([^"]+)"[^>]*>\s*Campaign website\s*</a>', page)
        if m and not c.get('website'): rec['website'] = html.unescape(m.group(1))
        i = page.find('class="infobox person"'); box = page[i:i + 8000]
        imgs = [u for u in re.findall(r'<img[^>]+src="([^"]+)"', box) if 'SubmitPhoto' not in u and 'placeholder' not in u.lower()]
        if imgs and not c.get('photo'):
            img = html.unescape(imgs[0]).replace('/thumbs/200/300/', '/')
            if want_photos:
                code2, data = get(img, binary=True)
                if code2 == '200' and len(data) > 3000 and data[:3] == b'\xff\xd8\xff':
                    os.makedirs('assets/photos', exist_ok=True)
                    open(f'assets/photos/{c["id"]}.jpg', 'wb').write(data)
                    rec['photo_url'] = f'assets/photos/{c["id"]}.jpg'; rec['photo_source'] = 'Ballotpedia candidate photo (downloaded copy in assets/photos)'
                else:
                    code2, data = get(imgs[0], binary=True)
                    if code2 == '200' and len(data) > 3000 and data[:3] == b'\xff\xd8\xff':
                        open(f'assets/photos/{c["id"]}.jpg', 'wb').write(data)
                        rec['photo_url'] = f'assets/photos/{c["id"]}.jpg'; rec['photo_source'] = 'Ballotpedia candidate photo (downloaded copy in assets/photos)'
    out[c['id']] = rec
    done += 1
    if done % 10 == 0:
        json.dump(out, open(outp, 'w'), indent=1); print(done, c['id'], rec, flush=True)
json.dump(out, open(outp, 'w'), indent=1)
hits = sum(1 for v in out.values() if v.get('ballotpedia'))
print('candidates', len(out), 'found on Ballotpedia', hits, 'websites', sum(1 for v in out.values() if v.get('website')), 'photos', sum(1 for v in out.values() if v.get('photo_url')))
