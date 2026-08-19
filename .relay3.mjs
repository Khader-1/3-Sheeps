import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args:['--hide-scrollbars'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 800 });
await p.goto('http://127.0.0.1:8787/present.html', { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 800));
await p.keyboard.press('6');
await new Promise(r => setTimeout(r, 1200));
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 3500));
const here = () => p.evaluate(() => [...document.querySelectorAll('.slide')].find(s => s.classList.contains('on'))?.id);
const inFrame = () => p.evaluate(() => { document.querySelector('#games-holder iframe').contentWindow.focus(); });
const carousel = () => p.evaluate(() => {
  const d = document.querySelector('#games-holder iframe').contentDocument;
  const g = [...d.querySelectorAll('g[opacity]')].filter(e => e.getAttribute('opacity') === '1');
  return g.length ? g[g.length-1].getAttribute('transform') : 'n/a';
});
console.log('start              :', await here(), '| card', await carousel());

for (const [k, note] of [['ArrowDown','out of games'], ['ArrowUp','back to games'], ['ArrowLeft','carousel keeps it'], ['ArrowRight','carousel keeps it']]) {
  await inFrame();
  const c0 = await carousel();
  await p.keyboard.press(k);
  await new Promise(r => setTimeout(r, 3500));
  const c1 = await carousel();
  console.log(`${k.padEnd(11)} -> ${(await here()).padEnd(9)} card ${c0 === c1 ? 'same ' : 'MOVED'}   (${note})`);
}
await b.close();
