# Florida Voters Guide — November 3, 2026

A nonpartisan, source-cited voter guide for Florida's 2026 general election: official candidate line-ups for all 67 counties, and in-depth coverage of every race and ballot question a **Sumter County** voter will see, with a questionnaire that matches your views to each candidate's documented positions.

**Covers all 67 Florida counties** at the ballot-line-up level (official candidate lists for Congress, the Legislature, judges and county offices, plus each Supervisor of Elections) and Sumter County in depth (researched positions, match tool, referendums, voting logistics).

**No build step, no framework, no server required.** Open `index.html` in a browser, or host the folder on GitHub Pages / Netlify / any static host.

## What it does

- **Every contested race on the Sumter County ballot**, verified against the Supervisor of Elections' official 2026 General Election sample ballot: U.S. Senate (special), U.S. House 11, Governor/Lt. Governor, Attorney General, CFO, Agriculture Commissioner and Florida House 52, plus the three constitutional amendments, two county referendums (fuel-tax renewal and a 2% tourist development tax), four judicial merit-retention questions, the precinct-limited city and Village CDD contests, and seats already decided in August or filled without opposition (including County Commission District 4, where the write-in withdrew).
- **Candidate profiles** with photo, background, how they got on the ballot, positions on 21 major issues (each with a neutral summary, quote where available, and sources), *other issues the candidate has raised on their own*, a documented record, and reported endorsements.
- **Side-by-side comparison** per race.
- **"Match me"**: swipe or tap through 21 statements (with a "matters a lot" weighting) while a live leaderboard updates after every answer; results show a percentage match per candidate per race, with the number of issues the score is based on shown openly.
- **Landscape map**: candidates plotted as photo bubbles by the average of their documented stances on economic and social/legal statements, with you plotted as a star after the quiz.
- **"Where they split" heat strip** above every comparison table, and a countdown to registration, mail-ballot and election deadlines on the home page.
- **Photos**: portraits in `assets/photos/<candidate_id>.jpg` are used first, then the remote `photo_url`, then initials. Drop a file named after the candidate id (see `data/research/*.json`) to add or replace one, or list `<id> <image-url>` pairs in `data/photo_urls.txt` and run `python3 scripts/fetch_photos.py` from a normal internet connection.
- **Neutrality rules** enforced in the data: positions are described in the candidate's own words, loaded labels are not used, and if a candidate has not taken a public position the guide says **"No public position found"** instead of guessing from party. Unknown positions are excluded from match scores.

## All-county coverage

Pick any county from the home page or `#/counties`. Each county page (`#/county/<code>`, e.g. `#/county/LAK`) shows:

- the congressional, Florida Senate and Florida House districts that cover the county (with "part of the county" flagged) and which Senate seats are up in 2026;
- the official candidate line-up for every such district, for circuit-judge contests in the county's judicial circuit, for the District Court of Appeal retention questions the county votes on, and for county offices (commission, school board, county judge, constitutional officers), with special districts collapsed;
- the county's Supervisor of Elections contact and website (for sample ballots, early voting and mail ballots).

Sources are official and rebuilt by `python3 scripts/build_statewide.py` from `data/statewide/`: the Division of Elections candidate extract (contact fields stripped), the Census county-to-congressional-district file, the Legislature's district-by-county listings, the judicial-circuit and appellate-district statutes, and the Division of Elections supervisor directory. Candidate **positions** are researched only for the races on the Sumter County ballot; other counties get line-ups, not profiles. City elections and local referendums are not in the state list, so county pages point to the county sample ballot for those.

## Project layout

```
index.html            App shell
assets/styles.css     Design (light/dark, responsive, print)
assets/app.js         Router, views, matching algorithm
data/issues.json      The 21 issue statements and which office levels they apply to
data/races.json       Race metadata (what the office does, term, level)
data/research/*.json  One file per race with candidates, positions, sources (editable)
data/research/supplements.json  Editor-coded positions from documented votes that fill gaps
data/guide.js         GENERATED — the merged dataset the site loads
data/statewide/*.json Official statewide inputs (candidate extract, district maps, judicial geography, supervisors)
data/statewide.js     GENERATED — per-county districts and candidate line-ups for all 67 counties
scripts/build_data.py Merges data/*.json into data/guide.js and validates it
scripts/build_statewide.py Builds data/statewide.js from data/statewide/
docs/RESEARCH_BRIEF.md The research brief and JSON schema used to collect the data
```

## Publishing it (free) and getting it into Google

1. **Merge this branch into `main`.** The workflow in `.github/workflows/pages.yml` runs on every push to `main`: it rebuilds the data, prerenders every race and candidate into a real HTML page (`/candidates/david-jolly/`, `/races/governor-lieutenant-governor/`, …), writes `sitemap.xml` and `robots.txt`, and deploys to GitHub Pages.
2. **Enable Pages once:** GitHub repo → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**. The site appears at `https://<your-username>.github.io/Political-Party-Rock-Anthem/` within a couple of minutes.
3. **Optional custom domain** (recommended for search ranking and trust): buy a domain, add it under Settings → Pages → Custom domain, and commit a `CNAME` file containing the domain. The prerender picks up the new base URL automatically.
4. **Tell Google:** go to [Google Search Console](https://search.google.com/search-console), add the site URL, verify ownership (the HTML-tag method works: paste the tag into `index.html`), then submit `https://<site>/sitemap.xml`. Use *URL inspection → Request indexing* on the home page to speed things up. Bing Webmaster Tools accepts the same sitemap.

Prerendering is what makes individual candidates and races show up as separate search results; without it Google would only see the home page.

## Updating the data

1. Edit the relevant file in `data/research/` (or add a stance in `data/research/supplements.json`). Every coded stance **must** have at least one source; the build script downgrades unsourced stances to "unknown".
2. Run `python3 scripts/build_data.py`.
3. Reload the page.

Stance scale: `2` strongly agrees with the statement, `1` leans agree, `0` mixed/neutral, `-1` leans disagree, `-2` strongly disagrees, `null` no public position found. `confidence` is `stated` (explicit statement), `record` (vote or official action) or `unknown`.

## Known gaps (as of the third data pass, Sept 17, 2026)

The third pass could open most official and news pages directly (Ballotpedia and Florida Politics remained blocked, so those are cited only through search snippets). The ballot line-up, ballot language and judicial roster now come from the official sample ballot and the Division of Elections booklet. Remaining gaps, visible on each profile as "No public position found":

- **Florida House 52**: Samantha Scott took office March 25, 2026, after the regular session, so her only floor vote is the June 2026 property-tax special session; her campaign site states values rather than issue positions. Pamala Bivins' site lists priorities without detail.
- **Minor gubernatorial candidates**: Dr. Jeff Datto has no campaign site; Dean Abrams' site could not be fetched (positions come from search excerpts of it); Frank Russo and Moe Dimanche state only a few positions.
- **U.S. House 11**: Joe Strada did not answer any questionnaire; James Pericola has not stated positions on abortion, guns or immigration; Ralph Groves' positions come from his own site.
- **Cabinet races**: legislative roll-call votes fill most gaps for Ingoglia, Taddeo, Simpson and Rodríguez, but neither Democrat has stated positions on several state issues in the 2026 campaign, and Joey Mendoza Atkins' platform is brief.
- **Voting logistics**: whether drop boxes will be at every early-voting site was not stated on the county page.

See `docs/RESEARCH_BRIEF.md` to extend the research with the same rules.
