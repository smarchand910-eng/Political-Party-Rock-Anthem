"""Check every source link in the research files and report the ones that are gone.

Usage:  python3 scripts/check_links.py [report.md]      (exit status 1 when dead links were found)
A link counts as dead only on a definite answer: HTTP 404/410, a DNS failure, or a connection that could not be made.
Sites that answer 403/429/503 or time out are listed separately as "could not verify" (many campaign and news sites
block automated requests), never as dead. Only research JSON under data/research is scanned."""
import json, re, sys, glob, subprocess, concurrent.futures as cf, collections
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
out_path = sys.argv[1] if len(sys.argv) > 1 else None
links = collections.defaultdict(set)   # url -> files
for p in sorted(glob.glob('data/research/*.json')):
    raw = open(p, encoding='utf-8').read()
    for u in set(re.findall(r'https?://[^\s"\'<>\\]+', raw)):
        u = u.rstrip('.,;')
        if u.endswith(')') and u.count('(') < u.count(')'): u = u[:-1]
        links[u].add(p.split('/')[-1])
def probe(u):
    r = subprocess.run(['curl', '-sS', '-o', '/dev/null', '-L', '--max-time', '25', '-A', UA, '-w', '%{http_code} %{exitcode}', u], capture_output=True, text=True)
    code, _, exit_ = r.stdout.strip().partition(' ')
    if code in ('000', '') and exit_ in ('6', '7'): return u, 'dead', f'no connection (curl {exit_})'
    if code in ('404', '410'): return u, 'dead', f'HTTP {code}'
    if code.startswith('2') or code.startswith('3'): return u, 'ok', code
    return u, 'unverified', f'HTTP {code}' if code not in ('000', '') else f'timeout/curl {exit_}'
with cf.ThreadPoolExecutor(16) as ex: results = list(ex.map(probe, sorted(links)))
dead = [(u, why) for u, st, why in results if st == 'dead']
unv = [(u, why) for u, st, why in results if st == 'unverified']
lines = [f'# Source link check', '', f'{len(results)} distinct links checked: {len(results) - len(dead) - len(unv)} reachable, {len(dead)} dead, {len(unv)} could not be verified automatically.', '']
if dead:
    lines += ['## Dead links (replace with an archived copy or another source)', '']
    for u, why in dead: lines.append(f'- {u} — {why} — in {", ".join(sorted(links[u]))}')
    lines.append('')
if unv:
    lines += ['## Could not verify (site blocks automated requests or timed out; check by hand if the file matters)', '']
    for u, why in unv: lines.append(f'- {u} — {why} — in {", ".join(sorted(links[u]))}')
report = '\n'.join(lines) + '\n'
if out_path: open(out_path, 'w', encoding='utf-8').write(report)
print(report if not out_path else lines[2])
sys.exit(1 if dead else 0)
