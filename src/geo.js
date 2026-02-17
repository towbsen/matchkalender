const EARTH_RADIUS_KM = 6371;

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(a, b) {
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lon - a.lon);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

module.exports = {
  haversineDistanceKm,
};
