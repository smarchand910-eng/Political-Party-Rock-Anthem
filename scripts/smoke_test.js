/* Render every route of the site in headless Chromium and fail if any page throws a JavaScript error or comes up empty.
   Runs in both languages. Usage: node scripts/smoke_test.js   (needs the `playwright` package; set CHROME_PATH to use a
   specific Chromium binary). Used by .github/workflows/smoke.yml on every pull request. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const parse = file => { const js = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'); return JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1)); };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const data = parse('guide.js'); const sw = parse('statewide.js');
  const routes = ['#/', '#/where', '#/races', '#/races/group/U.S.%20House', '#/match', '#/match/results', '#/match/cheatsheet', '#/amendments', '#/judges', '#/vote', '#/about', '#/counties'];
  for (const r of data.races) { routes.push(`#/race/${r.id}`); for (const c of r.candidates || []) routes.push(`#/candidate/${c.id}`); }
  for (const c of Object.values(sw.counties)) routes.push(`#/county/${c.code}`);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  await page.route('**/*', r => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const failures = [];
  let current = '';
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => failures.push(`${current}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) failures.push(`${current}: console: ${m.text()}`); });
  let count = 0;
  for (const lang of ['en', 'es']) {
    await page.goto(base + '#/');
    await page.evaluate(l => { localStorage.setItem('flguide.lang', l); localStorage.removeItem('flguide.profile'); }, lang);
    await page.reload();
    for (const hash of routes) {
      current = `[${lang}] ${hash}`;
      await page.evaluate(h => { location.hash = h; }, hash);
      const text = await page.evaluate(() => document.querySelector('main').innerText.trim());
      if (text.length < 20) failures.push(`${current}: rendered ${text.length} characters`);
      if (/^Not found|^No encontrado/.test(text) && !/nope/.test(hash)) failures.push(`${current}: rendered the not-found page`);
      count++;
    }
    // the profile-dependent pages, with an address set
    await page.evaluate(() => { location.hash = '#/where'; });
    await page.evaluate(() => { document.querySelectorAll('details').forEach(d => { d.open = true; }); });
    await page.selectOption('select[name=county]', 'Sumter'); await page.fill('input[name=cd]', '11'); await page.fill('input[name=sd]', '12'); await page.fill('input[name=hd]', '33');
    await page.click('[data-manual-form] button[type=submit]');
    for (const hash of ['#/', '#/races', '#/vote', '#/judges', '#/match', '#/match/results', '#/match/cheatsheet']) {
      current = `[${lang} + Sumter] ${hash}`;
      await page.evaluate(h => { location.hash = h; }, hash);
      const text = await page.evaluate(() => document.querySelector('main').innerText.trim());
      if (text.length < 20) failures.push(`${current}: rendered ${text.length} characters`);
      count++;
    }
    await page.evaluate(() => { location.hash = '#/match'; });
    await page.click('[data-answer="2"]'); await page.click('[data-answer="-1"]'); await page.click('[data-answer="1"]');
    current = `[${lang}] results after 3 answers`;
    await page.evaluate(() => { location.hash = '#/match/results'; });
    const pct = await page.evaluate(() => document.querySelectorAll('.match-pct').length);
    if (!pct) failures.push(`${current}: no match rows rendered`);
    current = `[${lang}] cheat sheet after 3 answers`;
    await page.evaluate(() => { location.hash = '#/match/cheatsheet'; });
    const boxes = await page.evaluate(() => document.querySelectorAll('.cs-box').length);
    if (boxes < 10) failures.push(`${current}: only ${boxes} checkboxes rendered`);
    await page.evaluate(() => { location.hash = '#/match'; });
    await page.click('[data-reset="1"]');
  }
  await browser.close(); server.close();
  console.log(`Rendered ${count} pages.`);
  if (failures.length) { console.error(`FAILED (${failures.length}):`); failures.slice(0, 50).forEach(f => console.error('  ' + f)); process.exit(1); }
  console.log('All pages rendered without JavaScript errors.');
})().catch(e => { console.error(e); process.exit(1); });
