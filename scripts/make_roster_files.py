#!/usr/bin/env python3
"""Create roster-only research files for every Florida House and Senate seat on the November ballot that
has no data/research/state_house_N.json or state_senate_N.json yet, from the Division of Elections extract.
Seats where the only qualified candidate is unopposed get on_november_ballot=false with a decided note.

Usage: python3 scripts/make_roster_files.py [--write]
"""
import json, os, re, sys, unicodedata, collections, datetime

WRITE = '--write' in sys.argv
EX = json.load(open('data/statewide/candidates_2026_general.json', encoding='utf-8'))
ROWS = EX['candidates']
LD = json.load(open('data/statewide/legislative_districts.json', encoding='utf-8'))
PARTY = {'REP': 'Republican', 'DEM': 'Democratic', 'NPA': 'No Party Affiliation', 'WRI': 'Write-in', 'LPF': 'Libertarian', 'IND': 'Independent Party of Florida', 'CPF': 'Constitution Party of Florida', 'ASP': 'American Solidarity Party', 'FFP': 'Florida Forward Party', 'NOP': 'Nonpartisan', 'GRE': 'Green Party of Florida', 'REF': 'Reform Party', 'PSL': 'Party for Socialism and Liberation', 'ECO': 'Ecology Party of Florida', 'JEF': 'Jeffersonian Party of Florida'}
SRC = 'Florida Division of Elections, 2026 general election candidate list'
SRCU = 'https://dos.elections.myflorida.com/candidates/CanList.asp'
TODAY = datetime.date.today().isoformat()
# Members who cast a vote on CS/HJR 1-F (June 2026) are the sitting members of their districts.
_V = json.load(open('data/rollcalls/state_votes.json', encoding='utf-8'))
SITTING = {'hd': {}, 'sd': {}}
for k, tbl in (('hd', _V.get('v_2026F_1F_house', {})), ('sd', _V.get('v_2026F_1F_senate', {}))):
    for key in tbl:
        nm, dist = key.rsplit('|', 1)
        SITTING[k][int(dist)] = nm
def is_sitting(kind, dist, last):
    nm = SITTING[kind].get(dist, '')
    a = re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', nm.split(',')[0]).encode('ascii', 'ignore').decode().lower())
    b = re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', re.sub(r'\b(jr|sr|ii|iii)\.?$', '', last.strip(), flags=re.I)).encode('ascii', 'ignore').decode().lower())
    return bool(a) and (a == b or a in b or b in a)

def slug(s):
    return re.sub(r'_+', '_', re.sub(r'[^a-z0-9]+', '_', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())).strip('_')

def name_of(r):
    mid = r['NameMiddle']
    if mid and '"' in mid:
        return f"{r['NameFirst']} {mid} {r['NameLast']}"
    return f"{r['NameFirst']} {r['NameLast']}"

def counties_for(kind, dist):
    txt = (LD['house_district_counties'] if kind == 'hd' else LD['senate_district_counties']).get(str(dist), '')
    parts = [p.strip() for p in re.split(r',', txt) if p.strip()]
    out = []
    for p in parts:
        p = re.sub(r'^(parts? of|part of)\s+', '', p, flags=re.I)
        out.append(p)
    return out, txt

made = 0
for off, kind, prefix, chamber in [('STR', 'hd', 'state_house_', 'Florida House'), ('STS', 'sd', 'state_senate_', 'Florida Senate')]:
    by = collections.defaultdict(list)
    for r in ROWS:
        if r['OfficeCode'] == off and r['StatusCode'] in ('QUA', 'UNO'):
            by[int(r['Juris1num'])].append(r)
    for dist, rows in sorted(by.items()):
        rid = f'{prefix}{dist}'
        path = f'data/research/{rid}.json'
        if os.path.exists(path):
            continue
        rows.sort(key=lambda r: ({'REP': 0, 'DEM': 1}.get(r['PartyCode'], 5), r['NameLast']))
        unopposed = [r for r in rows if r['StatusCode'] == 'UNO']
        counties, ctxt = counties_for(kind, dist)
        cands = []
        for r in rows:
            wri = r['PartyCode'] == 'WRI'
            name = name_of(r)
            cands.append({'id': slug(name), 'name': name, 'party': PARTY.get(r['PartyCode'], r['PartyDesc']), 'incumbent': is_sitting(kind, dist, r['NameLast']), 'photo_url': None, 'photo_source': None, 'website': None,
                'occupation': 'Write-in candidate: the name is not printed on the ballot; voters must write it on the blank line' if wri else None, 'residence': None,
                'background': f"{'Write-in candidate qualified' if wri else 'Qualified'} for the Nov. 3, 2026 ballot according to the {SRC} ({r['StatusDesc']}). Not yet researched.",
                'primary_result': None, 'ballot_status': 'verified', 'roster_sources': [{'title': SRC, 'url': SRCU, 'date': TODAY}], 'positions': {}, 'other_issues': [], 'record': [], 'endorsements': []})
        d = {'race_id': rid, 'title': f'{chamber}, District {dist}', 'level': 'state', 'office_group': 'State', 'term': '2 years' if kind == 'hd' else '4 years',
             'jurisdiction': {'type': kind, 'id': dist}, 'counties': counties, 'counties_verified': True,
             'what_it_does': f"Represents District {dist} ({ctxt}) in the {chamber}; votes on state laws and the state budget.",
             'on_november_ballot': not unopposed, 'decided_note': (f"{name_of(unopposed[0])} ({PARTY.get(unopposed[0]['PartyCode'])}) is listed as unopposed by the Florida Division of Elections and is elected without appearing on the November ballot. Source: {SRCU}" if unopposed else None),
             'coverage': 'roster', 'verified_ballot_note': f"Candidate list taken from the {SRC} on {TODAY} ({SRCU}); statuses Qualified/Unopposed only. Counties from the Legislature's district listings. Positions have not been researched yet.",
             'candidates': cands}
        made += 1
        print(('UNOPPOSED ' if unopposed else 'CONTESTED ') + rid, [(c['name'], c['party']) for c in cands])
        if WRITE:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(d, f, ensure_ascii=False, indent=2); f.write('\n')
print('files', 'written' if WRITE else 'to write', made)
