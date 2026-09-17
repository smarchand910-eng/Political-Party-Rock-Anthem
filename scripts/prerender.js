/* Prerender every route of the single-page app into real HTML files so search engines can index
   candidates, races and ballot questions as separate URLs.

   Usage:  SITE_URL=https://example.com node scripts/prerender.js
   Needs:  node + the `playwright` package with Chromium (see .github/workflows/pages.yml).
   Output: dist/  (copy of the site plus one index.html per route, sitemap.xml, robots.txt, 404.html) */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://example.github.io/Political-Party-Rock-Anthem').replace(/\/$/, '');
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, ''); // '' for a custom domain, '/repo' for project pages

const data = (() => { const js = fs.readFileSync(path.join(ROOT, 'data', 'guide.js'), 'utf8'); return JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1)); })();
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// route -> output folder + metadata
const routes = [
  { hash: '#/', out: '', title: 'Sumter County Voter Guide 2026', desc: 'Nonpartisan, source-cited guide to every race and ballot question for Sumter County, Florida voters in the November 3, 2026 election, with a tool that matches your views to the candidates.' },
  { hash: '#/races', out: 'races', title: 'Races on the Sumter County ballot — November 3, 2026', desc: 'Every contested race on the Sumter County, Florida ballot: U.S. Senate, U.S. House 11, Governor, Cabinet, Florida House 52, County Commission and more.' },
  { hash: '#/match', out: 'match', title: 'Match me to the candidates — Sumter County Voter Guide', desc: 'Answer 21 statements and see which Sumter County candidates come closest to your views, based only on their documented positions.' },
  { hash: '#/amendments', out: 'amendments', title: 'Florida 2026 constitutional amendments explained', desc: 'Official ballot language, what Yes and No mean, fiscal impact, and who supports and opposes Amendments 1, 2 and 3 on Florida\'s November 2026 ballot.' },
  { hash: '#/judges', out: 'judges', title: 'Judicial merit retention 2026 — Sumter County', desc: 'Background on the Florida Supreme Court justice and Fifth District Court of Appeal judges on the Sumter County retention ballot.' },
  { hash: '#/vote', out: 'how-to-vote', title: 'How and where to vote in Sumter County, Florida', desc: 'Registration deadline, mail ballot deadlines, early voting sites and hours, ID rules and Election Day details for Sumter County.' },
  { hash: '#/about', out: 'methodology', title: 'Methodology and neutrality rules — Sumter County Voter Guide', desc: 'How candidate positions are sourced and coded, why some are marked unknown, and how the match score works.' },
];
for (const r of data.races) {
  routes.push({ hash: `#/race/${r.id}`, out: `races/${slug(r.title)}`, title: `${r.title} — Sumter County 2026 candidates compared`, desc: `Candidates for ${r.title} on the November 3, 2026 Sumter County ballot: ${r.candidates.map(c => `${c.name} (${c.party})`).join(', ')}. Positions on the major issues, side by side, with sources.` });
  for (const c of r.candidates) {
    routes.push({ hash: `#/candidate/${c.id}`, out: `candidates/${slug(c.name)}`, title: `${c.name} (${c.party}) — ${r.title}, 2026`, desc: (c.background || '').slice(0, 155), person: { name: c.name, party: c.party, race: r.title, image: c.photo_local ? `${SITE_URL}/${c.photo_local}` : c.photo_url, url: c.website } });
  }
}

function copyDir(src, dest) { fs.mkdirSync(dest, { recursive: true }); for (const e of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, e.name), d = path.join(dest, e.name); e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); } }

(async () => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'data', 'guide.js'), path.join(DIST, 'data', 'guide.js'));
  if (fs.existsSync(path.join(ROOT, 'CNAME'))) fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(DIST, 'CNAME'));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

  const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  const urls = [];
  for (const r of routes) {
    await page.evaluate(h => { location.hash = h; }, r.hash);
    await page.waitForTimeout(120);
    const main = await page.$eval('#main', el => el.innerHTML);
    const url = `${SITE_URL}/${r.out}${r.out ? '/' : ''}`;
    urls.push(url);
    const jsonld = r.person
      ? { '@context': 'https://schema.org', '@type': 'Person', name: r.person.name, description: r.desc, image: r.person.image || undefined, url: r.person.url || undefined, affiliation: r.person.party, knowsAbout: r.person.race }
      : { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Sumter County Voter Guide 2026', url: SITE_URL + '/', description: routes[0].desc };
    let html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(r.title)}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(r.desc)}" />`)
      .replace('<link rel="stylesheet" href="assets/styles.css" />', `<base href="${BASE_PATH}/" />\n  <link rel="canonical" href="${url}" />\n  <meta property="og:type" content="website" />\n  <meta property="og:title" content="${esc(r.title)}" />\n  <meta property="og:description" content="${esc(r.desc)}" />\n  <meta property="og:url" content="${url}" />\n  ${r.person && r.person.image ? `<meta property="og:image" content="${esc(r.person.image)}" />` : ''}\n  <meta name="twitter:card" content="summary" />\n  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n  <link rel="stylesheet" href="assets/styles.css" />`)
      .replace('<main id="main" class="container" tabindex="-1"></main>', `<main id="main" class="container" tabindex="-1" data-route="${esc(r.hash)}">${main}</main>`);
    const dir = path.join(DIST, r.out);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  await browser.close();
  fs.copyFileSync(path.join(DIST, 'index.html'), path.join(DIST, '404.html'));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  console.log(`prerendered ${routes.length} pages into dist/ for ${SITE_URL}`);
})();
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
