# Sumter County Voter Guide — November 3, 2026

A nonpartisan, source-cited voter guide for the races and ballot questions a **Sumter County, Florida** voter will see in the 2026 general election, with a questionnaire that matches your views to each candidate's documented positions.

**No build step, no framework, no server required.** Open `index.html` in a browser, or host the folder on GitHub Pages / Netlify / any static host.

## What it does

- **Every contested race on the Sumter County ballot**: U.S. Senate (special), U.S. House 11, Governor/Lt. Governor, Attorney General, CFO, Agriculture Commissioner, Florida House 52, County Commission District 4, plus the three constitutional amendments, judicial merit retention, and seats already decided in August.
- **Candidate profiles** with photo, background, how they got on the ballot, positions on 21 major issues (each with a neutral summary, quote where available, and sources), *other issues the candidate has raised on their own*, a documented record, and reported endorsements.
- **Side-by-side comparison** per race.
- **"Match me"**: rate 21 statements (with a "matters a lot" weighting), get a percentage match per candidate per race, with the number of issues the score is based on shown openly.
- **Neutrality rules** enforced in the data: positions are described in the candidate's own words, loaded labels are not used, and if a candidate has not taken a public position the guide says **"No public position found"** instead of guessing from party. Unknown positions are excluded from match scores.

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
scripts/build_data.py Merges data/*.json into data/guide.js and validates it
docs/RESEARCH_BRIEF.md The research brief and JSON schema used to collect the data
```

## Updating the data

1. Edit the relevant file in `data/research/` (or add a stance in `data/research/supplements.json`). Every coded stance **must** have at least one source; the build script downgrades unsourced stances to "unknown".
2. Run `python3 scripts/build_data.py`.
3. Reload the page.

Stance scale: `2` strongly agrees with the statement, `1` leans agree, `0` mixed/neutral, `-1` leans disagree, `-2` strongly disagrees, `null` no public position found. `confidence` is `stated` (explicit statement), `record` (vote or official action) or `unknown`.

## Known gaps (as of the Sept 17, 2026 data pass)

The research environment could search the web but could not open most pages directly, so some candidates (notably the CFO, Agriculture Commissioner, Florida House 52 and County Commission 4 races, and the minor gubernatorial candidates) have thin position data. Those gaps are visible on each profile as "No public position found" rather than filled in. Items that could not be confirmed are flagged inline in the data files and on the Judges and How-to-vote pages. See `docs/RESEARCH_BRIEF.md` to extend the research with the same rules.
