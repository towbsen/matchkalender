const { readStore, writeStore } = require('./store');

async function geocodePlace(query, userAgent) {
  const store = await readStore();
  const geoCache = store.geoCache || {};

  if (geoCache[query]) {
    return geoCache[query];
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  // If query looks like a German PLZ (5 digits), append country for disambiguation
  const plzMatch = String(query).trim().match(/^\d{5}$/);
  const q = plzMatch ? `${query}, Germany` : query;
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding fehlgeschlagen (${res.status})`);
  }

  const data = await res.json();
  const first = data[0];
  if (!first) return null;

  const point = {
    lat: Number(first.lat),
    lon: Number(first.lon),
    label: first.display_name,
  };

  geoCache[query] = point;
  store.geoCache = geoCache;
  await writeStore(store);

  return point;
}

module.exports = {
  geocodePlace,
};
