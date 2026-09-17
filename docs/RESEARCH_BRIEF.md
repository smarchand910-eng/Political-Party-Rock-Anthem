# Research brief: Sumter County, FL — November 3, 2026 General Election voter guide

## Non-negotiable rules
1. UNBIASED. Describe every candidate's positions in neutral, plain language, ideally paraphrasing or quoting the candidate's own words. Never use loaded adjectives (extreme, radical, far-left, MAGA, woke, corrupt, etc.) unless inside a direct quote with a citation. Do not editorialize about whether a position is good or bad.
2. FACTS ONLY, WITH SOURCES. Every position, biographical claim and record item must carry at least one source URL (candidate website, official government page, court/legislative record, campaign filing, or a reputable news outlet). Use search-result URLs. If you cannot find a source, do NOT include the claim.
3. NEVER GUESS a position. If a candidate has not stated a position on an issue, set stance to null and confidence to "unknown" with summary "No public position found as of Sept 2026." Do not infer from party label alone. You MAY code a stance from a voting record or official action (confidence "record"), or from an explicit statement (confidence "stated").
4. Balance: For incumbents, include both accomplishments claimed and documented criticisms ONLY as sourced factual items (e.g., "X voted against Y (roll call link)", "A fact-check by Z rated the claim..."). Opinion columns are not evidence of a position.
5. Web fetching of most sites is blocked in this sandbox; rely on WebSearch (run many specific queries: "<name> abortion", "<name> property tax", "<name> immigration", "<name> issues site", "<name> interview", "<name> voter guide", "<name> questionnaire"). Try WebFetch anyway on candidate sites/news sites — some may work.

## Stance scale (integers)
+2 = strongly agrees with the statement; +1 = leans agree / supports with conditions; 0 = mixed/neutral/explicitly undecided; -1 = leans disagree; -2 = strongly disagrees. null = unknown.

## Issue statements (issue_id: statement the VOTER will rate; code the CANDIDATE on the same statement)
- taxes: "Cutting taxes should be a top priority, even if it means less government spending on services."
- property_tax: "Florida should eliminate or sharply reduce homestead property taxes, even if local governments must cut services or find other revenue."
- insurance: "The state should intervene more directly in the property-insurance market (rate caps, expanding Citizens, stricter insurer regulation) rather than relying mainly on market-based reforms."
- housing: "Government should do more to make housing affordable (subsidies, zoning changes, rent measures)."
- immigration: "Immigration enforcement should be stricter, including large-scale deportation of people in the country illegally."
- abortion: "Abortion should be legal in most cases (Florida's six-week ban should be repealed or loosened)."
- guns: "Gun laws should be stricter (keep the red-flag law and the 21 purchase age; expand background checks) rather than looser (permitless/open carry, lower age)."
- healthcare: "Government should expand its role in health coverage (expand Medicaid in Florida, extend ACA subsidies)."
- social_security: "Social Security and Medicare benefits must be protected from any cuts, even if that requires more revenue."
- education_choice: "Public money should follow students to private, charter or home schools (universal school vouchers)."
- environment: "Protecting water quality, conservation land and climate resilience should take priority even if it slows development or raises costs."
- growth: "Growth and development should be slowed or more tightly regulated (higher impact fees, density limits, stronger local control)."
- marijuana: "Recreational marijuana should be legal for adults."
- elections: "Voting should be made easier (mail voting, drop boxes, restoring voting rights) rather than adding new restrictions."
- crime: "Criminal penalties should be tougher and police funding increased, rather than emphasizing reform and rehabilitation."
- lgbtq: "Florida's laws restricting gender-affirming care for minors and classroom instruction on sexual orientation/gender identity should remain in place."
- energy: "Government should promote renewable energy and tighten oversight of utility rate increases, even at the expense of fossil-fuel production."
- tariffs: "Tariffs on imported goods are good for the American economy." (federal races only)
- ukraine: "The U.S. should continue military aid to Ukraine." (federal races only)
- trump: "I approve of the direction of the Trump administration."  (code candidate: +2 strong supporter / -2 strong critic)
- veterans: "Expanding VA services and veterans' benefits should be a top priority."

## Output JSON format (write EXACTLY this shape; one file per race)
{
  "race_id": "us_senate_special",
  "verified_ballot_note": "one sentence on how you verified who is on the Nov 3 ballot, with source URL(s)",
  "candidates": [
    {
      "id": "ashley_moody",
      "name": "Ashley Moody",
      "party": "Republican" | "Democratic" | "Libertarian" | "No Party Affiliation" | "Write-in" | "Nonpartisan",
      "incumbent": true,
      "running_mate": "optional (governor only)",
      "photo_url": "best-known URL of an official/public portrait (congress.gov /img/member/<bioguide>_200.jpg, senate.gov, myfloridahouse.gov, flsenate.gov, county site, campaign site og:image, or https://commons.wikimedia.org/wiki/Special:FilePath/<File name>.jpg). Give your best candidate URL even if unverified.",
      "photo_source": "where the photo comes from",
      "website": "campaign site URL or null",
      "occupation": "...",
      "residence": "city, county",
      "background": "3–6 neutral factual sentences: education, career, prior offices, how they got to the ballot (appointed/elected/primary result with %).",
      "primary_result": "e.g. Won Aug 18 primary with 61% over X (source)",
      "positions": {
        "<issue_id>": {
          "stance": 2,
          "confidence": "stated" | "record" | "unknown",
          "summary": "1–3 neutral sentences describing what they say/have done and what they plan to do.",
          "quote": "short direct quote if available, else null",
          "sources": [ {"title": "...", "url": "...", "date": "YYYY-MM-DD or YYYY-MM or null"} ]
        }
      },
      "other_issues": [ {"title": "...", "summary": "what the candidate says they will do", "sources": [ {"title":"...","url":"..."} ] } ],
      "record": [ {"item": "factual vote/action/accomplishment/criticism", "sources": [ {"title":"...","url":"..."} ] } ],
      "endorsements": [ {"by": "...", "sources": [ {"title":"...","url":"..."} ] } ]
    }
  ]
}
Include EVERY issue_id in "positions" for every candidate (use stance null + confidence "unknown" when nothing is found). "other_issues" should capture priorities the candidate raises that are NOT in the issue list (e.g., a specific local road, a bill they sponsor, term limits, DOGE audits, Chinese land ownership, condo laws, veterans homes, etc.) — aim for 3–8 per major candidate.
