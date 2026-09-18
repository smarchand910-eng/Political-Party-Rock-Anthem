#!/usr/bin/env python3
"""Build data/finance/fec_fl_2026.json from the FEC bulk candidate summary file (weball26.zip).
Downloads the file unless a local path is given. Only Florida House and Senate candidates are kept.

Usage: python3 scripts/build_fec_finance.py [path/to/weball26.txt]
"""
import sys, io, json, zipfile, urllib.request, datetime

URL = 'https://www.fec.gov/files/bulk-downloads/2026/weball26.zip'
COLS = ['CAND_ID', 'CAND_NAME', 'CAND_ICI', 'PTY_CD', 'CAND_PTY_AFFILIATION', 'TTL_RECEIPTS', 'TRANS_FROM_AUTH', 'TTL_DISB', 'TRANS_TO_AUTH', 'COH_BOP', 'COH_COP', 'CAND_CONTRIB', 'CAND_LOANS', 'OTHER_LOANS', 'CAND_LOAN_REPAY', 'OTHER_LOAN_REPAY', 'DEBTS_OWED_BY', 'TTL_INDIV_CONTRIB', 'CAND_OFFICE_ST', 'CAND_OFFICE_DISTRICT', 'SPEC_ELECTION', 'PRIM_ELECTION', 'RUN_ELECTION', 'GEN_ELECTION', 'GEN_ELECTION_PRECENT', 'OTHER_POL_CMTE_CONTRIB', 'POL_PTY_CONTRIB', 'CVG_END_DT', 'INDIV_REFUNDS', 'CMTE_REFUNDS']

def load(path):
    if path:
        return open(path, encoding='utf-8', errors='replace').read()
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (voter guide build)'})
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(req, timeout=180).read()))
    return z.read(z.namelist()[0]).decode('utf-8', errors='replace')

def main():
    text = load(sys.argv[1] if len(sys.argv) > 1 else None)
    rows = []
    for line in text.splitlines():
        f = line.split('|')
        if len(f) < 28 or f[18] != 'FL' or f[0][0] not in 'HS': continue
        r = dict(zip(COLS, f))
        rows.append({'fec_id': r['CAND_ID'], 'name': r['CAND_NAME'], 'party': r['CAND_PTY_AFFILIATION'], 'office': 'S' if r['CAND_ID'][0] == 'S' else 'H', 'district': r['CAND_OFFICE_DISTRICT'],
                     'receipts': float(r['TTL_RECEIPTS'] or 0), 'disbursements': float(r['TTL_DISB'] or 0), 'cash_on_hand': float(r['COH_COP'] or 0), 'individual': float(r['TTL_INDIV_CONTRIB'] or 0),
                     'pac': float(r['OTHER_POL_CMTE_CONTRIB'] or 0), 'self': float(r['CAND_CONTRIB'] or 0) + float(r['CAND_LOANS'] or 0), 'through': r['CVG_END_DT']})
    out = {'_source': f"FEC bulk candidate summary file for the 2025-2026 cycle ({URL}), processed {datetime.date.today().isoformat()}. Totals are as reported through each candidate's latest filing (see 'through').", 'candidates': rows}
    json.dump(out, open('data/finance/fec_fl_2026.json', 'w'), indent=1)
    print('wrote data/finance/fec_fl_2026.json', len(rows), 'Florida federal candidates')

if __name__ == '__main__':
    main()
