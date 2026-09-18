#!/usr/bin/env python3
"""Download the Florida Division of Elections candidate extract for an election and save it as JSON
with contact fields stripped.

Usage: python3 scripts/fetch_doe_extract.py [--election 20261103-GEN] [--out data/statewide/candidates_2026_general.json]
"""
import argparse, csv, io, json, datetime, urllib.request, urllib.parse

URL = 'https://dos.elections.myflorida.com/candidates/extractCanList.asp'
KEEP = ['ElectionID', 'OfficeCode', 'OfficeDesc', 'Juris1num', 'Juris2num', 'StatusCode', 'StatusDesc', 'PartyCode', 'PartyDesc', 'NameLast', 'NameFirst', 'NameMiddle', 'County']

def fetch(election):
    data = urllib.parse.urlencode({'elecID': election, 'office': 'All', 'status': 'All', 'cantype': 'ALL', 'FormSubmit': 'Download Candidate List'}).encode()
    req = urllib.request.Request(URL, data=data, headers={'User-Agent': 'Mozilla/5.0 (voter guide build)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode('utf-8', errors='replace')
    rows = []
    for rec in csv.DictReader(io.StringIO(text), delimiter='\t'):
        row = {k: (rec.get(k) or '').strip() for k in KEEP}
        row['scope'] = 'state' if rec.get('OfficeCode') in ('USS', 'USR', 'GOV', 'ATG', 'CFO', 'AGR', 'STS', 'STR', 'CTJ', 'DCA', 'SCJ', 'STA', 'PUB') else 'local'
        rows.append(row)
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--election', default='20261103-GEN')
    ap.add_argument('--out', default='data/statewide/candidates_2026_general.json')
    a = ap.parse_args()
    rows = fetch(a.election)
    out = {'_source': f"Florida Division of Elections Candidate Tracking System, {a.election}, state and local candidate extracts downloaded {datetime.date.today().isoformat()} from https://dos.elections.myflorida.com/candidates/downloadcanlist.asp. Contact fields removed. Status meanings per the Division: Qualified = qualified for the ballot; Unopposed = no opponent (elected without a vote); Defeated = lost in the primary; Withdrew / Did Not Qualify / Removed = not on the ballot.", 'candidates': rows}
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'wrote {a.out}: {len(rows)} rows')

if __name__ == '__main__':
    main()
