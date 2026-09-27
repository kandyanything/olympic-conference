#!/usr/bin/env node
/**
 * Knock the solid background out of the school crests.
 *
 *   node scripts/decrest.js            # write images/logos/*.png in place
 *   node scripts/decrest.js --dry      # report only
 *
 * ArbiterLive serves most crests on a flat white rectangle, and Cherry Hill
 * West's on a flat purple one. On a near-black page those read as boxes rather
 * than crests.
 *
 * The background is removed by flood-filling inward from the edges, NOT by
 * deleting every matching pixel. Several of these logos are mostly white on
 * the inside — Pennsauken's tornado, the white outlines on Seneca and Shawnee,
 * the shield on the Bishop Eustace knight — and a blanket "remove white" eats
 * them. Only background connected to the border goes.
 *
 * Anti-aliased edges are then feathered: a pixel on the boundary is part
 * crest, part background, so it keeps a proportional alpha instead of leaving
 * a hard white halo.
 */
const fs = require('fs');
const path = require('path');
const sharp = require(require.resolve('sharp', {
    paths: [path.join(__dirname, '..', 'node_modules'),
            'C:/Users/ScottRosenberg/OneDrive - PlayOn Sports/Desktop/union-county-conference/node_modules'],
}));

const DIR = path.join(__dirname, '..', 'images', 'logos');
const DRY = process.argv.includes('--dry');

const TOL = 42;        // how far from the background colour still counts as background
const FEATHER = 90;    // boundary pixels within this of the background fade out

const dist = (r, g, b, c) => Math.max(Math.abs(r - c[0]), Math.abs(g - c[1]), Math.abs(b - c[2]));

async function clean(file) {
    const src = path.join(DIR, file);
    const { data, info } = await sharp(src).ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: CH } = info;
    const at = (x, y) => (y * W + x) * CH;

    // The background colour is whatever the corners agree on. If they do not
    // agree, or they are already transparent, leave the file alone.
    const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => {
        const i = at(x, y);
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    });
    if (corners.every(c => c[3] < 30)) return { file, skipped: 'already transparent' };

    const opaque = corners.filter(c => c[3] > 200);
    if (!opaque.length) return { file, skipped: 'corners not opaque' };
    const bg = opaque[0];
    if (!opaque.every(c => dist(c[0], c[1], c[2], bg) <= TOL)) {
        return { file, skipped: 'corners disagree — not a flat background' };
    }

    // Flood fill inward from every border pixel that matches the background.
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let x = 0; x < W; x++) { stack.push([x, 0], [x, H - 1]); }
    for (let y = 0; y < H; y++) { stack.push([0, y], [W - 1, y]); }

    let cleared = 0;
    while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x;
        if (seen[k]) continue;
        const i = at(x, y);
        if (data[i + 3] < 30) { seen[k] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); continue; }
        if (dist(data[i], data[i + 1], data[i + 2], bg) > TOL) continue;
        seen[k] = 1;
        data[i + 3] = 0;
        cleared++;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Feather: a pixel next to cleared background is a blend of crest and
    // background, so fade it by how close to the background it still is.
    let feathered = 0;
    const alpha0 = Buffer.from(data);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const i = at(x, y);
            if (alpha0[i + 3] === 0) continue;
            const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
                const nx = x + dx, ny = y + dy;
                return nx >= 0 && ny >= 0 && nx < W && ny < H && alpha0[at(nx, ny) + 3] === 0;
            });
            if (!touching) continue;
            const d = dist(data[i], data[i + 1], data[i + 2], bg);
            if (d < FEATHER) {
                data[i + 3] = Math.round(data[i + 3] * (d / FEATHER));
                feathered++;
            }
        }
    }

    const pct = Math.round((cleared / (W * H)) * 100);
    if (!DRY) {
        await sharp(data, { raw: { width: W, height: H, channels: CH } })
            .png({ compressionLevel: 9 }).toFile(src + '.tmp');
        fs.renameSync(src + '.tmp', src);
    }
    return { file, bg: bg.slice(0, 3).join(','), cleared, pct, feathered };
}

(async () => {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png'));
    for (const f of files) {
        const r = await clean(f);
        if (r.skipped) console.log(`  ${f.padEnd(24)} skipped — ${r.skipped}`);
        else console.log(`  ${f.padEnd(24)} bg ${r.bg.padEnd(12)} cleared ${String(r.pct).padStart(2)}%  feathered ${r.feathered}`);
    }
    if (DRY) console.log('\n  (dry run — nothing written)');
})();
