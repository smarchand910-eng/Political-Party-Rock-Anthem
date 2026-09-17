#!/usr/bin/env python3
"""Build data/statewide.js (window.STATEWIDE_DATA) from the official statewide source files in data/statewide/.

Inputs (all downloaded from official sources; see each file's _source field):
  data/statewide/candidates_2026_general.json   Division of Elections candidate extract (state + local), contact fields removed
  data/statewide/congressional_districts.json   Census county <-> congressional district relationship
  data/statewide/legislative_districts.json     Florida House / Senate district <-> county text from the Legislature's sites
  data/statewide/judicial_geography.json        Judicial circuits (s. 26.021) and appellate districts (ss. 35.02-35.044)
  data/statewide/supervisors.json               Supervisor of Elections directory (Division of Elections)

Output: data/statewide.js with, for each of the 67 counties, the districts that cover it and the official
candidate line-up for every federal, state, judicial and county contest, plus special districts.
Usage: python3 scripts/build_statewide.py
"""
import json, os, re, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, 'data', 'statewide')

def load(name):
    with open(os.path.join(SW, name), encoding='utf-8') as f:
        return json.load(f)

ON_BALLOT = {'QUA', 'UNO'}
PARTY = {'REP': 'Republican', 'DEM': 'Democratic', 'NPA': 'No Party Affiliation', 'WRI': 'Write-in', 'LPF': 'Libertarian',
         'IND': 'Independent Party', 'CPF': 'Constitution Party', 'ASP': 'American Solidarity Party', 'FFP': 'Florida Forward Party',
         'NOP': 'Nonpartisan', '': ''}
COUNTY_OFFICES = ['BCC', 'SCB', 'COJ', 'COC', 'SOE', 'TAX', 'PRA', 'SHF', 'COF', 'CMB']
SPECIAL = ['DEV', 'FPD', 'SWD', 'STD', 'MCD', 'WCD', 'PTA', 'HAD', 'ARP', 'LIB', 'WST', 'ERS']

def name(r):
    return ' '.join(x for x in (r['NameFirst'], r['NameMiddle'], r['NameLast']) if x)

def cand(r):
    d = {'name': name(r), 'party': r['PartyCode'], 'party_label': PARTY.get(r['PartyCode'], r['PartyDesc']), 'status': r['StatusCode'], 'status_label': r['StatusDesc']}
    if r['Juris2num']:
        d['seat'] = r['Juris2num'].lstrip('0') or r['Juris2num']
    if r['Juris1num'] and r['OfficeCode'] not in ('USR', 'STS', 'STR', 'CTJ', 'DCA'):
        d['juris'] = r['Juris1num']
    return d

def main():
    cands = load('candidates_2026_general.json')['candidates']
    cd = load('congressional_districts.json')['by_county']
    leg = load('legislative_districts.json')
    jud = load('judicial_geography.json')
    soe = load('supervisors.json')['by_code']
    code_by_name = {v['county']: k for k, v in soe.items()}

    # --- races keyed by district ---
    us_house = collections.defaultdict(list); senate = collections.defaultdict(list); house = collections.defaultdict(list)
    circuit = collections.defaultdict(list); dca = collections.defaultdict(list); supreme = []
    local = collections.defaultdict(lambda: collections.defaultdict(list))
    statewide_offices = collections.defaultdict(list)
    for r in cands:
        if r['StatusCode'] not in ON_BALLOT:
            continue
        oc = r['OfficeCode']; j1 = r['Juris1num'].lstrip('0') or r['Juris1num']
        if oc == 'USR': us_house[int(j1)].append(cand(r))
        elif oc == 'STS': senate[int(j1)].append(cand(r))
        elif oc == 'STR': house[int(j1)].append(cand(r))
        elif oc == 'CTJ': circuit[int(j1)].append(cand(r))
        elif oc == 'DCA': dca[int(j1)].append(cand(r))
        elif oc == 'SCJ': supreme.append(cand(r))
        elif oc in ('USS', 'GOV', 'LTG', 'ATG', 'CFO', 'AGR'): statewide_offices[oc].append(cand(r))
        elif r['scope'] == 'local' or oc in ('STA', 'PUB'):
            key = r['County'] if r['scope'] == 'local' else None
            if key:
                local[key][oc].append(dict(cand(r), office=r['OfficeDesc']))
    order = {'REP': 0, 'DEM': 1, 'LPF': 2, 'NPA': 3, 'IND': 4, 'CPF': 5, 'ASP': 6, 'FFP': 7, 'NOP': 8, 'WRI': 9}
    def sort_c(lst):
        return sorted(lst, key=lambda c: (c.get('seat') or '', order.get(c['party'], 8), c['name'].split()[-1]))
    for dct in (us_house, senate, house, circuit, dca):
        for k in dct: dct[k] = sort_c(dct[k])

    counties = {}
    for code, s in soe.items():
        n = s['county']
        circ = next(c for c, cs in jud['circuit_counties'].items() if n in cs)
        d = next(dd for dd, cs in jud['dca_circuits'].items() if int(circ) in cs)
        lg = leg['by_county'][n]
        counties[code] = {
            'code': code, 'name': n,
            'supervisor': {k: s[k] for k in ('supervisor', 'address', 'phone', 'website')},
            'congressional': cd[n],
            'senate': [dict(x, on_ballot=(x['district'] % 2 == 0)) for x in lg['senate']],
            'house': lg['house'],
            'circuit': int(circ), 'dca': int(d),
            'local_offices': {oc: sort_c(v) for oc, v in local.get(code, {}).items() if oc in COUNTY_OFFICES or oc in ('STA', 'PUB')},
            'special_districts': {oc: sort_c(v) for oc, v in local.get(code, {}).items() if oc in SPECIAL},
        }
    office_labels = {r['OfficeCode']: r['OfficeDesc'] for r in cands}
    out = {
        'generated_at': datetime.date.today().strftime('%B %d, %Y'),
        'sources': {
            'candidates': load('candidates_2026_general.json')['_source'],
            'congressional': load('congressional_districts.json')['_source'],
            'legislative': leg['_source'], 'judicial': jud['_source'], 'supervisors': load('supervisors.json')['_source'],
        },
        'office_labels': office_labels,
        'party_labels': PARTY,
        'counties': counties,
        'races': {
            'us_house': {str(k): v for k, v in sorted(us_house.items())},
            'state_senate': {str(k): v for k, v in sorted(senate.items())},
            'state_house': {str(k): v for k, v in sorted(house.items())},
            'circuit_judges': {str(k): v for k, v in sorted(circuit.items())},
            'dca_judges': {str(k): v for k, v in sorted(dca.items())},
            'supreme_court': supreme,
            'statewide': {k: sort_c(v) for k, v in statewide_offices.items()},
        },
        'house_district_counties': leg['house_district_counties'],
        'senate_district_counties': leg['senate_district_counties'],
    }
    js = 'window.STATEWIDE_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(ROOT, 'data', 'statewide.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    nl = sum(len(v) for c in counties.values() for v in c['local_offices'].values())
    print(f"wrote data/statewide.js: {len(counties)} counties, {sum(len(v) for v in us_house.values())} U.S. House, {sum(len(v) for v in senate.values())} Senate, {sum(len(v) for v in house.values())} House candidates, {nl} county-office candidates, {len(js)//1024} KB")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
