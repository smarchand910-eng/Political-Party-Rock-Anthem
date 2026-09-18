#!/usr/bin/env python3
"""Code record-based positions for Florida members of Congress from Clerk of the House roll-call XML.

Downloads each roll call in BILLS into data/rollcalls/house_votes.json (cached), then writes a position
for every incumbent in data/research/us_house_*.json who cast a Yea/Nay, unless that issue is already
coded from a stated source. Usage: python3 scripts/code_house_rollcalls.py
"""
import json, os, re, glob, urllib.request, unicodedata

CACHE = 'data/rollcalls/house_votes.json'
CLERK = 'https://clerk.house.gov/evs/{year}/roll{num:03d}.xml'
# (year, roll, issue, yea stance, nay stance, short, bill page, description, date)
BILLS = [
 (2025, 23, 'immigration', 2, -2, 'Laken Riley Act (S. 5)', 'https://www.congress.gov/bill/119th-congress/senate-bill/5', 'the 2025 law requiring federal detention of unauthorized immigrants charged with theft or violent crimes and letting states sue over immigration enforcement', '2025-01-22'),
 (2025, 102, 'elections', -2, 2, 'SAVE Act (H.R. 22)', 'https://www.congress.gov/bill/119th-congress/house-bill/22', 'the 2025 bill requiring documentary proof of citizenship to register to vote', '2025-04-10'),
 (2025, 190, 'taxes', 2, -2, 'One Big Beautiful Bill Act (H.R. 1)', 'https://www.congress.gov/bill/119th-congress/house-bill/1', 'the July 2025 budget law that made the 2017 tax cuts permanent and added new deductions while cutting Medicaid and food-assistance spending', '2025-07-03'),
 (2025, 190, 'healthcare', -2, 2, 'One Big Beautiful Bill Act (H.R. 1)', 'https://www.congress.gov/bill/119th-congress/house-bill/1', 'the July 2025 budget law that added Medicaid work requirements and eligibility checks projected to reduce coverage', '2025-07-03'),
 (2025, 35, 'energy', -1, 1, 'Protecting American Energy Production Act (H.R. 26)', 'https://www.congress.gov/bill/119th-congress/house-bill/26', 'the 2025 bill barring a presidential moratorium on hydraulic fracturing without an act of Congress; a vote for it is coded as leaning toward fossil-fuel production', '2025-02-07'),
 (2025, 12, 'lgbtq', 1, -1, 'Protection of Women and Girls in Sports Act (H.R. 28)', 'https://www.congress.gov/bill/119th-congress/house-bill/28', 'the 2025 bill barring transgender girls and women from female school sports under Title IX; a vote for it is coded as leaning toward keeping restrictions in place', '2025-01-14'),
 (2025, 27, 'abortion', -1, 1, 'Born-Alive Abortion Survivors Protection Act (H.R. 21)', 'https://www.congress.gov/bill/119th-congress/house-bill/21', 'the 2025 bill setting criminal penalties for providers who fail to care for an infant born alive after an attempted abortion; a vote for it is coded as leaning toward more abortion restrictions', '2025-01-23'),
 (2025, 162, 'crime', 1, -1, "Protecting Our Nation's Capital Emergency Act (H.R. 2096)", 'https://www.congress.gov/bill/119th-congress/house-bill/2096', 'the 2025 bill repealing parts of the District of Columbia police-accountability law; a vote for it is coded as leaning toward tougher policing', '2025-06-10'),
 (2024, 456, 'social_security', 1, -1, 'Social Security Fairness Act (H.R. 82)', 'https://www.congress.gov/bill/118th-congress/house-bill/82', 'the 2024 law repealing the Windfall Elimination Provision and Government Pension Offset, raising benefits for some public-sector retirees', '2024-11-12'),
]

def norm(s):
    s = re.sub(r'\s*\(.*?\)', '', s or '')          # 'Bean (FL)' -> 'Bean'
    s = s.split(',')[0]                              # 'Frankel, Lois' -> 'Frankel'
    return re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())

def fetch(year, num):
    url = CLERK.format(year=year, num=num)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (voter guide build)'})
    t = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', errors='replace')
    votes = {}
    for m in re.finditer(r'<legislator name-id="(\w+)"[^>]*unaccented-name="([^"]*)"[^>]*state="(\w\w)"[^>]*>[^<]*</legislator>\s*<vote>(\w+)</vote>', t):
        votes[f'{m.group(2)}|{m.group(3)}'] = m.group(4)
    if not votes:
        for m in re.finditer(r'<legislator name-id="(\w+)"[^>]*state="(\w\w)"[^>]*>([^<]*)</legislator>\s*<vote>(\w+)</vote>', t):
            votes[f'{m.group(3)}|{m.group(2)}'] = m.group(4)
    q = re.search(r'<vote-question>(.*?)</vote-question>', t); d = re.search(r'<action-date>(.*?)</action-date>', t); leg = re.search(r'<legis-num>(.*?)</legis-num>', t)
    return {'url': url, 'question': q and q.group(1), 'date': d and d.group(1), 'legis': leg and leg.group(1), 'votes': votes}

def main():
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    for year, num, *_ in BILLS:
        k = f'{year}-{num}'
        if k not in cache:
            cache[k] = fetch(year, num); print('fetched', k, cache[k]['legis'], len(cache[k]['votes']), 'votes')
    json.dump(cache, open(CACHE, 'w'), indent=0)
    coded = 0; touched = set()
    for f in sorted(glob.glob('data/research/us_house_*.json')):
        raw = open(f, encoding='utf-8').read(); d = json.loads(raw); changed = False
        for c in d['candidates']:
            if not c.get('incumbent'):
                continue
            last = norm(c['name'].split()[-1]); full = norm(c['name'])
            rec = []
            for year, num, issue, ys, ns, short, page, desc, date in BILLS:
                rc = cache[f'{year}-{num}']
                hits = [(n, v) for n, v in rc['votes'].items() if n.endswith('|FL') and (norm(n.split('|')[0]) == last or norm(n.split('|')[0]) in full)]
                if len(hits) != 1:
                    continue
                v = hits[0][1]
                if v not in ('Yea', 'Aye', 'Nay', 'No'):
                    continue
                yes = v in ('Yea', 'Aye')
                item = f"Voted {'for' if yes else 'against'} the {short}, {desc}."
                rec.append((item, page, rc['url']))
                pos = c.setdefault('positions', {}).get(issue)
                if pos and pos.get('stance') is not None:
                    continue
                c['positions'][issue] = {'stance': ys if yes else ns, 'confidence': 'record', 'summary': item, 'quote': None,
                    'sources': [{'title': f'{short} - Congress.gov', 'url': page, 'date': date}, {'title': f'House roll call {num} ({year}) - Clerk of the U.S. House', 'url': rc['url'], 'date': date}]}
                coded += 1; changed = True
            if rec:
                have = {r.get('item', '')[:50] for r in c.get('record', []) if isinstance(r, dict)}
                new = [{'item': it, 'sources': [{'title': 'Bill page - Congress.gov', 'url': pg}, {'title': 'Roll-call vote - Clerk of the U.S. House', 'url': u}]} for it, pg, u in rec if it[:50] not in have]
                if new:
                    c['record'] = (c.get('record') or []) + new; changed = True
                touched.add(c['id'])
        if changed:
            ind = 1 if raw.startswith('{\n "') else 2
            open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + '\n')
    print('positions coded', coded, 'incumbents touched', len(touched), sorted(touched))

if __name__ == '__main__':
    main()
