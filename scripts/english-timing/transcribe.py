# Step 1 of 2: transcribe Esther's English (BSB) audio with word-level
# timestamps using a local Whisper model (Apple-Silicon mlx-whisper).
# Not part of the regular build — only needed if the English audio changes.
#   python3 -m venv /tmp/whisper-venv && /tmp/whisper-venv/bin/pip install mlx-whisper
#   /tmp/whisper-venv/bin/python scripts/english-timing/transcribe.py
# Output: $ESTHER_WHISPER_DIR/chN.json (default /tmp/esther-whisper).
import json, sys, mlx_whisper
import os
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','audio','eng')
out=os.environ.get('ESTHER_WHISPER_DIR','/tmp/esther-whisper')
os.makedirs(out,exist_ok=True)
for n in range(1,11):
    r=mlx_whisper.transcribe(f'{base}/chapter-{n}.mp3', path_or_hf_repo='mlx-community/whisper-small-mlx', word_timestamps=True, language='en', condition_on_previous_text=False)
    words=[{'w':w['word'],'s':w['start'],'e':w['end']} for seg in r['segments'] for w in seg.get('words',[])]
    json.dump(words,open(f'{out}/ch{n}.json','w'))
    print('chapter',n,len(words),'words',flush=True)
print('ALLDONE',flush=True)
