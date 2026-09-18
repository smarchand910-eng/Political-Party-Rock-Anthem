"""Replace candidate photo URLs that no longer load with a local copy.

Usage:  python3 scripts/fix_photos.py
For each candidate whose photo_url is a Ballotpedia S3 thumbnail or a congress.gov member image (both patterns changed in
2026), the script finds the current image (the Ballotpedia infobox, or the unitedstates.github.io mirror of the official
congressional portrait), downloads it to assets/photos/<id>.jpg, and updates photo_url and photo_source. If nothing loads,
photo_url is cleared so the site shows initials instead of a broken image."""
import json, re, glob, html, subprocess, os, time
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
def get(url, binary=False):
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True, text=not binary)
    if binary: body, _, code = r.stdout.rpartition(b'\n'); return code.decode(), body
    body, _, code = r.stdout.rpartition('\n'); return code, body
def ok_image(code, data): return code == '200' and len(data) > 3000 and data[:3] == b'\xff\xd8\xff'
def save(cid, data): os.makedirs('assets/photos', exist_ok=True); open(f'assets/photos/{cid}.jpg', 'wb').write(data); return f'assets/photos/{cid}.jpg'
def from_ballotpedia(page_name):
    code, page = get('https://ballotpedia.org/' + page_name)
    if code != '200' or 'class="infobox person"' not in page: return None
    i = page.find('class="infobox person"'); box = page[i:i + 8000]
    imgs = [html.unescape(u) for u in re.findall(r'<img[^>]+src="([^"]+)"', box) if 'SubmitPhoto' not in u]
    for u in imgs[:1] + [imgs[0].replace('/thumbs/200/300/', '/')] if imgs else []:
        code, data = get(u, binary=True)
        if ok_image(code, data): return data
    return None
n = {'fixed': 0, 'cleared': 0, 'checked': 0}
for p in sorted(glob.glob('data/research/*.json')):
    raw = open(p, encoding='utf-8').read()
    try: d = json.loads(raw)
    except Exception: continue
    if not isinstance(d, dict) or not isinstance(d.get('candidates'), list): continue
    changed = False
    for c in d['candidates']:
        u = c.get('photo_url') or ''
        if not u.startswith('http'): continue
        code, data = get(u, binary=True)
        if ok_image(code, data): continue
        if code not in ('404', '410'): continue   # blocked or slow, not gone: leave it alone
        n['checked'] += 1
        new = None
        m = re.search(r'ballotpedia-api4/files/(?:thumbs/\d+/\d+/)?([^/]+)\.(?:jpg|jpeg|png)$', u, re.I)
        if m: new = from_ballotpedia(m.group(1)); time.sleep(0.5)
        m2 = re.search(r'congress\.gov/img/member/([a-z]\d{6})', u, re.I)
        if m2 and new is None:
            code, data = get(f'https://unitedstates.github.io/images/congress/225x275/{m2.group(1).upper()}.jpg', binary=True)
            if ok_image(code, data): new = data; src = 'Official congressional portrait (unitedstates.github.io mirror of the Congressional Pictorial Directory; downloaded copy in assets/photos)'
        if new is not None:
            c['photo_url'] = save(c['id'], new)
            c['photo_source'] = src if m2 and not m else 'Ballotpedia candidate photo (downloaded copy in assets/photos)'
            n['fixed'] += 1; changed = True; print('fixed', c['id'])
        else:
            c['photo_url'] = None; c['photo_source'] = None; n['cleared'] += 1; changed = True; print('cleared', c['id'], u)
    if changed:
        ind = 1 if raw.startswith('{\n "') else 2
        open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + '\n')
print(n)
