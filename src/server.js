const path = require('path');
const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

const { readStore, writeStore } = require('./store');
const { scrapeMatches } = require('./scraper');
const { geocodePlace } = require('./geocode');
const { haversineDistanceKm } = require('./geo');

const PORT = Number(process.env.PORT || 3000);
const SCAN_URL = process.env.SCAN_URL || 'https://ipscmatch.de';
const SCAN_CRON = process.env.SCAN_CRON || '0 * * * *';
const USER_AGENT = process.env.USER_AGENT || 'ipscmatch-scanner/1.0 (+local app)';

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

let scanInProgress = false;

async function runScan() {
  if (scanInProgress) return { skipped: true, reason: 'scan_already_running' };
  scanInProgress = true;

  try {
    const matches = await scrapeMatches(SCAN_URL, USER_AGENT);
    const store = await readStore();
    store.matches = matches;
    store.lastScan = new Date().toISOString();
    await writeStore(store);

    return { skipped: false, count: matches.length, lastScan: store.lastScan };
  } finally {
    scanInProgress = false;
  }
}

function parseLevels(levelParam) {
  if (!levelParam) return null;
  return new Set(
    String(levelParam)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .map((value) => (value.startsWith('level') ? value : `level ${value}`)),
  );
}

async function enhanceWithDistance(matches, origin) {
  if (!origin) return { origin: null, matches };

  const originPoint = await geocodePlace(origin, USER_AGENT);
  if (!originPoint) {
    throw new Error(`Konnte Ort nicht auflösen: ${origin}`);
  }

  const enhanced = [];
  for (const match of matches) {
    if (!match.location || match.location === 'Unbekannt') {
      enhanced.push({ ...match, distanceKm: null });
      continue;
    }

    const place = await geocodePlace(match.location, USER_AGENT);
    if (!place) {
      enhanced.push({ ...match, distanceKm: null });
      continue;
    }

    const distanceKm = haversineDistanceKm(originPoint, place);
    enhanced.push({ ...match, distanceKm: Number(distanceKm.toFixed(1)) });
  }

  return {
    origin: {
      query: origin,
      resolved: originPoint.label,
      lat: originPoint.lat,
      lon: originPoint.lon,
    },
    matches: enhanced,
  };
}

function sortMatches(matches, sortBy) {
  const sorted = [...matches];

  if (sortBy === 'distance') {
    sorted.sort((a, b) => {
      const av = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bv = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (av === bv) {
        return (a.dateIso || '').localeCompare(b.dateIso || '');
      }
      return av - bv;
    });
    return sorted;
  }

  sorted.sort((a, b) => (a.dateIso || '').localeCompare(b.dateIso || ''));
  return sorted;
}

app.get('/api/status', async (req, res) => {
  const store = await readStore();
  res.json({
    scanUrl: SCAN_URL,
    cron: SCAN_CRON,
    lastScan: store.lastScan,
    count: store.matches?.length || 0,
    scanInProgress,
  });
});

app.post('/api/scan', async (req, res) => {
  try {
    const result = await runScan();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const { level, sort = 'date', origin = '' } = req.query;
    // originPlz takes precedence when provided (postal code input)
    const originPlz = String(req.query.originPlz || '').trim();
    const originQuery = originPlz || String(origin || '').trim();
    const levels = parseLevels(level);

    const store = await readStore();
    let matches = store.matches || [];

    if (levels && levels.size > 0) {
      matches = matches.filter((match) => levels.has((match.level || '').toLowerCase()));
    }

    const withDistance = await enhanceWithDistance(matches, originQuery);
    const sorted = sortMatches(withDistance.matches, sort === 'distance' ? 'distance' : 'date');

    res.json({
      lastScan: store.lastScan,
      total: sorted.length,
      origin: withDistance.origin,
      sort: sort === 'distance' ? 'distance' : 'date',
      matches: sorted,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'index.html'));
});

cron.schedule(SCAN_CRON, async () => {
  try {
    await runScan();
  } catch (error) {
    console.error('[cron-scan] Fehler:', error.message);
  }
});

app.listen(PORT, async () => {
  console.log(`IPSC Match Scanner läuft auf http://localhost:${PORT}`);
  console.log(`Scan-Quelle: ${SCAN_URL}`);
  console.log(`Cron: ${SCAN_CRON}`);

  try {
    const store = await readStore();
    if (!store.lastScan) {
      await runScan();
      console.log('Initialer Scan abgeschlossen.');
    }
  } catch (error) {
    console.error('Initialer Scan fehlgeschlagen:', error.message);
  }
});
