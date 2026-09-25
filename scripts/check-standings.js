#!/usr/bin/env node
/**
 * Verify every standings link in data/standings.json.
 *
 *   node scripts/check-standings.js
 *
 * A link can rot in two different ways, so both are checked:
 *
 *   - the page stops existing (a slug changed, a season rolled over)
 *   - the page still loads but no longer lists our schools, which is what a
 *     wrong conference key looks like, and is invisible from the status code
 *
 * Out-of-season sports legitimately show nobody, so an empty in-season page is
 * a warning rather than a failure; run this in the season you care about.
 */
const path = require('path');
const CFG = require(path.join(__dirname, '..', 'data', 'standings.json'));
const ROSTER = require(path.join(__dirname, 'arbiter-schools.json'));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const NAMES = [...new Set(ROSTER.map(s => s.name.split(/\s+/)[0]))];

(async () => {
    let bad = 0, thin = 0, skipped = 0;
    for (const season of CFG.seasons) {
        console.log(`\n  === ${season.name} ===`);
        for (const sp of season.sports) {
            // Build the URL exactly as js/platinum.js does, so this tests what ships.
            const url = sp.url || (sp.slug
                ? `${CFG.baseUrl}/${sp.slug}/standings/season/${sp.season || CFG.defaultSeason}?conference=${encodeURIComponent(sp.conference || CFG.defaultConference)}`
                : '');
            if (!url) { console.log(`  ----  ${sp.label} — no standings source`); skipped++; continue; }
            // MileSplit is a landing page, not a conference table; only reachability matters.
            const isTable = /highschoolsports\.nj\.com/.test(url);
            try {
                const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
                const html = r.ok ? await r.text() : '';
                const hits = isTable ? NAMES.filter(n => html.includes(n)).length : null;
                if (!r.ok) { console.log(`  FAIL  ${sp.label} — HTTP ${r.status}`); bad++; }
                else if (!isTable) console.log(`  ok    ${sp.label} — ${r.status} (external results site)`);
                else if (hits >= 3) console.log(`  ok    ${sp.label} — ${hits} schools listed`);
                else { console.log(`  thin  ${sp.label} — page loads but lists ${hits} of our schools (out of season?)`); thin++; }
            } catch (err) {
                console.log(`  FAIL  ${sp.label} — ${err.message}`); bad++;
            }
            await new Promise(r => setTimeout(r, 600));
        }
    }
    console.log(`\n  broken: ${bad}   empty: ${thin}   no source: ${skipped}`);
    process.exit(bad ? 1 : 0);
})();
