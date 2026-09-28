#!/usr/bin/env node
/**
 * Give dark crests a platinum rim so they read on a near-black tile.
 *
 *   node scripts/rim-dark-logos.js --dry    # report, write nothing
 *   node scripts/rim-dark-logos.js          # apply, backing up originals
 *   node scripts/rim-dark-logos.js --revert # restore from the backup
 *
 * Several crests are dark shapes that were drawn for a white page - a black
 * mustang, a navy shield, a black silhouette. Knocking the white background out
 * left them almost invisible against the tile.
 *
 * Which ones is measured, not listed by hand. Mean luminance over the OPAQUE
 * pixels only: averaging the transparent area would mark every logo dark. The
 * brightest are left alone entirely - a gold tiger needs no help, and rimming it
 * would just look like a sticker.
 *
 * The rim is the logo's own silhouette dilated by a couple of pixels and filled
 * with platinum, composited BEHIND the artwork, so it hugs the shape rather
 * than boxing it. It is deliberately subtle: enough to separate the logo from
 * the tile, not enough to read as an outline in its own right.
 */
const fs = require('fs');
const path = require('path');
const sharp = require(require.resolve('sharp', {
    paths: [path.join(__dirname, '..', 'node_modules'),
            'C:/Users/ScottRosenberg/OneDrive - PlayOn Sports/Desktop/union-county-conference/node_modules'],
}));

const DIR = path.join(__dirname, '..', 'images', 'logos');
const BACKUP = path.join(__dirname, '..', 'images', 'logos-original');

const DRY = process.argv.includes('--dry');
const REVERT = process.argv.includes('--revert');

const DARK_MEAN = 80;      // below this, the crest needs help
const RADIUS = 3;          // rim thickness in pixels, at the logo's own size
const RIM = [226, 232, 240];   // platinum

/**
 * Mean luminance of the pixels just INSIDE the silhouette edge.
 *
 * Some crests already ship with a white keyline - Chatham's paw is drawn that
 * way. Rimming those doubles the outline and traces every internal gap, which
 * reads as a scribble. If the edge is already light, leave the logo alone.
 */
function edgeLuminance(data, w, h, ch) {
    let sum = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * ch;
            if (data[i + 3] < 200) continue;
            // an edge pixel has at least one transparent neighbour
            const nb = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) =>
                data[((y + dy) * w + (x + dx)) * ch + 3] < 60);
            if (!nb) continue;
            sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            n++;
        }
    }
    return n ? sum / n : 0;
}

function meanLuminance(data, info) {
    let sum = 0, n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
        if (data[i + 3] < 40) continue;
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        n++;
    }
    return n ? sum / n : 255;
}

/** Largest alpha within RADIUS of each pixel - a plain dilation. */
function dilateAlpha(data, w, h, ch, r) {
    const a = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += ch, p++) a[p] = data[i + 3];
    // separable: horizontal then vertical max
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let m = 0;
            for (let d = -r; d <= r; d++) {
                const nx = x + d;
                if (nx < 0 || nx >= w) continue;
                const v = a[y * w + nx]; if (v > m) m = v;
            }
            tmp[y * w + x] = m;
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let m = 0;
            for (let d = -r; d <= r; d++) {
                const ny = y + d;
                if (ny < 0 || ny >= h) continue;
                const v = tmp[ny * w + x]; if (v > m) m = v;
            }
            out[y * w + x] = m;
        }
    }
    return out;
}

(async () => {
    if (REVERT) {
        if (!fs.existsSync(BACKUP)) return console.log('  no backup to revert from');
        let n = 0;
        for (const f of fs.readdirSync(BACKUP)) { fs.copyFileSync(path.join(BACKUP, f), path.join(DIR, f)); n++; }
        return console.log(`  restored ${n} logo(s) from images/logos-original/`);
    }

    if (!DRY) fs.mkdirSync(BACKUP, { recursive: true });
    let rimmed = 0, left = 0;

    for (const f of fs.readdirSync(DIR).filter(x => /\.png$/i.test(x))) {
        const src = path.join(DIR, f);
        // Always measure the ORIGINAL, so re-running does not rim a rimmed logo.
        const measureFrom = fs.existsSync(path.join(BACKUP, f)) ? path.join(BACKUP, f) : src;
        const { data, info } = await sharp(measureFrom).ensureAlpha().raw()
            .toBuffer({ resolveWithObject: true });
        const mean = meanLuminance(data, info);

        if (mean >= DARK_MEAN) { left++; continue; }
        const edge = edgeLuminance(data, info.width, info.height, info.channels);
        if (edge >= 140) {
            console.log(`  ${String(Math.round(mean)).padStart(3)}  skipped    ${f}  (already has a light keyline, edge ${Math.round(edge)})`);
            left++; continue;
        }
        if (DRY) { console.log(`  ${String(Math.round(mean)).padStart(3)}  would rim  ${f}`); rimmed++; continue; }

        if (!fs.existsSync(path.join(BACKUP, f))) fs.copyFileSync(src, path.join(BACKUP, f));

        const { width: w, height: h, channels: ch } = info;
        // Scale the rim with the logo so a 400px crest and a 100px crest get a
        // visually equal edge.
        const r = Math.max(2, Math.round(RADIUS * (Math.max(w, h) / 200)));
        const dil = dilateAlpha(data, w, h, ch, r);

        const out = Buffer.alloc(w * h * 4);
        for (let p = 0; p < w * h; p++) {
            const i = p * ch, o = p * 4;
            const srcA = data[i + 3];
            const ringA = Math.max(0, dil[p] - srcA);     // outside the shape only
            if (srcA >= 250) {                             // solid artwork: untouched
                out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2]; out[o + 3] = srcA;
            } else {
                // composite the artwork over the platinum ring
                const a = srcA / 255, rA = (ringA / 255) * 0.85;
                const outA = a + rA * (1 - a);
                if (outA <= 0) { out[o + 3] = 0; continue; }
                for (let c = 0; c < 3; c++) {
                    out[o + c] = Math.round(((data[i + c] * a) + (RIM[c] * rA * (1 - a))) / outA);
                }
                out[o + 3] = Math.round(outA * 255);
            }
        }

        await sharp(out, { raw: { width: w, height: h, channels: 4 } })
            .png({ compressionLevel: 9 }).toFile(src + '.tmp');
        fs.renameSync(src + '.tmp', src);
        console.log(`  ${String(Math.round(mean)).padStart(3)}  rimmed     ${f}  (r=${r})`);
        rimmed++;
    }

    console.log(`\n  ${rimmed} rimmed, ${left} left alone (mean luminance >= ${DARK_MEAN})`);
    if (!DRY) console.log('  originals in images/logos-original/ — revert with --revert');
})();
