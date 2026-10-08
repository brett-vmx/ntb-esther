# Step 2 of 2: align each chapter's CUV verse text (from the generated chapter
# JSON) against transcribe.py's word timestamps, writing
# source-assets/timing/cmn_17_EST_N.txt (tab-separated start/end/verse — same
# shape as the other tracks). Matching is done on toneless pinyin syllables
# with difflib, so simplified/traditional output and homophone errors from
# Whisper don't matter. Prints per-chapter match quality; verses under 60%
# matched are listed (times are interpolated for those).
# Run `npm run gen-chapters` afterwards to fold the timing into the JSON.
# Usage: ESTHER_WHISPER_DIR=/tmp/esther-whisper python3 scripts/chinese-timing/align.py
import json, os, re, difflib
from pypinyin import lazy_pinyin
E=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
W=os.environ.get('ESTHER_WHISPER_DIR','/tmp/esther-whisper')
HAN=re.compile(r'[一-鿿]')
def syl(s): return lazy_pinyin(''.join(HAN.findall(s)))
for n in range(1,11):
    ch=json.load(open(f'{E}/src/content/chapters/chapter-{n}.json'))
    # CUV folds some verses into a neighbour (Esther 1:14 is empty — its words are
    # inside 1:13), so verses with no Chinese text get no timing row.
    verses=[(b['number'],b['cmn']) for b in ch['blocks'] if b['type']=='verse' and HAN.search(b['cmn'])]
    ref=[];vid=[]
    for v,t in verses:
        for s in syl(t): ref.append(s); vid.append(v)
    hyp=[];ht=[]
    for w in json.load(open(f'{W}/cmn-ch{n}.json')):
        chars=HAN.findall(w['w'])
        if not chars: continue
        for i,s in enumerate(lazy_pinyin(''.join(chars))):
            hyp.append(s); ht.append(w['s']+(w['e']-w['s'])*i/len(chars))
    sm=difflib.SequenceMatcher(None,ref,hyp,autojunk=False)
    m={}
    for a,b,size in sm.get_matching_blocks():
        for i in range(size): m[a+i]=b+i
    times=[];stats=[]
    for v,_ in verses:
        idxs=[i for i,x in enumerate(vid) if x==v]
        matched=[i for i in idxs if i in m]
        stats.append((v,len(matched)/len(idxs)))
        if matched:
            i0=matched[0]
            times.append(max(ht[m[i0]]-0.22*(i0-idxs[0]),0))  # back off over unmatched leading syllables
        else: times.append(None)
    for i,t in enumerate(times):
        if t is None:
            lo=next((j for j in range(i-1,-1,-1) if times[j] is not None),None)
            hi=next((j for j in range(i+1,len(times)) if times[j] is not None),None)
            if lo is not None and hi is not None: times[i]=times[lo]+(times[hi]-times[lo])*(i-lo)/(hi-lo)
            elif lo is not None: times[i]=times[lo]+3
            else: times[i]=0
    for i in range(1,len(times)):
        if times[i]<=times[i-1]: times[i]=times[i-1]+0.05
    with open(f'{E}/source-assets/timing/cmn_17_EST_{n}.txt','w') as f:
        for (v,_),t in zip(verses,times): f.write(f'{t:.3f}\t{t:.3f}\t{v}\n')
    low=[(v,round(fr,2)) for v,fr in stats if fr<0.6]
    print(f'ch{n}: verses={len(verses)} ref={len(ref)} hyp={len(hyp)} overall-match={len(m)/len(ref):.2f} first={times[0]:.1f}s last={times[-1]:.1f}s low-match-verses={low}')
