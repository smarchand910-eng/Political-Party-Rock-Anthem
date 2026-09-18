#!/usr/bin/env python3
"""Reconcile data/research/*.json candidate rosters against the Division of Elections extract.

Flags defeated/withdrawn/unqualified candidates (state and federal races), adds missing qualified
candidates as roster entries, and prints county-race discrepancies for manual review.

Usage: python3 scripts/reconcile_ballot.py [--write]
"""
import json,glob,re,os,sys,unicodedata
WRITE='--write' in sys.argv
d=json.load(open('data/statewide/candidates_2026_general.json')); rows=d.get('candidates') or d.get('rows') or list(d.values())[-1]
CC={v['county'].lower():k for k,v in json.load(open('data/statewide/supervisors.json'))['by_code'].items()}
PARTY={'REP':'Republican','DEM':'Democratic','NPA':'No Party Affiliation','WRI':'Write-in','LPF':'Libertarian','IND':'Independent Party of Florida','CPF':'Constitution Party of Florida','ASP':'American Solidarity Party','FFP':'Florida Forward Party','NOP':'Nonpartisan','GRE':'Green Party of Florida','REF':'Reform Party','PSL':'Party for Socialism and Liberation','ECO':'Ecology Party of Florida','BPF':'Boricua Party of Florida','UPF':'Unity Party of Florida'}
def norm(s):
    s=re.sub(r'\b(jr|sr|ii|iii|iv)\.?$','',(s or '').strip(),flags=re.I)
    return re.sub(r'[^a-z]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def slug(s): return re.sub(r'_+','_',re.sub(r'[^a-z0-9]+','_',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())).strip('_')
def key_for(rid,j):
    t=j['type']
    if t=='cd': return ('USR',f"{int(j['id']):03d}",None)
    if t=='sd': return ('STS',f"{int(j['id']):03d}",None)
    if t=='hd': return ('STR',f"{int(j['id']):03d}",None)
    m=re.match(r'^county_([a-z_]+?)_(commission|council)_(\d+|at_large)$',rid)
    if m:
        county=m.group(1).replace('_',' '); dist=m.group(3)
        return ('BCC',f"{int(dist):03d}" if dist.isdigit() else '',CC.get(county))
    m=re.match(r'^county_([a-z_]+?)_school_board_(\d+)$',rid)
    if m: return ('SCB',f"{int(m.group(2)):03d}",CC.get(m.group(1).replace('_',' ')))
    return None
STATUS={'DEF':'Defeated in the Aug. 18, 2026 primary','WIT':'Withdrew after qualifying','DNQ':'Did not qualify','REM':'Removed from the ballot','DEC':'Deceased'}
SRC='Florida Division of Elections, 2026 general election candidate list'
flag=0; added=0; unmatched=[]
def match(c,pool):
    cn=norm(c['name']); toks=[norm(t) for t in re.split(r'[\s\-]+',c['name']) if norm(t)]
    hits=[r for r in pool if norm(r['NameLast']) and (norm(r['NameLast']) in cn or any(t and t in norm(r['NameLast']) and len(t)>3 for t in toks))]
    if len(hits)>1:
        fn=norm(c['name'].split()[0])[:3]
        h2=[r for r in hits if norm(r['NameFirst'])[:3]==fn]
        if len(h2)==1: hits=h2
    return hits
for f in sorted(glob.glob('data/research/*.json')):
    rid=os.path.basename(f)[:-5]; raw=open(f,encoding='utf-8').read(); j=json.loads(raw)
    if not isinstance(j,dict) or not j.get('jurisdiction') or not isinstance(j.get('candidates'),list) or j.get('kind')=='measure': continue
    k=key_for(rid,j['jurisdiction'])
    if not k: print('SKIP',rid); continue
    off,dist,county=k
    if j['jurisdiction']['type']=='county' and not county: print('NO COUNTY CODE',rid); continue
    pool=[r for r in rows if r['OfficeCode']==off and (r['Juris1num'] or r['Juris2num'])==dist and (county is None or r['County']==county)]
    changed=False; seen=set(); auto=j['jurisdiction']['type']!='county'
    for c in j['candidates']:
        hits=match(c,pool)
        if len(hits)!=1:
            anywhere=[r for r in rows if norm(r['NameLast']) and norm(r['NameLast']) in norm(c['name']) and norm(r['NameFirst'])[:3]==norm(c['name'].split()[0])[:3]]
            unmatched.append((rid,c['name'],[(r['OfficeCode'],r['Juris1num'] or r['Juris2num'],r['StatusDesc']) for r in anywhere]))
            if not c.get('withdrawn') and auto:
                if anywhere: note=f"Not listed for this office on the {SRC} (listed instead for {anywhere[0]['OfficeDesc']} {anywhere[0]['Juris1num'] or anywhere[0]['Juris2num']}, status {anywhere[0]['StatusDesc']})"
                else: note=f"Not on the {SRC}"
                c['withdrawn']=note; changed=True; flag+=1; print('FLAG',rid,c['name'],'->',note)
            continue
        r=hits[0]; seen.add(id(r)); st=r['StatusCode']
        if st in STATUS and not c.get('withdrawn') and auto:
            print(f"FLAG {rid}: {c['name']} -> {STATUS[st]}"); flag+=1
            c['withdrawn']=STATUS[st]+f' ({SRC})'; changed=True
        elif st in ('QUA','UNO') and c.get('withdrawn'):
            print(f"NOTE {rid}: {c['name']} marked withdrawn in file but DOE says {r['StatusDesc']}")
    if not auto: print('COUNTY',rid,'file:',[c['name'] for c in j['candidates']],'DOE:',[(r['NameFirst'],r['NameLast'],r['StatusCode']) for r in pool])
    for r in pool:
        if r['StatusCode'] in ('QUA','UNO') and id(r) not in seen and auto:
            name=' '.join(x for x in (r['NameFirst'],r['NameMiddle'],r['NameLast']) if x).replace('  ',' ')
            if r['NameMiddle'] and '"' not in r['NameMiddle'] and len(r['NameMiddle'])>2: name=f"{r['NameFirst']} {r['NameLast']}"
            wri=r['PartyCode']=='WRI'
            c={"id":slug(name),"name":name,"party":PARTY.get(r['PartyCode'],r['PartyDesc']),"incumbent":False,"photo_url":None,"photo_source":None,"website":None,
               "occupation":"Write-in candidate: the name is not printed on the ballot; voters must write it on the blank line" if wri else None,"residence":None,
               "background":f"{'Write-in candidate qualified' if wri else 'Qualified'} for the Nov. 3, 2026 ballot according to the {SRC} ({r['StatusDesc']}). Not yet researched.",
               "primary_result":None,"ballot_status":"verified","roster_sources":[{"title":SRC,"url":"https://dos.elections.myflorida.com/candidates/CanList.asp","date":"2026-09-18"}],
               "positions":{},"other_issues":[],"record":[],"endorsements":[]}
            j['candidates'].append(c); changed=True; added+=1; print(f"ADD {rid}: {name} ({c['party']})")
    if changed and WRITE:
        ind=1 if raw.startswith('{\n "') else 2
        open(f,'w',encoding='utf-8').write(json.dumps(j,ensure_ascii=False,indent=ind)+'\n')
print('flagged',flag,'added',added)
print('UNMATCHED:'); [print(' ',u) for u in unmatched]
