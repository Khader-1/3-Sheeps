import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args:['--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 800 });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8787/present.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 800));

const settled = async (want) => {
  for (let i = 0; i < 40; i++) {
    const s = await p.evaluate(() => ({
      on: [...document.querySelectorAll('.slide')].find(x => x.classList.contains('on'))?.id,
      over: document.querySelector('.over')?.classList.contains('on'),
      tally: document.getElementById('tally').classList.contains('on'),
    }));
    if (s.on === want && !s.over && !s.tally) return s.on;
    await new Promise(r => setTimeout(r, 250));
  }
  return 'TIMEOUT';
};
const inFrame = () => p.evaluate(() => document.querySelector('#games-holder iframe').contentWindow.focus());
const focusedFrame = () => p.evaluate(() => document.activeElement?.tagName);
const card = () => p.evaluate(() => {
  const d = document.querySelector('#games-holder iframe').contentDocument;
  const g = [...d.querySelectorAll('g')].filter(e => e.getAttribute('opacity') === '1');
  return g.map(e => e.getAttribute('transform')).join('|');
});

await p.keyboard.press('6');
await settled('s-games');
await p.evaluate(() => document.getElementById('tally').click());   // skip the count
await new Promise(r => setTimeout(r, 2500));
console.log('parked on          :', await settled('s-games'));
await inFrame();
console.log('focus is           :', await focusedFrame(), '(IFRAME = keys go inside)');

const c0 = await card();
await p.keyboard.press('ArrowLeft');
await new Promise(r => setTimeout(r, 900));
console.log('ArrowLeft  slide   :', (await p.evaluate(() => [...document.querySelectorAll('.slide')].find(x=>x.classList.contains('on'))?.id)),
            '| carousel', (await card()) === c0 ? 'unchanged' : 'MOVED  <- game kept it');

await inFrame();
await p.keyboard.press('ArrowDown');
console.log('ArrowDown  slide   :', await settled('s-book'), ' <- escaped the frame');

await p.keyboard.press('ArrowUp');
console.log('ArrowUp    slide   :', await settled('s-games'));

await inFrame();
await p.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 600));
console.log('Escape     overview:', await p.evaluate(() => document.querySelector('.over')?.classList.contains('on')));
await b.close();
