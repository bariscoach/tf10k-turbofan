#!/bin/bash
# Build the game page from its source: inline the engine-simulation, audio and gauge blocks into hawk-landing.src.html.
# Writes ../index.html (the site; keeps the site's own <head>), out/hawk-landing.html (standalone page),
# out/artifact.html (Claude artifact copy: absolute test-cell links, building data under .wasm names) and
# ../preview.html (local test page, not committed). Then checks the script's syntax.
set -e; cd "$(dirname "$0")"
python3 -I - <<'PY'
s=open('hawk-landing.src.html',encoding='utf-8').read()
sim=open('sim-block.js',encoding='utf-8').read();gau=open('gauge-block.js',encoding='utf-8').read()
aud=open('audio-block.js',encoding='utf-8').read().replace('const src=(buf,rate)=>','audio.white=white;audio.brown=brown;const src=(buf,rate)=>',1)
out=s.replace('/*__SIM__*/',sim).replace('/*__AUDIO__*/',aud).replace('/*__GAUGE__*/',gau);assert '/*__' not in out
import datetime;stamp=datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')   # build stamp in the panel footer, to tell versions apart
assert out.count('<div class="credit-foot">Made by Baris Hiz</div>')==1;out=out.replace('<div class="credit-foot">Made by Baris Hiz</div>','<div class="credit-foot">Made by Baris Hiz · build '+stamp+'</div>')
open('out/hawk-landing.html','w',encoding='utf-8').write(out)
art=out.replace('<a href="testcell" id="tcLink">','<a href="https://tf10k-turbofan.vercel.app/testcell" id="tcLink">').replace('<a class="opt" id="btnEngine" href="testcell">','<a class="opt" id="btnEngine" href="https://tf10k-turbofan.vercel.app/testcell" target="_blank" rel="noopener">')
art=art.replace("'ob_'+key+'.dat'","'ob_'+key+'.wasm'")  # artifacts only serve known binary types; same gzip bytes
assert art.count('vercel.app/testcell')==2 and "'.wasm'" in art;open('out/artifact.html','w',encoding='utf-8').write(art)
old=open('../index.html',encoding='utf-8').read();head=old[:old.index('<div id="app"')];hb=head[:head.index('</style>\n')+len('</style>\n')]
body=out.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','');j=body.index('<div id="app"')
open('../index.html','w',encoding='utf-8').write(hb+body[:j]+'</head>\n<body>\n'+body[j:]+'\n</body>\n</html>\n')
open('../preview.html','w',encoding='utf-8').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html{color-scheme:dark}body{margin:0}[hidden]{display:none!important}</style>'+out.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')+'</body></html>')
PY
awk '/<script>$/{f=1;next}/<\/script>/{f=0}f' out/hawk-landing.html > out/check.js && node --check out/check.js && echo SYNTAX_OK
