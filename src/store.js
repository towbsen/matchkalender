const fs = require('fs/promises');
const path = require('path');

const dataFile = path.resolve(process.cwd(), 'data', 'matches.json');

async function ensureDir() {
  const dir = path.dirname(dataFile);
  await fs.mkdir(dir, { recursive: true });
}

async function readStore() {
  await ensureDir();
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { lastScan: null, matches: [] };
    }
    throw error;
  }
}

async function writeStore(store) {
  await ensureDir();
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), 'utf8');
}

module.exports = {
  readStore,
  writeStore,
};
