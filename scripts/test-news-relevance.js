/**
 * Regression test for the news relevance filter.
 *
 * This conference is unusually easy to get wrong. Several member names are a
 * prefix or suffix of a school that is NOT a member, and two members are
 * commonly known by a name the conference no longer uses:
 *
 *   Lenape          vs  Lenape Valley      (Sussex County, a different school)
 *   Gloucester Tech vs  Gloucester City, and Gloucester County Institute
 *                       of Technology - neither is a member
 *   Pennsauken Tech vs  Pennsauken High School, a different school
 *   Moorestown      vs  Moorestown Friends
 *   Eastern         is  Eastern Regional
 *   Eastside        is  the old Woodrow Wilson, and there is another Eastside
 *                       in Paterson which belongs to the Big North
 *
 * Run: node scripts/test-news-relevance.js
 */
const { matchRelevance, relevanceText, SPORTS_TERMS_RE } = require('./build-news.js');

// What classify() really asks: does this name one of ours, AND is it sport?
function wouldPublish(title, excerpt) {
    const { confHit, schoolName } = matchRelevance(relevanceText(title, excerpt));
    if (!confHit && schoolName === null) return { publish: false, schoolName };
    // naming the conference in full is itself the sports signal
    return { publish: confHit || SPORTS_TERMS_RE.test(title), schoolName };
}

// [ headline, shouldBePublished, why ]
const CASES = [
    // ---- real conference stories that must flow ----
    ['Shawnee field hockey shuts out Cherokee in Olympic Conference opener', true, 'both ours'],
    ['Lenape football rolls past Seneca', true, 'both ours'],
    ['Cherry Hill East boys soccer edges Cherry Hill West', true, 'both ours'],
    ['Bishop Eustace baseball tops Camden Catholic', true, 'both ours'],
    ['Eastern Regional girls soccer wins in overtime', true, 'Eastern Regional is ours'],
    ['Moorestown wrestling sweeps Seneca', true, 'both ours'],
    ['Winslow Township basketball beats Eastside', true, 'both ours'],
    ['Olympic Conference announces divisional realignment for the fall', true, 'conference named'],

    // ---- near-miss schools that are NOT in this conference ----
    ['Lenape Valley football wins its opener', false, 'Lenape Valley is Sussex County'],
    ['Gloucester City boys soccer takes the county title', false, 'Gloucester City is not Gloucester Tech'],
    ['Moorestown Friends soccer advances to the final', false, 'a different school'],
    ['Eastside High School - Paterson wins the Big North opener', false, 'that Eastside is Big North'],

    // ---- generic words that must not carry an article on their own ----
    ['Camden County College basketball hires a coach', false, 'the community college is not us'],
    ['Eastern High School wins the Kentucky state title', false, 'a different Eastern entirely'],
    ['Cherokee County football advances in Georgia', false, 'not our Cherokee'],
    ['Seneca Valley wrestling takes the district', false, 'Seneca Valley is Pennsylvania'],
    ['Shawnee Mission East basketball wins in Kansas', false, 'not our Shawnee'],
    ['Toms River North wins the Shore Conference title', false, 'nobody of ours named'],

    // ---- named but not sport ----
    ['Moorestown Township Council approves the school budget', false, 'no sports word at all'],
];

// Headline plus summary: the summary's first word must not glue onto the
// headline's last one and invent a school.
const PAIR_CASES = [
    ['Shawnee field hockey shuts out Cherokee',
        'Only two players found the net for the Renegades',
        true, 'a capitalised summary must not break the match'],
    ['Lenape Valley survives a scare',
        'Lenape Valley Regional held on late',
        false, 'still the wrong Lenape'],
];

let pass = 0, fail = 0;
const failures = [];

function check(got, want, label, schoolName, why) {
    if (got === want) {
        pass++;
        console.log(`  ok    ${want ? 'KEEP  ' : 'REJECT'}  ${label.slice(0, 64)}`);
    } else {
        fail++;
        failures.push({ label, want, got, why, schoolName });
        console.log(`  FAIL  want ${want ? 'KEEP' : 'REJECT'}, got ${got ? 'KEEP' : 'REJECT'}  ${label.slice(0, 50)}`);
    }
}

for (const [title, excerpt, want, why] of PAIR_CASES) {
    const r = wouldPublish(title, excerpt);
    check(r.publish, want, '[+summary] ' + title, r.schoolName, why);
}
for (const [headline, want, why] of CASES) {
    const r = wouldPublish(headline, '');
    check(r.publish, want, headline, r.schoolName, why);
}

console.log(`\n${pass} passed, ${fail} failed, ${CASES.length + PAIR_CASES.length} total`);
if (fail) {
    console.log('\nFailures:');
    for (const f of failures)
        console.log(`  - ${f.label}\n      reason: ${f.why}\n      matched school: ${f.schoolName || '(none)'}`);
    process.exit(1);
}
console.log('All relevance cases pass.');
