#!/usr/bin/env python3
"""Compare a fresh Division of Elections extract against the committed one and report status changes
for candidates that appear in data/research/*.json. Prints Markdown; exits 1 when something changed.

Usage: python3 scripts/check_ballot_changes.py /tmp/new_extract.json
"""
import json, sys, glob, os, re, unicodedata

def norm(s):
    s = re.sub(r'\b(jr|sr|ii|iii|iv)\.?$', '', (s or '').strip(), flags=re.I)
    return re.sub(r'[^a-z]', '', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower())

def key(r):
    return (r['OfficeCode'], r['Juris1num'] or r['Juris2num'], norm(r['NameLast']), norm(r['NameFirst'])[:3])

def load(p):
    d = json.load(open(p, encoding='utf-8'))
    return {key(r): r for r in d['candidates']}

def main():
    old = load('data/statewide/candidates_2026_general.json')
    new = load(sys.argv[1])
    names = set()
    for f in glob.glob('data/research/*.json'):
        d = json.load(open(f, encoding='utf-8'))
        if isinstance(d, dict) and isinstance(d.get('candidates'), list):
            for c in d['candidates']:
                if isinstance(c, dict) and c.get('name'):
                    names.add(norm(c['name'].split()[-1]))
    changes = []
    for k, r in new.items():
        o = old.get(k)
        if o and o['StatusCode'] != r['StatusCode'] and k[2] in names:
            changes.append(f"- {r['NameFirst']} {r['NameLast']} ({r['OfficeDesc']} {k[1]}): {o['StatusDesc']} -> {r['StatusDesc']}")
    for k, r in new.items():
        if k not in old and r['StatusCode'] in ('QUA', 'UNO') and r['OfficeCode'] in ('USR', 'STS', 'STR', 'GOV', 'USS', 'ATG', 'CFO', 'AGR'):
            changes.append(f"- NEW qualified: {r['NameFirst']} {r['NameLast']} ({r['OfficeDesc']} {k[1]}, {r['PartyDesc']})")
    if changes:
        print('## Ballot status changes since the committed extract\n')
        print('\n'.join(changes))
        sys.exit(1)
    print('No ballot status changes.')

if __name__ == '__main__':
    main()
