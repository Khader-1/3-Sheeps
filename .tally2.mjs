import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const S = '/private/tmp/claude-501/-Users-khaderkhudair-projects-sheeps/3bf8c22e-7895-43b5-bd6e-6a07f4ceded9/scratchpad';
const WORDS = ['لعبة', 'لعبتان', 'حتى ثلاث ألعاب', 'سبع ألعاب'];
const TOP = process.argv[2] || null;   // em value to try, or null for as-is

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args:['--hide-scrollbars','--font-render-hinting=none'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
await p.goto('http://127.0.0.1:8787/present.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1000));

for (const word of WORDS) {
  const m = await p.evaluate((word, TOP) => {
    document.querySelectorAll('.slide').forEach((s) => s.classList.remove('on'));
    document.getElementById('s-games').classList.add('on');
    const t = document.getElementById('tally');
    t.classList.add('on');
    const n = document.getElementById('tally-n');
    n.textContent = word;
    n.classList.add('cut');
    if (TOP) {
      let st = document.getElementById('probe-css');
      if (!st) { st = document.createElement('style'); st.id = 'probe-css'; document.head.appendChild(st); }
      st.textContent = `.tally .w.n::after{top:${TOP} !important}`;
    }
    const r = n.getBoundingClientRect();
    return { fs: parseFloat(getComputedStyle(n).fontSize), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  }, word, TOP);
  await new Promise(r => setTimeout(r, 450));
  const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 1600, height: 900 } });
  fs.writeFileSync(`${S}/probe.png`, buf);
  fs.writeFileSync(`${S}/probe.json`, JSON.stringify({ word, ...m }));
  const { execFileSync } = await import('node:child_process');
  execFileSync('ffmpeg', ['-y','-loglevel','error','-i',`${S}/probe.png`,'-f','rawvideo','-pix_fmt','rgb24',`${S}/probe.raw`]);
  const out = execFileSync('python3', ['-c', `
import json
m = json.load(open('${S}/probe.json'))
W,H = 1600,900
d = open('${S}/probe.raw','rb').read()
def px(x,y):
    i=(y*W+x)*3
    return d[i],d[i+1],d[i+2]
X0,X1 = m['x'], m['x']+m['w']
rule=[]; widths=[]
for y in range(m['y']-40, m['y']+220):
    nr=ni=0
    for x in range(X0,X1):
        r,g,b = px(x,y)
        if r>200 and 180<g<235 and b<120: nr+=1
        elif r>200 and g>225 and b>150:   ni+=1
    if nr>20: rule.append(y)
    widths.append((y,ni))
mx=max(w for _,w in widths) or 1
body=[y for y,w in widths if w>mx*0.45]
rc=(rule[0]+rule[-1])/2 if rule else 0
bc=(body[0]+body[-1])/2
print(f"{m['word']:>16}  rule {rc:6.1f}   body {body[0]}..{body[-1]} c={bc:6.1f}   off {rc-bc:+6.1f}px  ({(rc-bc)/m['fs']:+.3f}em)")
`]).toString();
  process.stdout.write(out);
}
await b.close();
