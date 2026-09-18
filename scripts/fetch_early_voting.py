"""Find each county Supervisor of Elections early-voting page and pull the General Election dates and hours for review.

Usage:  python3 scripts/fetch_early_voting.py [review.json]
Reads the supervisor websites from data/statewide.js (build it first with scripts/build_statewide.py), follows the
"Early Voting" link on each homepage, and writes one record per county: the page URL, every October/November date it
mentions, every "8 a.m. - 6 p.m."-style range, and the text around the first date. Nothing is written to
data/research/counties.json automatically: read the review file and update `early_voting` for each county by hand,
because many pages still show the August primary schedule or list sites with different hours. Some county sites block
automated requests (Cloudflare or Akamai); for those, open the page in a browser. The Division of Elections posts a
statewide list after Oct. 4, 2026 at
https://dos.fl.gov/elections/for-voters/voting/early-voting-and-secure-ballot-intake-stations/ ."""
import json, re, html, sys, subprocess, concurrent.futures as cf
from urllib.parse import urljoin
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
out_path = sys.argv[1] if len(sys.argv) > 1 else 'early_voting_review.json'
js = open('data/statewide.js', encoding='utf-8').read()
SW = json.loads(js[js.index('{'):js.rindex('}') + 1])
counties = [{'code': c['code'], 'name': c['name'], 'website': c['supervisor'].get('website')} for c in SW['counties'].values()]
existing = json.load(open('data/research/counties.json', encoding='utf-8'))['counties']
MON = {'october': 10, 'oct': 10, 'november': 11, 'nov': 11}

def get(u):
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n%{http_code} %{url_effective}', u], capture_output=True, text=True, errors='ignore')
    body, _, tail = r.stdout.rpartition('\n'); code, _, eff = tail.partition(' '); return code, eff, body

def text_of(h):
    t = re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->', '', h, flags=re.S); t = re.sub(r'<[^>]+>', ' ', t); return html.unescape(re.sub(r'\s+', ' ', t))

def ev_links(home_url):
    code, eff, body = get(home_url)
    links = []
    for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S | re.I):
        href, txt = m.group(1), html.unescape(re.sub(r'<[^>]+>', '', m.group(2))).strip()
        if (re.search(r'early\s*vot', txt, re.I) or re.search(r'early[-_]?vot', href, re.I)) and not re.search(r'poll watcher|regulation|dos\.myflorida|ballottrax|CivicAlerts', href + txt, re.I):
            links.append(urljoin(eff, href))
    seen, res = set(), []
    for h in links:
        if h not in seen: seen.add(h); res.append(h)
    return code, res

def extract(url):
    code, eff, body = get(url)
    if code != '200': return {'url': url, 'status': code}
    t = text_of(body)
    dates = []
    for m in re.finditer(r'\b(October|Oct\.?|November|Nov\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*2026)?', t, re.I):
        mo, d = MON[m.group(1).lower().rstrip('.')], int(m.group(2))
        if (mo == 10 and 17 <= d <= 31) or (mo == 11 and d <= 2): dates.append((mo, d, m.start()))
    hours = re.findall(r'\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*(?:–|-|—|to|until)\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))', t, re.I)
    rec = {'url': eff, 'status': code, 'dates': sorted({f'{a}/{b}' for a, b, _ in dates}), 'hours': [f'{a}-{b}' for a, b in hours[:6]], 'mentions_general': 'general' in t.lower()}
    if dates:
        i = min(x[2] for x in dates); rec['snippet'] = t[max(0, i - 150):i + 400]
    return rec

def one(c):
    known = (existing.get(c['name']) or {}).get('early_voting') or {}
    cands = [known['sites_url']] if known.get('sites_url') else []
    code, links = ev_links(c['website']) if c['website'] else ('n/a', [])
    cands += [l for l in links if l not in cands]
    best = None
    for u in cands[:3]:
        rec = extract(u)
        if rec.get('dates') and (best is None or len(rec['dates']) > len(best.get('dates', []))): best = rec
        elif best is None: best = rec
    return {'code': c['code'], 'name': c['name'], 'homepage_status': code, 'current': known, 'found': best}

with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(one, counties))
json.dump(res, open(out_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
for r in res:
    f = r['found'] or {}
    print(f"{r['name']:14} {f.get('status', '-'):4} dates={','.join(f.get('dates', []))} hours={'; '.join(f.get('hours', [])[:2])} general={f.get('mentions_general')} {f.get('url', '')}")
print('wrote', out_path)
