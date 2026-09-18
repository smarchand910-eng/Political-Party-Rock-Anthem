#!/usr/bin/env python3
"""For candidates with a campaign website but no photo, read the site's Open Graph / Twitter image tag and
record it as photo_url (photo_source = campaign website). Writes results to data/og_photos.json and applies
them with --write. Usage: python3 scripts/fetch_og_photos.py [--write]
"""
import json, glob, re, sys, urllib.request, html

WRITE = '--write' in sys.argv
OUT = 'data/og_photos.json'
found = json.load(open(OUT)) if __import__('os').path.exists(OUT) else {}

def og_image(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (voter guide build)'})
    s = urllib.request.urlopen(req, timeout=25).read(400000).decode('utf-8', errors='ignore')
    for pat in (r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)', r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)'):
        m = re.search(pat, s, flags=re.I)
        if m:
            u = html.unescape(m.group(1)).strip()
            if u.startswith('//'): u = 'https:' + u
            if u.startswith('/'): u = re.match(r'https?://[^/]+', url).group(0) + u
            if re.search(r'logo|icon|favicon|banner', u, re.I): return None
            return u
    return None

for f in sorted(glob.glob('data/research/*.json')):
    raw = open(f, encoding='utf-8').read(); d = json.loads(raw)
    if not isinstance(d.get('candidates'), list): continue
    changed = False
    for c in d['candidates']:
        if c.get('photo_url') or c.get('withdrawn') or not c.get('website'): continue
        cid = c['id']
        if cid not in found:
            try: found[cid] = og_image(c['website'])
            except Exception as e: found[cid] = None; print('ERR', cid, str(e)[:60])
            json.dump(found, open(OUT, 'w'), indent=1)
            print(cid, '->', found[cid])
        if WRITE and found.get(cid):
            c['photo_url'] = found[cid]; c['photo_source'] = f"Campaign website ({c['website']}), Open Graph image"; changed = True
    if changed:
        open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1 if raw.startswith('{\n "') else 2) + '\n')
print('images found', sum(1 for v in found.values() if v), 'of', len(found))
