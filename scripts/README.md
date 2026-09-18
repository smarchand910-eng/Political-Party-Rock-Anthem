# Maintenance scripts

| Script | What it does |
|---|---|
| `build_data.py` | Merges `data/*.json` and `data/research/*.json` into `data/guide.js` and validates stances (every coded stance needs a source). Run after any data edit. |
| `build_statewide.py` | Builds `data/statewide.js` (all-county line-ups) from `data/statewide/*.json`. |
| `fetch_doe_extract.py` | Downloads the Division of Elections candidate list for an election and strips contact fields. `--out` defaults to the committed extract. |
| `reconcile_ballot.py` | Checks every race file against the extract: flags defeated/withdrawn/unqualified candidates, adds missing qualified ones (state and federal races), prints county discrepancies. Dry run by default; `--write` applies. |
| `check_ballot_changes.py` | Diffs a fresh extract against the committed one for candidates in the guide. Used by the weekly GitHub Action. |
| `code_state_rollcalls.py` | Writes record-based positions for legislators from `data/rollcalls/state_matrix.json`. |
| `code_house_rollcalls.py` | Same for members of Congress, from Clerk of the House roll-call XML. |
| `add_positions.py <spec.json>` | Applies a JSON spec of stated positions (`{race_id: {cand_id: {website, positions: {issue: [stance, summary, quote, [[title,url,date]], confidence?]}}}}`). |
| `audit_placement.js` | Counts candidates with enough coded positions to appear on the landscape map. |
| `prerender.js` | Prerenders every route into `dist/` for search engines (run by the Pages workflow). |
| `fetch_photos.py` | Downloads candidate photos listed in `data/photo_urls.txt`. |

Typical update pass:

```
python3 scripts/fetch_doe_extract.py           # refresh the official candidate list
python3 scripts/reconcile_ballot.py --write    # apply status changes, review county notes
python3 scripts/code_state_rollcalls.py        # after adding a legislator to the matrix
python3 scripts/build_data.py && node scripts/audit_placement.js
```

## fetch_early_voting.py
`python3 scripts/fetch_early_voting.py review.json` follows the "Early Voting" link on every county Supervisor of Elections
homepage and lists the General Election dates and hours it finds, with the surrounding text, for review. Update the
`early_voting` entries in `data/research/counties.json` by hand from that file (many sites still show the primary
schedule, and some block automated requests). The weekly `ballot-check` workflow runs it and attaches the review file.

## fetch_ballotpedia.py
`python3 scripts/fetch_ballotpedia.py needs.json out.json --photos` looks each candidate up on Ballotpedia (name, then
first + last, then with a "(Florida)" suffix), accepts the page only if it is a person infobox mentioning Florida, 2026 and
the district or county, and records the campaign website, the profile link and (with `--photos`) a downloaded portrait
in `assets/photos/`. `scripts/apply_ballotpedia.py out.json` writes the results into the research files.
