#!/usr/bin/env python3
"""Download candidate/judge portraits listed in data/photo_urls.txt into assets/photos/.

Run this on a normal internet connection (the hosted research sandbox could not reach most sites):

    python3 scripts/fetch_photos.py && python3 scripts/build_data.py

data/photo_urls.txt format: one `<id> <image-url>` per line. Lines starting with # are ignored.
Candidate ids are the "id" fields in data/research/*.json; judge ids are judge_<name_slug>
(e.g. judge_carlos_g_muniz, judge_john_m_harris, judge_scott_d_makar, judge_f_rand_wallis).
Images are saved as assets/photos/<id>.jpg (or .png) and used automatically by the site.
"""
import os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, 'data', 'photo_urls.txt')
OUT = os.path.join(ROOT, 'assets', 'photos')

def main():
    if not os.path.exists(LIST):
        print('no data/photo_urls.txt found'); return 1
    os.makedirs(OUT, exist_ok=True)
    ok = 0
    for line in open(LIST, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'): continue
        cid, url = line.split(None, 1)
        ext = 'png' if url.lower().split('?')[0].endswith('.png') else 'jpg'
        dest = os.path.join(OUT, f'{cid}.{ext}')
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (voter guide photo fetch)'})
            data = urllib.request.urlopen(req, timeout=20).read()
            if len(data) < 2000: raise ValueError('response too small to be a photo')
            open(dest, 'wb').write(data); ok += 1; print('saved', dest)
        except Exception as e:
            print('FAILED', cid, url, '->', e)
    print(f'{ok} photos saved. Now run: python3 scripts/build_data.py')
    return 0

if __name__ == '__main__':
    sys.exit(main())
