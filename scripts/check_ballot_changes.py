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
    # A seat can go uncontested without any status changing this week: the last opponent may have dropped out
    # earlier, so compare the state's live field against what the guide still presents as a November contest.
    OFFICE_RACE = {'STR': 'state_house_%d', 'STS': 'state_senate_%d', 'USR': 'us_house_%d'}
    on_ballot = {}
    for k, r in new.items():
        pat = OFFICE_RACE.get(r['OfficeCode'])
        if not pat: continue
        try: num = int(r['Juris1num'] or 0)
        except ValueError: continue
        if not num: continue
        on_ballot.setdefault(pat % num, []).append(r)
    uncontested, contested = [], []
    for rid, rows in sorted(on_ballot.items()):
        running = [x for x in rows if x['StatusCode'] in ('QUA', 'UNO')]
        f = os.path.join('data', 'research', rid + '.json')
        if not os.path.exists(f): continue
        g = json.load(open(f, encoding='utf-8'))
        if len(running) > 1:
            # The opposite mistake is worse: telling voters a seat is decided hides a live contest from their ballot,
            # the quiz and the cheat sheet. It happens when a seat is marked decided from a report published before
            # qualifying closed and an opponent qualifies afterwards.
            if g.get('on_november_ballot') is False:
                who = ', '.join(f"{x['NameFirst']} {x['NameLast']} ({x['PartyCode']})" for x in running)
                contested.append(f"- {g.get('title', rid)}: the guide marks this seat as decided, but the state lists {len(running)} qualified candidates ({who}). Set on_november_ballot back to true.")
            continue
        if g.get('on_november_ballot') is False: continue
        who = ', '.join(f"{x['NameFirst']} {x['NameLast']} ({x['StatusDesc']})" for x in running) or 'nobody'
        uncontested.append(f"- {g.get('title', rid)}: the state now shows only {who} on the ballot, but the guide still presents it as a November contest. Mark it decided if the seat is filled without a vote.")
    if uncontested:
        changes.append('')
        changes.append('### Races the state now shows as uncontested')
        changes += uncontested
    if contested:
        changes.append('')
        changes.append('### Races the guide marks as decided that are live contests')
        changes += contested
    if changes:
        print('## Ballot status changes since the committed extract\n')
        print('\n'.join(changes))
        sys.exit(1)
    print('No ballot status changes.')

if __name__ == '__main__':
    main()
