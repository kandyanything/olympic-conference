/**
 * Seven member schools have never uploaded a crest to ArbiterLive - their page
 * shows Arbiter's default shield - so those come from MaxPreps instead, which
 * carries each school's own mark rather than generic mascot art.
 *
 * Taking the FIRST mascotUrl on the page is wrong and quietly gives you the
 * wrong school: a MaxPreps school page carries around 37 of them, nearly all
 * opponents. Moorestown's page leads with Cherry Hill East, which is exactly
 * the mistake that shipped on the first pass. Each crest is therefore matched
 * to the school name sitting beside it.
 *
 * Images are downloaded and self-hosted, not hot-linked, the same as the
 * ArbiterLive crests.
 *
 *   node scripts/fetch-logos-maxpreps.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'logos');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// sharp is not installed in this project yet; borrow the copy that already
// sits beside the other conference sites.
const sharp = require(require.resolve('sharp', {
    paths: ['C:/Users/ScottRosenberg/OneDrive - PlayOn Sports/Desktop/union-county-conference/node_modules'],
}));

// `expect` is how MaxPreps writes the school's own name, used to pick its crest
// out of the crowd of opponents on the same page.
const TARGETS = [
    { slug: 'bishop-eustace', expect: 'Bishop Eustace Prep', page: 'nj/pennsauken/bishop-eustace-prep-crusaders' },
    { slug: 'camden', expect: 'Camden', page: 'nj/camden/camden-panthers' },
    { slug: 'cherry-hill-east', expect: 'Cherry Hill East', page: 'nj/cherry-hill/cherry-hill-east-cougars' },
    { slug: 'cherry-hill-west', expect: 'Cherry Hill West', page: 'nj/cherry-hill/cherry-hill-west-lions' },
    { slug: 'eastside', expect: 'Eastside', page: 'nj/camden/eastside-tigers' },
    { slug: 'lenape', expect: 'Lenape', page: 'nj/medford/lenape-indians' },
    { slug: 'moorestown', expect: 'Moorestown', page: 'nj/moorestown/moorestown-quakers' },
];

fs.mkdirSync(OUT, { recursive: true });

const clean = u => u.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
const norm = s => String(s).toLowerCase().replace(/[^a-z]/g, '');

/** Every (school name, crest url) pair on the page, in document order. */
function pairs(html) {
    const out = [];
    const re = /"mascotUrl":"([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const before = html.slice(Math.max(0, m.index - 600), m.index);
        const names = [...before.matchAll(/"(?:schoolName|name)":"([^"]{2,60})"/g)];
        out.push({ name: names.length ? names[names.length - 1][1] : '', url: clean(m[1]) });
    }
    return out;
}

(async () => {
    let got = 0;
    const problems = [];

    for (const t of TARGETS) {
        let html = '';
        try {
            const r = await fetch('https://www.maxpreps.com/' + t.page + '/', { headers: { 'User-Agent': UA }, redirect: 'follow' });
            if (r.ok) html = await r.text();
        } catch { /* reported below */ }
        if (!html) { console.log('  ' + t.slug.padEnd(20) + 'PAGE FAILED'); problems.push(t.slug); continue; }

        const all = pairs(html);
        const hit = all.find(p => norm(p.name) === norm(t.expect))
            || all.find(p => norm(p.name).startsWith(norm(t.expect)));

        if (!hit) {
            console.log('  ' + t.slug.padEnd(20) + 'NO CREST NAMED "' + t.expect + '" among ' + all.length + ' on the page');
            problems.push(t.slug);
            await sleep(700);
            continue;
        }

        try {
            const r = await fetch(hit.url, { headers: { 'User-Agent': UA } });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const buf = Buffer.from(await r.arrayBuffer());
            const png = await sharp(buf)
                .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
                .png({ compressionLevel: 9 }).toBuffer();
            fs.writeFileSync(path.join(OUT, t.slug + '.png'), png);
            console.log('  ' + t.slug.padEnd(20) + String(Math.round(png.length / 1024)).padStart(4) + ' KB   matched "' + hit.name + '"');
            got++;
        } catch (e) {
            console.log('  ' + t.slug.padEnd(20) + 'DOWNLOAD FAILED  ' + e.message);
            problems.push(t.slug);
        }
        await sleep(800);
    }

    console.log('\n  ' + got + '/' + TARGETS.length + ' crests taken from MaxPreps');
    if (problems.length) { console.log('  needs a look: ' + problems.join(', ')); process.exit(1); }
})();
