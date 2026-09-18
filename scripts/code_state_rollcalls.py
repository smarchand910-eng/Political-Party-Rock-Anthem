#!/usr/bin/env python3
"""Write record-based positions for legislators from data/rollcalls/state_matrix.json (built from the
official flsenate.gov roll-call PDFs in data/rollcalls/state_votes.json). Existing stated positions are never
overwritten. Usage: python3 scripts/code_state_rollcalls.py
"""
import json,sys,os,glob
M=json.load(open('data/rollcalls/state_matrix.json'))
M['jay_trumbull']['lgbtq']='Y Trumbull|2'   # recorded as a vote cast after roll call
SENATE={'jason_brodeur','colleen_burton','brian_nathan','nick_diceglie','jay_trumbull','jim_boyd','mack_bernard','rosalind_osgood','ileana_garcia','alexis_calatayud','clay_yarborough','ana_maria_rodriguez','jennifer_bradley','lauren_book','audrey_gibson'}
HOUSE={'mike_beltran','katherine_waldron','jeff_holcomb','josie_tomkow','fentrice_driskell','james_buchanan','david_silvers','rick_roth','lauren_melo','ashley_gantt','elizabeth_fetterhoff','felicia_robinson','marie_woodson','tom_fabricio','david_borrero','alex_rizo','kimberly_daniels','j_j_grow','ryan_chamberlin','taylor_yarkosky','richard_gentry','erika_booth','doug_bankson','rashon_young','bruce_antone','jon_albert','jennifer_canady','randy_maggard','brad_yeager','lisa_dunkley','daryl_campbell'}
FS='https://www.flsenate.gov/Session/Bill/'
B={
 'property_tax':('property_tax',1,-1,'CS/HJR 1-F (2026)',FS+'2026F/1F','SenateVote_h00001Fc1005.PDF','HouseVote_h00001Fc1900.PDF','the June 2026 joint resolution that placed Amendment 3 on the ballot to raise the non-school homestead exemption to $250,000 by 2028 and let counties and cities exempt homesteads entirely; a vote to refer the amendment is coded as leaning','2026-06-02'),
 'immigration':('immigration',2,-2,'SB 2-C (2025)',FS+'2025C/2C','SenateVote_s00002C__004.PDF','HouseVote_s00002C__013.PDF','the February 2025 special-session immigration law that created a State Board of Immigration Enforcement, made entering Florida as an unauthorized immigrant a state crime and required local cooperation with federal detention','2025-02-13'),
 'abortion':('abortion',-2,2,'SB 300 (2023)',FS+'2023/300','SenateVote_s00300e1018.PDF','HouseVote_s00300e1107.PDF','the 2023 law limiting most abortions to six weeks of pregnancy','2023-04'),
 'guns':('guns',-2,2,'HB 543 (2023)',FS+'2023/543','SenateVote_h00543e1002.PDF','HouseVote_h00543e1046.PDF','the 2023 law allowing adults to carry a concealed firearm without a permit','2023-03'),
 'education_choice':('education_choice',2,-2,'HB 1 (2023)',FS+'2023/1','SenateVote_h00001c4002.PDF','HouseVote_h00001c4034.PDF','the 2023 law that made every Florida student eligible for a state-funded scholarship usable at private schools or for home education','2023-03'),
 'lgbtq':('lgbtq',2,-2,'SB 254 (2023)',FS+'2023/254','SenateVote_s00254e1018.PDF','HouseVote_s00254e1482.PDF','the 2023 law barring gender-affirming medical treatment for minors and restricting it for adults','2023-05-04'),
 'elections':('elections',-2,2,'SB 7050 (2023)',FS+'2023/7050','SenateVote_s07050c1010.PDF','HouseVote_s07050e1320.PDF','the 2023 elections law that raised penalties and shortened deadlines for third-party voter-registration groups and changed vote-by-mail and voter-roll procedures','2023-04'),
 'insurance':('insurance',-1,1,'SB 2-A (Dec. 2022)',FS+'2022A/2A','SenateVote_s00002A__008.PDF','HouseVote_s00002A__009.PDF','the December 2022 property-insurance law that ended one-way attorney fees and assignment of benefits and created a state reinsurance program, a market-based approach; a vote for it is coded as leaning against more direct state intervention','2022-12'),
 'abortion22':('abortion',-2,2,'HB 5 (2022)',FS+'2022/5','SenateVote_h00005c1028.PDF','HouseVote_h00005c1542.PDF','the 2022 law limiting most abortions to 15 weeks','2022-03'),
 'lgbtq22':('lgbtq',2,-2,'HB 1557 (2022)',FS+'2022/1557','SenateVote_h01557e1003.PDF','HouseVote_h01557e1564.PDF','the 2022 Parental Rights in Education law restricting classroom instruction on sexual orientation and gender identity','2022-03'),
 'elections21':('elections',-2,2,'SB 90 (2021)',FS+'2021/90','SenateVote_s00090e1042.PDF','HouseVote_s00090e1440.PDF','the 2021 elections law that added identification requirements for mail-ballot requests and limited drop-box hours','2021-04-29'),
 'energy':('energy',-1,1,'CS/CS/HB 1645 (2024)',FS+'2024/1645','SenateVote_h01645e1039.PDF','HouseVote_h01645e1973.PDF','the 2024 energy law that removed climate change as a priority of state energy policy, repealed several renewable-energy goals and grant programs, banned offshore wind turbines in state waters and eased regulation of natural-gas pipelines; a vote for it is coded as leaning against promoting renewable energy','2024-03-07'),
 'housing':('housing',1,-1,'CS/SB 102 (2023)',FS+'2023/102','SenateVote_s00102c1010.PDF','HouseVote_s00102e1044.PDF','the 2023 Live Local Act that put $711 million into state housing programs, required local governments to allow multifamily housing in commercial areas when at least 40 percent of units are affordable, and created property-tax exemptions for affordable developments; a vote for it is coded as leaning toward more government action on housing','2023-03-24'),
 'crime':('crime',2,-2,'HB 1 (2021)',FS+'2021/1','SenateVote_h00001e1002.PDF','HouseVote_h00001e1020.PDF','the 2021 Combating Public Disorder law that created new riot-related offenses and penalties and let the state override local cuts to police budgets','2021-04'),
}
ORDER=['property_tax','energy','housing','immigration','abortion','guns','education_choice','lgbtq','elections','insurance','crime','abortion22','lgbtq22','elections21']
coded=0; touched=set(); unknown_chamber=set()
for f in sorted(glob.glob('data/research/*.json')):
    raw=open(f,encoding='utf-8').read(); d=json.loads(raw)
    if not isinstance(d,dict) or not isinstance(d.get('candidates'),list): continue
    changed=False
    for c in d['candidates']:
        if not isinstance(c,dict): continue
        row=M.get(c.get('id'))
        if not row: continue
        if c['id'] in SENATE: chamber='S'
        elif c['id'] in HOUSE: chamber='H'
        else: unknown_chamber.add(c['id']); continue
        rec=[]
        for key in ORDER:
            v=row.get(key,'-')
            if not v or v=='-' or v.startswith('AMBIG'): continue
            vote=v.split(' ',1)[0]
            if vote not in ('Y','N'): continue
            issue,ys,ns,short,page,spdf,hpdf,desc,date=B[key]
            pdf=page+'/Vote/'+(spdf if chamber=='S' else hpdf)
            verb='for' if vote=='Y' else 'against'
            item=f"Voted {verb} {short}, {desc}."
            rec.append((item,page,pdf))
            c.setdefault('positions',{})
            pos=c['positions'].get(issue)
            if pos and pos.get('stance') is not None: continue
            c['positions'][issue]={"stance": ys if vote=='Y' else ns, "confidence":"record", "summary": item, "quote": None,
                "sources":[{"title":f"{short} bill page - The Florida Senate","url":page,"date":date},{"title":f"{short} roll-call vote ({'Senate' if chamber=='S' else 'House'})","url":pdf,"date":date}]}
            coded+=1; changed=True
        if rec:
            have={r.get('item','')[:50] for r in c.get('record',[]) if isinstance(r,dict)}
            new=[{"item":it,"sources":[{"title":"Bill page","url":pg},{"title":"Roll-call vote","url":pdf}]} for it,pg,pdf in rec if it[:50] not in have]
            if new: c['record']=(c.get('record') or [])+new; changed=True
            if d.get('coverage')=='roster': d['coverage']='partial'; changed=True
            touched.add(c['id'])
    if changed:
        ind=1 if raw.startswith('{\n "') else 2
        open(f,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=ind)+'\n')
        print('wrote',os.path.basename(f))
print('positions coded',coded,'candidates touched',len(touched),'unknown chamber',sorted(unknown_chamber))
missing=set(M)-touched; print('in matrix but not found in files:',sorted(missing))
