#!/usr/bin/env python3
"""Extend data/rollcalls/state_matrix.json to every sitting legislator running for their own seat.

The coder (code_state_rollcalls.py) reads the matrix; this builds rows for incumbents it did not cover.
A roll-call entry is attributed to a candidate only when ALL of these hold, because two legislators can
share a surname and a candidate can share one with the member whose seat they are running for:
  - the guide flags the candidate as the incumbent,
  - the surname matches exactly (not as a substring: "Perez|116" is Daniel Perez, not Ashley Perez-Biliskov),
  - the roll call is from the same chamber and lists the same district as the race,
  - the vote was taken under the current district maps (the December 2022 special session onward).
Existing rows are never changed. Usage: python3 scripts/build_state_matrix.py [--write]
"""
import json, glob, re, sys, unicodedata

V = json.load(open('data/rollcalls/state_votes.json'))
M = json.load(open('data/rollcalls/state_matrix.json'))
# matrix key -> roll call, per chamber; only bills voted under the post-2022 maps
BILLS = {
    'property_tax': '2026F_1F', 'immigration': '2025C_2C', 'abortion': '2023_300', 'guns': '2023_543',
    'education_choice': '2023_1', 'lgbtq': '2023_254', 'elections': '2023_7050', 'insurance': '2022A_2A',
    'energy': '2024_1645', 'housing': '2023_102',
}
# Members who changed their name while holding the seat. Matching stays exact; these are the extra exact
# names to accept for that one candidate, each confirmed against the roll calls for their district.
ALIASES = {
    'demi_busatta': ['busatta cabrera'],   # listed as Busatta Cabrera|114 through 2024, Busatta|114 from 2025
}

def rc(bill, chamber):
    for k in (f'v_{bill}_{chamber}', f'v_{bill}_{chamber}2'):
        if k in V: return V[k]
    return {}

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z\- ]', '', s).strip()

def surname(full):
    """(the whole name normalised with suffixes and nicknames removed, first initial)"""
    parts = [p for p in re.sub(r'"[^"]*"|\([^)]*\)', ' ', full).replace(',', ' ').split()
             if norm(p) not in ('jr', 'sr', 'ii', 'iii', 'iv', '')]
    return ' '.join(norm(p) for p in parts), (norm(parts[0])[:1] if parts else '')

def vote_for(roll, sur, initial, dist, aliases=()):
    """The vote cast by `sur` for district `dist`, or None. Handles 'Grant, J.|64' style keys, and
    compound surnames: `sur` is the candidate's whole name, and the roll-call surname must equal one of
    its trailing runs of words ('Gonzalez Pittman' matches Karen Gonzalez Pittman, 'Pittman' would not)."""
    words = sur.split()
    tails = {' '.join(words[i:]) for i in range(1, len(words))} | set(aliases)
    hits = []
    for key, v in roll.items():
        name, _, d = key.partition('|')
        if d != str(dist): continue
        last, _, ini = name.partition(',')
        if norm(last) not in tails: continue
        if ini.strip() and norm(ini)[:1] != initial: continue
        hits.append((key, v))
    return hits[0] if len(hits) == 1 else None

added, skipped = {}, []
for f in sorted(glob.glob('data/research/state_house_*.json') + glob.glob('data/research/state_senate_*.json')):
    d = json.load(open(f, encoding='utf-8'))
    chamber = 'house' if 'state_house_' in f else 'senate'
    dist = int(re.search(r'_(\d+)\.json$', f).group(1))
    for c in d.get('candidates') or []:
        if not isinstance(c, dict) or c.get('withdrawn') or c['id'] in M: continue
        if not c.get('incumbent'): continue
        sur, ini = surname(c['name'])
        row = {}
        for key, bill in BILLS.items():
            hit = vote_for(rc(bill, chamber), sur, ini, dist, ALIASES.get(c['id'], ()))
            if hit and hit[1] in ('Y', 'N'):
                row[key] = f'{hit[1]} {hit[0]}'
        if row:
            row['_chamber'] = 'S' if chamber == 'senate' else 'H'
            added[c['id']] = row
        else:
            skipped.append(f"{c['name']} ({chamber} {dist})")

for cid, row in added.items():
    print(f"{cid:28} {row['_chamber']} {len(row)-1:2} votes  " + ' '.join(f"{k}={v.split()[0]}" for k, v in row.items() if k != '_chamber'))
print(f'\n{len(added)} incumbents gained a matrix row')
if skipped: print('incumbent, but no post-2022 vote under this district (new member, or seat changed):\n  ' + '\n  '.join(skipped))
if '--write' in sys.argv:
    M.update(added)
    json.dump(M, open('data/rollcalls/state_matrix.json', 'w'), indent=1, ensure_ascii=False)
    print('wrote data/rollcalls/state_matrix.json')
