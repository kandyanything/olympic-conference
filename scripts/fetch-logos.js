/**
 * Pulls each member school's crest from its ArbiterLive page.
 *
 * The logo lives at assets.arbitersports.com/logos/organization/<orgId>, and
 * the orgId is NOT the entityId - Winslow is entity 26096 but organization
 * 52909 - so it has to be read off the school's own page rather than guessed.
 *
 *   node scripts/fetch-logos.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'logos');
const SCHOOLS = require('./arbiter-schools.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

function extFor(buf, contentType) {
    if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
    if (buf.slice(0, 4).toString() === 'GIF8') return 'gif';
    if (buf.slice(0, 4).toString() === 'RIFF') return 'webp';
    if (buf.slice(0, 200).toString().includes('<svg')) return 'svg';
    return (contentType || '').includes('png') ? 'png' : 'img';
}

(async () => {
    const report = [];
    for (const s of SCHOOLS) {
        let logoUrl = '', status = '';
        try {
            const page = await fetch(`https://www.arbiterlive.com/Teams?entityId=${s.entityId}`, { headers: { 'User-Agent': UA } });
            const html = await page.text();
            const m = html.match(/src="(https:\/\/assets\.arbitersports\.com\/logos\/[^"]+)"/i);
            if (m) logoUrl = m[1];
        } catch (e) { status = 'page failed: ' + e.message; }

        if (!logoUrl) {
            console.log('  ' + s.name.padEnd(22) + 'NO LOGO ON PAGE  ' + status);
            report.push({ ...s, logo: null });
            await sleep(500);
            continue;
        }

        try {
            const r = await fetch(logoUrl, { headers: { 'User-Agent': UA } });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const buf = Buffer.from(await r.arrayBuffer());
            const ext = extFor(buf, r.headers.get('content-type'));
            const file = `${s.slug}.${ext}`;
            fs.writeFileSync(path.join(OUT, file), buf);
            console.log('  ' + s.name.padEnd(22) + String(Math.round(buf.length / 1024)).padStart(4) + ' KB  ' + file);
            report.push({ ...s, logo: `images/logos/${file}`, source: logoUrl });
        } catch (e) {
            console.log('  ' + s.name.padEnd(22) + 'DOWNLOAD FAILED  ' + e.message);
            report.push({ ...s, logo: null, source: logoUrl });
        }
        await sleep(600);
    }

    fs.writeFileSync(path.join(ROOT, 'scripts', 'logo-report.json'), JSON.stringify(report, null, 2) + '\n');
    const got = report.filter(r => r.logo).length;
    console.log('\n  ' + got + '/' + SCHOOLS.length + ' crests downloaded');
    if (got < SCHOOLS.length) console.log('  missing: ' + report.filter(r => !r.logo).map(r => r.name).join(', '));
})();
