// Resolve a school name - either our canonical name or the way ArbiterLive
// spells it in an opponent field - to its logo slug, or null if the school is
// not in the Olympic Conference.
// Used by split-schedule.js to tag each game with the crest(s) to show.

const path = require('path');
const LIST = require(path.join(__dirname, 'arbiter-schools.json'));

function norm(s) {
    return String(s || '').toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\bsaint\b/g, 'st')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(high|school|schools|regional|senior|hs|the|township|twp)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

// canonical name -> slug
const BY_KEY = new Map();
for (const s of LIST) BY_KEY.set(norm(s.name), s.slug);

// How ArbiterLive actually writes these schools when they appear as an
// opponent. Several differ from the conference's own naming, and two are
// renames the conference list has not caught up with: the school the league
// still calls Woodrow Wilson is filed as Eastside, and Eastern is Eastern
// Regional. Getting these wrong silently drops the crest from half the
// fixtures, since a game is tagged from whichever side reported it.
const ALIASES = {
    'bishop eustace preparatory': 'bishop-eustace',
    'bishop eustace prep': 'bishop-eustace',
    'bishop eustace': 'bishop-eustace',
    'camden': 'camden',
    'camden catholic': 'camden-catholic',
    'cherokee': 'cherokee',
    'cherry hill east': 'cherry-hill-east',
    'cherry hill west': 'cherry-hill-west',
    'eastern': 'eastern-regional',
    'eastern regional': 'eastern-regional',
    'eastside': 'eastside',
    'eastside camden': 'eastside',
    'woodrow wilson': 'eastside',
    'camden county technical at sicklerville': 'gloucester-tech',
    'camden county technical sicklerville': 'gloucester-tech',
    'gloucester township technical': 'gloucester-tech',
    'gloucester twp tech': 'gloucester-tech',
    'lenape': 'lenape',
    'moorestown': 'moorestown',
    'camden county technical at pennsauken': 'pennsauken-tech',
    'camden county technical pennsauken': 'pennsauken-tech',
    'pennsauken technical': 'pennsauken-tech',
    'pennsauken tech': 'pennsauken-tech',
    'seneca': 'seneca',
    'shawnee': 'shawnee',
    'winslow': 'winslow-township',
    'winslow township': 'winslow-township',
};

function logoSlug(name) {
    const k = norm(name);
    if (!k) return null;
    if (BY_KEY.has(k)) return BY_KEY.get(k);
    if (ALIASES[k]) return ALIASES[k];
    return null;
}

module.exports = { logoSlug, norm };
