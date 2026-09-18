// Report how many candidates in researched, live races have enough coded positions to be plotted on the
// landscape map (3+ economic and 3+ social stances). Usage: node scripts/audit_placement.js
const fs = require('fs');
const js = fs.readFileSync('data/guide.js', 'utf8');
const D = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
const AXES = { x: ['taxes', 'property_tax', 'healthcare', 'housing', 'insurance', 'energy', 'social_security'], y: ['immigration', 'abortion', 'guns', 'education_choice', 'elections', 'crime', 'lgbtq', 'marijuana', 'environment', 'trump'] };
const n = (c, a) => AXES[a].filter(k => c.positions[k] && c.positions[k].stance != null).length;
let placed = 0, total = 0, zero = [], coded = 0;
for (const r of D.races) {
  if (!['full', 'partial'].includes(r.coverage) || r.on_november_ballot === false) continue;
  for (const c of r.candidates || []) {
    if (c.withdrawn || c.party === 'Write-in') continue;
    total++; coded += Object.values(c.positions).filter(p => p.stance != null).length;
    if (n(c, 'x') >= 3 && n(c, 'y') >= 3) placed++;
    if (!Object.values(c.positions).some(p => p.stance != null)) zero.push(r.id + ':' + c.id);
  }
}
console.log(`placed ${placed} of ${total} | zero positions ${zero.length} | coded stances ${coded}`);
if (process.argv.includes('--list')) console.log(zero.join('\n'));
