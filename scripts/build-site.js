#!/usr/bin/env node
/**
 * Assemble dist/ — exactly what gets published, and nothing else.
 *
 *   node scripts/build-site.js
 *   npx wrangler deploy
 *
 * Wrangler is pointed at dist/ rather than the project root because
 * .assetsignore did not exclude anything here: a root deploy read 3,132 files
 * against the 1,124 that exist outside .git, i.e. it was picking up the whole
 * git history and the build scripts. An allow-list is easier to be sure of
 * than an ignore-list — nothing ships unless it is named below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Everything the site actually serves.
const DIRS = ['css', 'js', 'images', 'data', 'feeds'];
const FILES = ['favicon.ico', 'robots.txt', '_headers'];

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    let n = 0;
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, e.name), b = path.join(to, e.name);
        if (e.isDirectory()) n += copyDir(a, b);
        else { fs.copyFileSync(a, b); n++; }
    }
    return n;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let total = 0;

for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith('.html')) { fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f)); total++; }
}
for (const d of DIRS) {
    const src = path.join(ROOT, d);
    if (!fs.existsSync(src)) { console.log(`  [skip] ${d}/ does not exist`); continue; }
    const n = copyDir(src, path.join(DIST, d));
    console.log(`  ${d}/`.padEnd(12) + `${n} files`);
    total += n;
}
for (const f of FILES) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { console.log(`  [warn] ${f} missing`); continue; }
    fs.copyFileSync(src, path.join(DIST, f));
    total++;
}

// Nothing in dist/ may reference a file that isn't in dist/.
const missing = new Set();
(function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        // Only markup and stylesheets. Scanning .js matched the renderer own
        // string concatenation as if it were a real path.
        if (!/[.](html|css)$/.test(e.name)) continue;
        const txt = fs.readFileSync(p, 'utf8');
        for (const m of txt.matchAll(/(?:src|href)="((?!https?:|\/\/|#|mailto:|tel:|data:)[^"]+)"/g)) {
            const rel = m[1].split(/[?#]/)[0];
            if (!rel || rel.endsWith('/')) continue;
            if (!fs.existsSync(path.join(DIST, rel))) missing.add(rel);
        }
    }
})(DIST);

console.log(`\n  dist/ holds ${total} files`);
console.log(`  referenced but absent: ${missing.size ? [...missing].join(', ') : 'none'}`);
if (missing.size) process.exitCode = 1;
