# Step 1 of 2: transcribe Esther's Chinese (CUV, Wordproject) audio with
# word-level timestamps using a local Whisper model (Apple-Silicon mlx-whisper).
# Not part of the regular build — only needed if the Chinese audio changes.
#   python3 -m venv /tmp/whisper-venv && /tmp/whisper-venv/bin/pip install mlx-whisper pypinyin
#   /tmp/whisper-venv/bin/python scripts/chinese-timing/transcribe.py
# Output: $ESTHER_WHISPER_DIR/cmn-chN.json (default /tmp/esther-whisper).
import json, os, mlx_whisper
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','audio','cmn')
out=os.environ.get('ESTHER_WHISPER_DIR','/tmp/esther-whisper')
os.makedirs(out,exist_ok=True)
for n in range(1,11):
    # The simplified-script prompt nudges Whisper toward simplified output; the
    # aligner works on pinyin anyway, so script/homophone differences don't matter.
    r=mlx_whisper.transcribe(f'{base}/chapter-{n}.mp3', path_or_hf_repo='mlx-community/whisper-small-mlx', word_timestamps=True, language='zh', initial_prompt='以下是简体中文的圣经朗读。', condition_on_previous_text=False)
    words=[{'w':w['word'],'s':w['start'],'e':w['end']} for seg in r['segments'] for w in seg.get('words',[])]
    json.dump(words,open(f'{out}/cmn-ch{n}.json','w'),ensure_ascii=False)
    print('chapter',n,len(words),'words',flush=True)
print('ALLDONE',flush=True)
