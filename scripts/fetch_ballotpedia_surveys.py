"""Collect Ballotpedia Candidate Connection survey answers for candidates in the guide.

Usage:  python3 scripts/fetch_ballotpedia_surveys.py out.json [--only-thin]
Ballotpedia's survey answers are the candidate's own words and are often the only public statement a minor-party or
first-time candidate has made, but the pages are invisible to some fetchers, so this script pulls them with a plain
HTTP request. It writes, per candidate, the survey date and the question/answer text for a human (or an agent) to code
from; it does NOT code positions itself. --only-thin limits the run to candidates with fewer than three documented
positions."""
import json, re, sys, html, subprocess, time, unicodedata
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
out_path = sys.argv[1]; only_thin = '--only-thin' in sys.argv
js = open('data/guide.js', encoding='utf-8').read(); D = json.loads(js[js.index('{'):js.rindex('}') + 1])
def get(url):
    r = subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True, text=True, errors='ignore')
    body, _, code = r.stdout.rpartition('\n'); return code, body
def text_of(h):
    h = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S)
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', h)))
def slug(name):
    n = unicodedata.normalize('NFKD', name)
    n = re.sub(r'\s*["“].*?["”]\s*', ' ', n)
    return re.sub(r'\s+', '_', n.strip())
out = {}
for r in D['races']:
    for c in r['candidates']:
        if c.get('withdrawn'): continue
        known = sum(1 for v in (c.get('positions') or {}).values() if v.get('stance') is not None)
        if only_thin and known >= 3: continue
        url = next((l['url'] for l in (c.get('links') or []) if 'ballotpedia.org' in (l.get('url') or '')), None) or 'https://ballotpedia.org/' + slug(c['name'])
        code, page = get(url); time.sleep(0.4)
        if code != '200' or 'Candidate Connection' not in page: continue
        t = text_of(page); i = t.find('Candidate Connection')
        seg = t[i:i + 9000]
        m = re.search(r'completed (?:the|Ballotpedia\'s) .{0,60}?survey(?: in| on)? ([A-Z][a-z]+ \d{1,2}, \d{4}|[A-Z][a-z]+ \d{4})', seg)
        out[c['id']] = {'race_id': r['id'], 'name': c['name'], 'level': r.get('level'), 'url': url,
                        'survey_date': m.group(1) if m else None, 'known_positions': known, 'text': seg[:6000]}
        print(f"{c['id']:34} {r['id']:32} survey {out[c['id']]['survey_date']}", flush=True)
json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('candidates with a Candidate Connection survey:', len(out), '->', out_path)
