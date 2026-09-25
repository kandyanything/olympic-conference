#!/usr/bin/env node
/**
 * Add NFHS Network broadcasts to data/videos.json from their event URLs.
 *
 *   node scripts/add-nfhs-video.js <event url> [<event url> ...]
 *   node scripts/add-nfhs-video.js --check          # re-verify every entry
 *
 * You paste the URL you get from NFHS; this fills in everything else.
 *
 * Thumbnails
 * ----------
 * NFHS exposes two pictures per event, and they are not the same thing:
 *
 *   social.nfhsnetwork.com/thumbnails/<gameId>_nfhs_net.jpg
 *       A real frame grabbed from the broadcast — the gym, the field, the
 *       scoreboard. This is the one we want, and it is derivable from the
 *       event URL alone, so js/platinum.js builds it client-side with no
 *       data needed here.
 *
 *   the page's og:image
 *       A generated card of the two crests on a split background. It carries
 *       an unpredictable timestamp in its filename (…_1786477275210.png), so
 *       it can only be had by scraping, and it shows no actual play.
 *
 * So: normally we store no "thumb" at all and let the renderer derive the
 * frame. We only write one when the frame is missing — an event that hasn't
 * aired yet has no frame to grab — and then we store the og card, which at
 * least shows who is playing. A --check run clears that "thumb" again once
 * the broadcast exists, so upcoming games upgrade themselves to a real frame.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'videos.json');
const ROSTER = path.join(__dirname, 'arbiter-schools.json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const gameId = url => (String(url).match(/\/(gam[a-z0-9]+)(?:[/?#]|$)/i) || [])[1] || null;
const frameUrl = id => `https://social.nfhsnetwork.com/thumbnails/${id}_nfhs_net.jpg`;

async function get(url, asText = true) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return asText ? res.text() : res.arrayBuffer();
}

async function exists(url) {
    try {
        // NFHS's CDN answers HEAD inconsistently, so ask for the bytes and
        // judge by size: a placeholder comes back tiny or empty.
        const buf = await get(url, false);
        return buf.byteLength > 5000;
    } catch { return false; }
}

function meta(html, prop) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
    const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
    const m = html.match(re) || html.match(alt);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&#x2F;/g, '/').replace(/&#39;/g, "'").replace(/&quot;/g, '"') : '';
}

/**
 * NFHS titles read "Away vs Home - <Gender> <Level> <Sport> MM/DD/YYYY".
 *
 * We keep the sport and the gender, because that is how every other page on
 * the site labels a game. The level needs care: varsity is the default and is
 * dropped, but junior varsity and freshman are genuinely different games and
 * are kept as a short tag. Stripping the bare word "Varsity" is what turned
 * "Girls Junior Varsity Volleyball" into "Girls Junior Volleyball", so the
 * level is matched as a whole phrase, longest first.
 */
const LEVELS = [
    [/\bjunior\s+varsity\b/i, 'JV'],
    [/\bfreshman\b/i, 'Freshman'],
    [/\bvarsity\b/i, ''],          // the default — say nothing
];

