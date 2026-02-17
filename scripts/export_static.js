const fs = require('fs');
const path = require('path');

// This script copies the current public/ folder to dist/ and
// writes the latest data/matches.json into dist/matches.json so
// the site can be uploaded to plain webspace.

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const dataFile = path.join(projectRoot, 'data', 'matches.json');
const outDir = path.join(projectRoot, 'dist');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) copyRecursive(path.join(src, name), path.join(dest, name));
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// copy public files
copyRecursive(publicDir, outDir);

// include matches.json (so frontend can fetch /matches.json without backend)
if (fs.existsSync(dataFile)) {
  const data = fs.readFileSync(dataFile);
  fs.writeFileSync(path.join(outDir, 'matches.json'), data);
  console.log('Wrote dist/matches.json');
} else {
  console.warn('No data/matches.json found — export will not include match data. Run a scan first.');
}

console.log('Static export completed to', outDir);
