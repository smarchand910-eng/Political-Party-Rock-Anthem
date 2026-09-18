"""Swap dead source links for their Wayback Machine copies.

Usage:  python3 scripts/archive_dead_links.py report.md      (report from scripts/check_links.py)
For every link under "Dead links" that is not an image, asks archive.org for the closest snapshot and, when one exists,
replaces the URL in the research files with the archived URL (the source title and date are kept). Links with no snapshot
are printed for manual replacement. Photo URLs are left to scripts/fix_photos.py."""
import re, sys, json, glob, subprocess, time
report = open(sys.argv[1], encoding='utf-8').read()
sec = report.split('## Dead links')[1].split('## Could not')[0] if '## Dead links' in report else ''
dead = [m.group(1) for m in re.finditer(r'^- (\S+) — ', sec, re.M)]
dead = [u for u in dead if not re.search(r'\.(jpg|jpeg|png|gif|webp)$', u, re.I)]
files = {p: open(p, encoding='utf-8').read() for p in glob.glob('data/research/*.json')}
swapped, none = 0, []
for u in dead:
    snap = None
    for attempt in range(3):   # archive.org rate-limits bursts; back off and retry
        r = subprocess.run(['curl', '-s', '--max-time', '30', '-A', 'flvotersguide-linkcheck', 'https://archive.org/wayback/available?url=' + u], capture_output=True, text=True)
        try: snap = json.loads(r.stdout)['archived_snapshots']['closest']['url']; break
        except Exception:
            if '429' in r.stdout: time.sleep(20 * (attempt + 1)); continue
            break
    time.sleep(4)
    if not snap: none.append(u); continue
    snap = snap.replace('http://web.archive.org', 'https://web.archive.org')
    for p, s in files.items():
        if u in s: files[p] = s.replace(u, snap); swapped += 1; print('archived', u, '->', snap, 'in', p.split('/')[-1])
for p, s in files.items():
    if s != open(p, encoding='utf-8').read(): open(p, 'w', encoding='utf-8').write(s)
print('replacements', swapped); print('no snapshot:'); [print('  ' + u) for u in none]