function parseTitle(raw) {
    const t = raw.replace(/\s*\|\s*Live\s*&?\s*On Demand\s*$/i, '').trim();
    const m = t.match(/^(.*?)\s+-\s+(.*?)\s+(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    if (!m) return { title: t, sport: '', level: '', date: '' };

    let sport = m[2], level = '';
    for (const [re, tag] of LEVELS) {
        if (re.test(sport)) { level = tag; sport = sport.replace(re, ' '); break; }
    }
    sport = sport.replace(/\s{2,}/g, ' ').trim();

    return {
        title: m[1].trim(),
        sport: level ? `${sport} (${level})` : sport,
        level,
        date: `${m[5]}-${m[3]}-${m[4]}`,
    };
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function loadRoster() {
    const list = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    return list.map(s => ({ name: s.name, keys: new Set([norm(s.name), norm(s.name.replace(/\b(regional|township|high school|tech)\b/gi, ''))]) }));
}

/** Which conference schools the title names — the renderer needs both to draw crests. */
function membersIn(title, roster) {
    return title.split(/\s+vs\.?\s+/i).map(side => {
        const n = norm(side);
        const hit = roster.find(s => s.keys.has(n))
            || roster.find(s => [...s.keys].some(k => k && (n.startsWith(k) || k.startsWith(n))));
        return hit ? hit.name : null;
    });
}

/**
 * NFHS abbreviates school names ("Cherry Hill E."). Where a side resolved to a
 * member school, show that school's real name; leave anything unresolved — a
 * non-conference opponent — exactly as NFHS wrote it.
 */
function displayTitle(title, teams) {
    const sides = title.split(/\s+vs\.?\s+/i);
    if (sides.length !== teams.length) return title;
    return sides.map((side, i) => teams[i] || side.trim()).join(' vs ');
}

async function describe(url, roster) {
    const id = gameId(url);
    if (!id) throw new Error('no gam… id in that URL');
    const html = await get(url);
    const parsed = parseTitle(meta(html, 'og:title') || '');
    if (!parsed.title) throw new Error('could not read the event title');

    const teams = membersIn(parsed.title, roster);
    const entry = { url, source: 'nfhs', title: displayTitle(parsed.title, teams), date: parsed.date, sport: parsed.sport };

    const hasFrame = await exists(frameUrl(id));
    if (!hasFrame) {
        const og = meta(html, 'og:image');
        if (og) entry.thumb = og;
    }
    return { entry, id, hasFrame, teams };
}

function report(r) {
    const { entry, hasFrame, teams } = r;
    console.log(`  ${entry.title}`);
    console.log(`      ${entry.sport || '(sport?)'}  ${entry.date || '(date?)'}`);
    console.log(`      thumbnail: ${hasFrame ? 'broadcast frame' : (entry.thumb ? 'crest card (not aired yet)' : 'NONE — will fall back to a conference photo')}`);
    const unknown = teams.filter(t => t === null).length;
    console.log(`      crests:    ${unknown === 0 ? 'both schools matched' : `${2 - unknown}/2 matched — no crest pair will show`}`);
}

(async () => {
    const args = process.argv.slice(2);
    const roster = loadRoster();
    const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    doc.videos = doc.videos || [];

    if (args[0] === '--check') {
        let changed = 0;
        for (const v of doc.videos) {
            if (v.source !== 'nfhs') continue;
            const id = gameId(v.url);
            if (!id) { console.log(`  [warn] no game id: ${v.url}`); continue; }
            const hasFrame = await exists(frameUrl(id));
            if (hasFrame && v.thumb) { delete v.thumb; changed++; console.log(`  [upgrade] now has a broadcast frame: ${v.title}`); }
            else if (!hasFrame && !v.thumb) console.log(`  [warn] no frame and no thumb: ${v.title}`);
            else console.log(`  [ok] ${v.title}`);
        }
        if (changed) {
            fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8' });
            console.log(`\n  updated ${changed} entr${changed === 1 ? 'y' : 'ies'}`);
        } else console.log('\n  nothing to change');
        return;
    }

    if (!args.length) {
        console.log('usage: node scripts/add-nfhs-video.js <nfhs event url> [...]');
        console.log('       node scripts/add-nfhs-video.js --check');
        process.exit(1);
    }

    let added = 0;
    for (const url of args) {
        try {
            const r = await describe(url, roster);
            const dupe = doc.videos.findIndex(v => gameId(v.url || '') === r.id);
            if (dupe >= 0) { doc.videos[dupe] = r.entry; console.log('  [replaced]'); }
            else { doc.videos.push(r.entry); added++; }
            report(r);
        } catch (err) {
            console.log(`  [skip] ${url}\n      ${err.message}`);
        }
    }

    // Newest first: the first entry runs large as the feature on videos.html.
    doc.videos.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    fs.writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8' });
    console.log(`\n  data/videos.json now holds ${doc.videos.length} broadcast${doc.videos.length === 1 ? '' : 's'} (${added} new)`);
})();
