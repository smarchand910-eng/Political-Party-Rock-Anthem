"""Verify that every Ballotpedia link in the guide points at the right person.

Usage:  python3 scripts/check_ballotpedia_links.py report.json
A link is accepted when the page mentions Florida and 2026 and, for a district race, the district number, or the county
for a county race. Anything else is reported for review: Ballotpedia has many same-name pages (another state, another
office, another decade), and a wrong profile link is worse than none."""
import json, re, sys, html, subprocess, time
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
out_path = sys.argv[1] if len(sys.argv) > 1 else 'ballotpedia_link_report.json'
js = open('data/guide.js', encoding='utf-8').read(); D = json.loads(js[js.index('{'):js.rindex('}') + 1])
def text_of(h):
    h = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S)
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)))
bad, ok = [], 0
for r in D['races']:
    j = r.get('jurisdiction') or {}
    for c in r['candidates']:
        for l in (c.get('links') or []):
            u = l.get('url') or ''
            if 'ballotpedia.org' not in u: continue
            res = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n%{http_code}', u], capture_output=True, text=True, errors='ignore')
            body, _, code = res.stdout.rpartition('\n'); time.sleep(0.4)
            t = text_of(body)
            why = []
            if code != '200': why.append(f'HTTP {code}')
            else:
                if 'Florida' not in t: why.append('page never says Florida')
                if '2026' not in t: why.append('page never says 2026')
                if j.get('type') in ('cd', 'sd', 'hd') and j.get('id') and not re.search(r'District\s+%s\b' % j['id'], t):
                    why.append(f"page never says District {j['id']}")
                if j.get('type') == 'county' and (r.get('counties') or []) and not any(cn in t for cn in r['counties']):
                    why.append('page never names the county')
                last = c['name'].split()[-1]
                if last.lower() not in t[:400].lower(): why.append('name not in page title')
            if why: bad.append({'race': r['id'], 'candidate': c['id'], 'name': c['name'], 'url': u, 'why': why, 'title': t.strip()[:90]})
            else: ok += 1
json.dump(bad, open(out_path, 'w', encoding='utf-8'), indent=1)
print(f'checked {ok + len(bad)} Ballotpedia links: {ok} verified, {len(bad)} need review -> {out_path}')
for b in bad: print(f"  {b['name']:28} {b['race']:32} {'; '.join(b['why'])}\n      {b['url']}")
