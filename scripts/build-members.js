/**
 * Turns scripts/arbiter-schools.json - the one hand-maintained list - into the
 * two files the site reads:
 *
 *   data/schools.json   the roster, used by split-schedule.js and the pipeline
 *   data/members.json   the same thing shaped for the platinum front end
 *
 * Keeping one source means a school's schedule link, crest and name cannot
 * drift apart, which is precisely what went wrong on the Union County site
 * where three hand-written copies disagreed.
 *
 *   node scripts/build-members.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROSTER = require('./arbiter-schools.json');

const CONF = 'Olympic Conference';

// A crest link goes to the school's ArbiterLive schedule, because that is where
// the fixtures actually live and it is the page a parent wants.
const scheduleUrl = s => `https://www.arbiterlive.com/Teams?entityId=${s.entityId}`;

const members = ROSTER.map(s => ({
    name: s.name,
    short: s.name,
    slug: s.slug,
    town: s.town || '',
    county: s.county || '',
    nickname: s.nickname || '',
    group: s.group || '',
    logo: `images/logos/${s.slug}.png`,
    schedule: scheduleUrl(s),
    website: '',
    entityId: s.entityId,
}));

const schools = ROSTER.map(s => ({
    name: s.name,
    slug: s.slug,
    scheduleUrl: scheduleUrl(s),
}));

function write(file, value) {
    const full = path.join(ROOT, 'data', file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    // No byte-order mark: Node's JSON.parse and Cloudflare both choke on one.
    fs.writeFileSync(full, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8' });
    console.log('  wrote data/' + file + '  (' + (Array.isArray(value) ? value.length : Object.keys(value).length) + ' entries)');
}

write('schools.json', schools);
write('members.json', { conference: CONF, generated: new Date().toISOString(), members });

// A missing crest shows as a broken tile on the homepage, so say so here
// rather than letting it surface in the browser.
const missing = ROSTER.filter(s => !fs.existsSync(path.join(ROOT, 'images', 'logos', s.slug + '.png')));
if (missing.length) {
    console.log('\n  MISSING CRESTS: ' + missing.map(m => m.slug).join(', '));
    process.exit(1);
}
console.log('  all ' + ROSTER.length + ' crests present');
