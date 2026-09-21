"""Apply stated positions from a JSON spec: {race_id: {cand_id: {website, background, positions:{issue:[stance,summary,quote,[[title,url,date],...]]}, other_issues:[...], record:[...]}}}"""
import json,sys
spec=json.load(open(sys.argv[1]))
issues={i['id'] for i in json.load(open('data/issues.json'))['issues']}
n=0
for rid,cands in spec.items():
    if rid.startswith('_'): continue   # _debates / _amendments are handled by apply_status.py
    p=f'data/research/{rid}.json'; raw=open(p,encoding='utf-8').read(); d=json.loads(raw)
    byid={c['id']:c for c in d['candidates']}
    for cid,sp in cands.items():
        c=byid[cid]
        if sp.get('website'): c['website']=sp['website']
        if sp.get('background'): c['background']=sp['background']
        if sp.get('occupation'): c['occupation']=sp['occupation']
        for k in ('other_issues','record','endorsements'):
            if sp.get(k): c[k]=(c.get(k) or [])+sp[k]
        c.setdefault('positions',{})
        for iid,spec_ in (sp.get('positions') or {}).items():
            st,summ,quote,srcs=spec_[:4]; conf=spec_[4] if len(spec_)>4 else 'stated'
            assert iid in issues, iid
            assert srcs, (cid,iid)
            c['positions'][iid]={"stance":st,"confidence":conf,"summary":summ,"quote":quote,"sources":[{"title":t,"url":u,"date":dt} for t,u,dt in srcs]}
            n+=1
        if d.get('coverage')=='roster' and any(v.get('stance') is not None for v in c['positions'].values()): d['coverage']='partial'
    ind=1 if raw.startswith('{\n "') else 2
    open(p,'w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=ind)+'\n')
print('positions written',n)
