# Step 2 of 2: align each chapter's BSB verse text (from the generated chapter
# JSON) against transcribe.py's word timestamps with difflib, writing
# source-assets/timing/eng_17_EST_N.txt (tab-separated start/end/verse — same
# shape as John's adx/khg exports). Prints per-chapter match quality; verses
# under 60% matched are listed (chapter 9 v7-9 are Haman's sons' names, which
# Whisper spells differently from the BSB text — times are still correct).
# Run `npm run gen-chapters` afterwards to fold the timing into the JSON.
# Usage: ESTHER_WHISPER_DIR=/tmp/esther-whisper python3 scripts/english-timing/align.py
import json, re, difflib, sys
import os
E=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
W=os.environ.get('ESTHER_WHISPER_DIR','/tmp/esther-whisper')
norm=lambda s: re.sub(r"[^a-z0-9]","",s.lower().replace("’","").replace("'",""))
worst=[]
for n in range(1,11):
    ch=json.load(open(f'{E}/src/content/chapters/chapter-{n}.json'))
    verses=[(b['number'],b['en']) for b in ch['blocks'] if b['type']=='verse']
    ref=[];vid=[]
    for v,t in verses:
        for tok in t.split():
            k=norm(tok)
            if k: ref.append(k); vid.append(v)
    hyp=[];hw=[]
    for w in json.load(open(f'{W}/ch{n}.json')):
        k=norm(w['w'])
        if k: hyp.append(k); hw.append(w)
    sm=difflib.SequenceMatcher(None,ref,hyp,autojunk=False)
    m={}
    for a,b,size in sm.get_matching_blocks():
        for i in range(size): m[a+i]=b+i
    times=[];stats=[]
    prev=-1
    for v,_ in verses:
        idxs=[i for i,x in enumerate(vid) if x==v]
        matched=[i for i in idxs if i in m]
        frac=len(matched)/len(idxs)
        stats.append((v,frac))
        if matched:
            i0=matched[0]; t=hw[m[i0]]['s']-0.25*(i0-idxs[0])*0.5  # small backoff if first words unmatched
            t=max(t,0)
        else:
            t=None
        times.append(t)
    # fill gaps by interpolation, enforce monotonic
    for i,t in enumerate(times):
        if t is None:
            lo=next((j for j in range(i-1,-1,-1) if times[j] is not None),None)
            hi=next((j for j in range(i+1,len(times)) if times[j] is not None),None)
            if lo is not None and hi is not None: times[i]=times[lo]+(times[hi]-times[lo])*(i-lo)/(hi-lo)
            elif lo is not None: times[i]=times[lo]+3
            else: times[i]=0
    for i in range(1,len(times)):
        if times[i]<=times[i-1]: times[i]=times[i-1]+0.05
    with open(f'{E}/source-assets/timing/eng_17_EST_{n}.txt','w') as f:
        for (v,_),t in zip(verses,times): f.write(f'{t:.3f}\t{t:.3f}\t{v}\n')
    low=[(v,round(fr,2)) for v,fr in stats if fr<0.6]
    print(f'ch{n}: verses={len(verses)} ref={len(ref)} hyp={len(hyp)} overall-match={sum(1 for i in range(len(ref)) if i in m)/len(ref):.2f} first={times[0]:.1f}s last={times[-1]:.1f}s low-match-verses={low}')
