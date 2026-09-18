#!/usr/bin/env python3
"""Create roster-only research files for contested school-board, circuit-judge and county-judge races
(two or more qualified candidates) from the Division of Elections extract, so they appear on the Races
page and in ballot filtering. Skips rows whose county is blank in the extract and files that already exist.

Usage: python3 scripts/make_local_files.py [--write]
"""
import json, os, re, sys, unicodedata, collections, datetime

WRITE = '--write' in sys.argv
ROWS = json.load(open('data/statewide/candidates_2026_general.json', encoding='utf-8'))['candidates']
BY_CODE = json.load(open('data/statewide/supervisors.json', encoding='utf-8'))['by_code']
FL = json.load(open('data/florida.json', encoding='utf-8'))
SRC = 'Florida Division of Elections, 2026 general election candidate list'
SRCU = 'https://dos.elections.myflorida.com/candidates/CanList.asp'
TODAY = datetime.date.today().isoformat()
ORD = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th','16th','17th','18th','19th','20th']

def slug(s):
    return re.sub(r'_+', '_', re.sub(r'[^a-z0-9]+', '_', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())).strip('_')

def name_of(r):
    mid = r['NameMiddle']
    return f"{r['NameFirst']} {mid} {r['NameLast']}" if mid and '"' in mid else f"{r['NameFirst']} {r['NameLast']}"

def circuit_counties(circ):
    out = []
    for county, info in (FL.get('counties') or FL).items():
        c = info.get('circuit') if isinstance(info, dict) else None
        if c == circ: out.append(county)
    return sorted(out)

groups = collections.defaultdict(list)
for r in ROWS:
    if r['OfficeCode'] in ('SCB', 'CTJ', 'COJ') and r['StatusCode'] == 'QUA' and r['County']:
        groups[(r['OfficeCode'], r['County'], r['Juris1num'], r['Juris2num'])].append(r)

made = 0
for (off, code, j1, j2), rows in sorted(groups.items()):
    if len(rows) < 2: continue
    county = BY_CODE.get(code, {}).get('county')
    if not county: continue
    cslug = slug(county)
    if off == 'SCB':
        rid = f'county_{cslug}_school_board_{int(j2)}'; title = f'{county} County School Board, District {int(j2)}'; term = '4 years'
        what = 'School board members set the district budget and school-tax rate, hire the superintendent (where appointed), approve school boundaries, curriculum policy and construction, and set district policies. Nonpartisan.'
        counties = [county]
    elif off == 'CTJ':
        circ = int(j1); counties = circuit_counties(circ) or [county]
        rid = f'county_{cslug}_circuit_judge_{circ}_group_{int(j2)}'; title = f'Circuit Judge, {ORD[circ-1]} Judicial Circuit, Group {int(j2)}'; term = '6 years'
        what = f"Circuit judges hear felony criminal cases, major civil suits, family and probate matters. This seat is elected by voters across the {ORD[circ-1]} Circuit ({', '.join(counties)}). Nonpartisan; a candidate needs a majority, and this contest was not decided in August."
    else:
        rid = f'county_{cslug}_county_judge_group_{int(j2)}'; title = f'{county} County Judge, Group {int(j2)}'; term = '6 years'
        what = 'County judges hear misdemeanors, traffic, small claims and civil cases up to $50,000. Nonpartisan.'
        counties = [county]
    path = f'data/research/{rid}.json'
    if os.path.exists(path): continue
    cands = [{'id': slug(name_of(r)), 'name': name_of(r), 'party': 'Nonpartisan', 'incumbent': False, 'photo_url': None, 'photo_source': None, 'website': None, 'occupation': None, 'residence': None,
              'background': f"Qualified for the Nov. 3, 2026 ballot according to the {SRC} (Qualified). Not yet researched.", 'primary_result': None, 'ballot_status': 'verified',
              'roster_sources': [{'title': SRC, 'url': SRCU, 'date': TODAY}], 'positions': {}, 'other_issues': [], 'record': [], 'endorsements': []} for r in sorted(rows, key=lambda r: r['NameLast'])]
    d = {'race_id': rid, 'title': title, 'level': 'county', 'office_group': 'County', 'term': term, 'jurisdiction': {'type': 'county', 'id': county}, 'counties': counties, 'counties_verified': True,
         'what_it_does': what, 'on_november_ballot': True, 'decided_note': None, 'coverage': 'roster',
         'verified_ballot_note': f"Candidate list taken from the {SRC} on {TODAY} ({SRCU}); both candidates are marked Qualified, which for a nonpartisan seat means the August vote did not produce a majority winner (or the seat is decided only in November). Positions have not been researched; check the county Supervisor of Elections sample ballot.",
         'candidates': cands}
    made += 1; print(rid, [c['name'] for c in cands])
    if WRITE:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print('files', 'written' if WRITE else 'to write', made)
