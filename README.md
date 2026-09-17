# Florida Voters Guide — November 3, 2026

A nonpartisan, source-cited voter guide for the races and ballot questions on a **Florida** voter's ballot in the 2026 general election, filtered by address, with a questionnaire that matches your views to each candidate's documented positions. It began as a Sumter County guide, and Sumter's races carry the deepest research.

**No build step, no framework, no server required.** Open `index.html` in a browser, or host the folder on GitHub Pages / Netlify / any static host.

## What it does

- **Address lookup.** A voter enters a Florida street address; the U.S. Census Bureau's public geocoder returns the county, congressional district and state legislative districts, and the site keeps only those numbers in the browser. A manual county/district form is provided as a fallback. Nothing is stored on the visitor's device: the profile and quiz answers reset on every page load.
- **Ballot filtering.** Every race carries a `jurisdiction` (`statewide`, `cd`, `sd`, `hd` or `county`). Home, Races, Match results, Judges and How-to-vote pages show only what is on that voter's ballot; everything else stays reachable under "Other Florida races".
- **Coverage badges.** Races are marked `full` (positions researched), `partial`, `roster` (candidate list verified, positions not yet researched) or `none`, so gaps are visible instead of hidden.

- **Every contested race on the Sumter County ballot**: U.S. Senate (special), U.S. House 11, Governor/Lt. Governor, Attorney General, CFO, Agriculture Commissioner, Florida House 52, County Commission District 4, plus the three constitutional amendments, judicial merit retention, and seats already decided in August.
- **Candidate profiles** with photo, background, how they got on the ballot, positions on 21 major issues (each with a neutral summary, quote where available, and sources), *other issues the candidate has raised on their own*, a documented record, and reported endorsements.
- **Side-by-side comparison** per race.
- **"Match me"**: swipe or tap through 21 statements (with a "matters a lot" weighting) while a live leaderboard updates after every answer; results show a percentage match per candidate per race, with the number of issues the score is based on shown openly.
- **Landscape map**: candidates plotted as photo bubbles by the average of their documented stances on economic and social/legal statements, with you plotted as a star after the quiz.
- **"Where they split" heat strip** above every comparison table, and a countdown to registration, mail-ballot and election deadlines on the home page.
- **Photos**: portraits in `assets/photos/<candidate_id>.jpg` are used first, then the remote `photo_url`, then initials. Drop a file named after the candidate id (see `data/research/*.json`) to add or replace one, or list `<id> <image-url>` pairs in `data/photo_urls.txt` and run `python3 scripts/fetch_photos.py` from a normal internet connection.
- **Neutrality rules** enforced in the data: positions are described in the candidate's own words, loaded labels are not used, and if a candidate has not taken a public position the guide says **"No public position found"** instead of guessing from party. Unknown positions are excluded from match scores.

- **All 67 counties.** `#/counties` and `#/county/<code>` show, for any county, the congressional, Florida Senate and Florida House districts that cover it, the official candidate line-up for every such district, circuit-judge contests, DCA retention questions, county offices and special districts (from the Division of Elections candidate extract in `data/statewide/`, contact fields removed), and the county Supervisor of Elections. `python3 scripts/build_statewide.py` rebuilds `data/statewide.js`. City elections and local referendums are not in the state list.
- **Domain.** The site is served at **flvotersguide.org** (the `CNAME` file); the prerender uses it for every link and the sitemap.

## Project layout

```
index.html            App shell
assets/styles.css     Design (light/dark, responsive, print)
assets/app.js         Router, views, matching algorithm
data/issues.json      The 21 issue statements and which office levels they apply to
data/races.json       Race metadata (what the office does, term, level)
data/research/*.json  One file per race with candidates, positions, sources (editable)
                      Statewide files are auto-registered by id: us_house_<n>, state_senate_<n>,
                      state_house_<n>, county_<county>_<office>; each carries its own title,
                      jurisdiction, counties and coverage level
data/florida.json     County -> judicial circuit -> District Court of Appeal for all 67 counties
data/research/counties.json  Supervisor of Elections links per county
data/research/supplements.json  Editor-coded positions from documented votes that fill gaps
data/statewide/*.json Official statewide inputs (candidate extract, district maps, judicial geography, supervisors)
data/statewide.js     GENERATED — per-county districts and candidate line-ups for all 67 counties
data/guide.js         GENERATED — the merged dataset the site loads
scripts/build_data.py Merges data/*.json into data/guide.js and validates it
scripts/build_statewide.py Builds data/statewide.js from data/statewide/
docs/RESEARCH_BRIEF.md The research brief and JSON schema used to collect the data
```

## Publishing it (free) and getting it into Google

1. **Push to the repository's default branch.** The workflow in `.github/workflows/pages.yml` runs on every push to the branch named in its `on.push.branches` list (GitHub's Pages environment only accepts the default branch; if you switch the default to `main`, update that list): it rebuilds the data, prerenders every race and candidate into a real HTML page (`/candidates/david-jolly/`, `/races/governor-lieutenant-governor/`, …), writes `sitemap.xml` and `robots.txt`, and deploys to GitHub Pages.
2. **Enable Pages once:** GitHub repo → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**. The site appears at `https://<your-username>.github.io/Political-Party-Rock-Anthem/` within a couple of minutes.
3. **Custom domain:** `flvotersguide.org` (the `CNAME` file). DNS: `@` A records to 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153, and `www` CNAME to `smarchand910-eng.github.io`; GitHub Settings → Pages → Custom domain → `flvotersguide.org`, then *Enforce HTTPS*.
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
