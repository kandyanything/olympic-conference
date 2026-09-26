// Guard rail for the nightly rebuild.
//
// The dangerous failure is not a crash - it is a build that succeeds while
// quietly returning far less than it should, because a source changed shape.
// That would publish a gutted calendar without anyone noticing. This compares
// the fresh build against the version already committed and fails loudly if it
// looks wrong.
//
// Run: node scripts/check-schedule.js <previous-schedule.json>
// Exits non-zero to stop the workflow before anything is committed.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const fresh = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'schedule.json'), 'utf8'));

// 3,804 once the ArbiterLive window truncation was fixed (it was 3,191 while
// every school was being cut off after its first month or two).
const MIN_GAMES = 2600;
const MIN_SOURCE_RATE = 0.9;     // share of this conference's own schools that must return
const MAX_DROP = 0.30;           // vs the previous build

const problems = [];
const notes = [];

const games = fresh.counts ? fresh.counts.deduped : (fresh.games || []).length;
const okSources = (fresh.sources || []).filter(s => s.ok).length;
const totalSources = (fresh.sources || []).length;

notes.push(`games ${games}, sources ok ${okSources}/${totalSources}`);

if (games < MIN_GAMES) {
    problems.push(`only ${games} games - expected at least ${MIN_GAMES}`);
}
// Take the floor from the schools this conference actually has. A count copied
// from a larger conference fails every single run no matter how healthy the
// build is: a copy of this file once arrived set to 35 "of 39" on a conference
// so the guard rejected 22-of-22 perfect builds for weeks.
if (!totalSources) {
    problems.push('the build reported no sources at all');
} else if (okSources < Math.ceil(totalSources * MIN_SOURCE_RATE)) {
    const failed = (fresh.sources || []).filter(s => !s.ok).map(s => s.school);
    problems.push(`only ${okSources}/${totalSources} sources returned data; failed: ${failed.join(', ')}`);
}

// compare against whatever was committed before this run
const prevPath = process.argv[2];
if (prevPath && fs.existsSync(prevPath)) {
    try {
        const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
        const prevGames = prev.counts ? prev.counts.deduped : (prev.games || []).length;
        if (prevGames > 0) {
            const drop = (prevGames - games) / prevGames;
            notes.push(`previous build had ${prevGames}`);
            if (drop > MAX_DROP) {
                problems.push(`games fell ${(drop * 100).toFixed(0)}% (${prevGames} -> ${games}), more than the ${MAX_DROP * 100}% allowed`);
            }
        }
    } catch (e) {
        notes.push(`could not read previous build for comparison: ${e.message}`);
    }
} else {
    notes.push('no previous build to compare against');
}

// A school whose own games stop months before everyone else's is the shape
// of a truncated fetch, not a short season — ArbiterLive answers a long date
// range with a valid 200 that simply stops early, so the source still counts
// as "ok" and the totals still look plausible. Compare each school's own
// span against the conference's.
const MIN_SPAN_RATE = 0.5;   // months covered, vs the conference's own span
const ownMonths = {};
(fresh.games || []).forEach(g => {
    if (!g.school || !g.date) return;
    (ownMonths[g.school] = ownMonths[g.school] || new Set()).add(String(g.date).slice(0, 7));
});
const confMonths = new Set([].concat(...Object.values(ownMonths).map(x => [...x]))).size;
if (confMonths >= 4) {
    const floor = Math.max(2, Math.floor(confMonths * MIN_SPAN_RATE));
    const short = Object.entries(ownMonths)
        .filter(([, m]) => m.size < floor)
        .map(([school, m]) => `${school} (${m.size} of ${confMonths} months)`);
    notes.push(`month span: conference ${confMonths}, per-school floor ${floor}`);
    if (short.length) {
        problems.push(`these schools' own games cover far less of the season than the conference does, which is what a truncated fetch looks like: ${short.join(', ')}`);
    }
}

// every game needs the fields the calendar renders
const sample = (fresh.games || []).slice(0, 500);
const malformed = sample.filter(g => !g.date || !g.school || !g.sport);
if (malformed.length) {
    problems.push(`${malformed.length} of the first ${sample.length} games are missing date, school or sport`);
}

notes.forEach(n => console.log(`  ${n}`));

if (problems.length) {
    console.error('\nSCHEDULE CHECK FAILED:');
    problems.forEach(p => console.error(`  - ${p}`));
    console.error('\nNothing committed. Investigate before publishing.');
    process.exit(1);
}
console.log('  checks passed');
