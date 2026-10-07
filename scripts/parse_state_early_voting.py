"""Turn the Division of Elections' General Election early-voting archive into the guide's county data.

Usage:
  python3 scripts/parse_state_early_voting.py <folder of the extracted per-county PDFs> out.json [--write]

The state publishes one PDF per county listing every early-voting site, its days of operation and its daily hours
(https://dos.fl.gov/elections/for-voters/voting/early-voting-and-secure-ballot-intake-stations/, posted after Oct. 4).
That is the authoritative source, so this replaces the dates and hours the guide had gathered from county websites.
It reports the first and last day any site is open, the daily hours when every site shares them, and the number of
sites. --write updates data/research/counties.json in place; without it the script only writes the review file.
Site addresses are left to the county pages the guide already links, because the PDFs do not carry them in a
machine-readable form."""
import json, re, sys, os, glob, datetime, collections

src_dir, out_path = sys.argv[1], sys.argv[2]
write = '--write' in sys.argv
try:
    import pymupdf
except ImportError:
    import fitz as pymupdf

CODE_TO_NAME = None
counties_path = os.path.join('data', 'research', 'counties.json')
counties = json.load(open(counties_path, encoding='utf-8'))
sw_path = os.path.join('data', 'statewide.js')
if os.path.exists(sw_path):
    js = open(sw_path, encoding='utf-8').read()
    SW = json.loads(js[js.index('{'):js.rindex('}') + 1])
    CODE_TO_NAME = {c['code']: c['name'] for c in SW['counties'].values()}

DATE_RE = re.compile(r'(October|November)\s+(\d{1,2}),\s*2026')
TIME_RE = re.compile(r'(\d{1,2}:\d{2})\s*(AM|PM)', re.I)

def pretty(d):
    return d.strftime('%a %b %-d') if os.name != 'nt' else d.strftime('%a %b %d')

out = {}
for pdf in sorted(glob.glob(os.path.join(src_dir, '*.pdf'))):
    code = os.path.basename(pdf).split(' ')[0].upper()
    name = (CODE_TO_NAME or {}).get(code, code)
    doc = pymupdf.open(pdf)
    text = '\n'.join(p.get_text() for p in doc)
    tokens = []
    # counties file these on three different forms: "October 19, 2026", "10/19/2026", and a single "10/24/2026-10/31/2026" range
    pat = r'(October|November)\s+(\d{1,2}),\s*2026|(\d{1,2})/(\d{1,2})/2026|(\d{1,2}:\d{2})\s*(AM|PM)'
    for m in re.finditer(pat, text, re.I):
        if m.group(1):
            tokens.append(('date', datetime.date(2026, 10 if m.group(1).lower() == 'october' else 11, int(m.group(2)))))
        elif m.group(3):
            mo, dy = int(m.group(3)), int(m.group(4))
            if mo in (10, 11) and 1 <= dy <= 31: tokens.append(('date', datetime.date(2026, mo, dy)))
        else:
            tokens.append(('time', f"{m.group(5)} {m.group(6).upper()}"))
    days, spans = set(), collections.Counter()
    # a county that files one date range covers every day in it
    for a, b in re.findall(r'(\d{1,2}/\d{1,2}/2026)\s*[-–]\s*(\d{1,2}/\d{1,2}/2026)', text):
        d1 = datetime.date(2026, int(a.split('/')[0]), int(a.split('/')[1]))
        d2 = datetime.date(2026, int(b.split('/')[0]), int(b.split('/')[1]))
        while d1 <= d2:
            days.add(d1); d1 += datetime.timedelta(days=1)
    i = 0
    while i < len(tokens):
        if tokens[i][0] == 'date':
            days.add(tokens[i][1])
            if i + 2 < len(tokens) and tokens[i + 1][0] == 'time' and tokens[i + 2][0] == 'time':
                spans[(tokens[i + 1][1], tokens[i + 2][1])] += 1
                i += 3; continue
        i += 1
    sites = len(re.findall(r'Location Name', text)) or len(re.findall(r'Location\s+\d+\b', text))
    if not days:
        out[name] = {'county_code': code, 'error': 'no dates found in the state PDF'}
        continue
    # by law early voting may not run past the second day before the election, so Nov 2-3 in a filing is the
    # election-date header, not an early-voting day
    days = {d for d in days if d <= datetime.date(2026, 11, 1)}
    if not days:
        out[name] = {'county_code': code, 'error': 'no early-voting dates found in the state PDF'}
        continue
    first, last = min(days), max(days)
    top = spans.most_common()
    hours = None
    if top:
        (s, e), n = top[0]
        fmt = lambda x: x.lower().replace(':00', '').replace(' am', ' a.m.').replace(' pm', ' p.m.')
        hours = f'{fmt(s)}–{fmt(e)}'
        if len(top) > 1:
            hours += ' at most sites; some sites or days differ'
    out[name] = {'county_code': code, 'dates': f'{pretty(first)} – {pretty(last)}, 2026', 'hours': hours,
                 'sites': sites, 'days': len(days)}
json.dump(out, open(out_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
ok = [k for k, v in out.items() if 'dates' in v]
print(f'parsed {len(out)} county files, {len(ok)} with dates -> {out_path}')

if write:
    SRC = ('Florida Division of Elections, early voting and secure ballot intake station locations for the Nov. 3, 2026 '
           'general election (per-county filings published Oct. 2, 2026): '
           'https://dos.fl.gov/elections/for-voters/voting/early-voting-and-secure-ballot-intake-stations/')
    n = 0
    for name, rec in out.items():
        if 'dates' not in rec or name not in counties['counties']: continue
        ev = counties['counties'][name].get('early_voting') or {}
        ev['dates'] = rec['dates']
        if rec.get('hours'): ev['hours'] = rec['hours']
        ev['sites'] = rec['sites']
        ev['note'] = (f"Official filing with the state: {rec['sites']} early-voting sites, open {rec['days']} days. "
                      f"Sites each have a drop box for mail ballots. Source: {SRC}")
        counties['counties'][name]['early_voting'] = ev
        n += 1
    json.dump(counties, open(counties_path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    open(counties_path, 'a').write('\n')
    print('counties updated from the official filings:', n)
