/**
 * geocode-events.js — agrega lat/lng a los eventos vía Google Geocoding API.
 * Cachea por "lugar" (venue+address) para no geocodificar dos veces el mismo sitio.
 * Guarda el caché en events.json (campo `coords`) para reusarlo entre corridas.
 *
 * Requiere la API key en GEOCODE_KEY (key SIN restricción de dominio).
 * Uso:  GEOCODE_KEY=AIza... node scripts/geocode-events.js
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const KEY = process.env.GEOCODE_KEY;
const CONCURRENCY = 8;

if (!KEY) { console.error('Falta GEOCODE_KEY'); process.exit(1); }

// Caja delimitadora del Gran Santiago — descarta geocodificaciones erróneas (otra ciudad/país)
const BBOX = { latMin: -33.85, latMax: -33.15, lngMin: -71.05, lngMax: -70.35 };
const inBox = (lat, lng) => lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;

function placeKey(e) {
  return [e.venue, e.address].filter(Boolean).join(', ').trim();
}
function query(e) {
  const base = placeKey(e) || e.title;
  return /santiago|chile/i.test(base) ? base : base + ', Santiago, Chile';
}

async function geocode(q) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(q)
    + '&region=cl&bounds=-33.85,-71.05|-33.15,-70.35&key=' + KEY;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    if (d.status === 'OK' && d.results[0]) {
      const loc = d.results[0].geometry.location;
      if (!inBox(loc.lat, loc.lng)) return null;   // fuera de Santiago = geocodificación errónea
      return { lat: +loc.lat.toFixed(6), lng: +loc.lng.toFixed(6) };
    }
    if (d.status === 'OVER_QUERY_LIMIT') throw new Error('OVER_QUERY_LIMIT');
    return null;
  } catch (e) { if (e.message === 'OVER_QUERY_LIMIT') throw e; return null; }
}

async function pool(items, worker, size) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  }));
}

async function main() {
  const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const events = data.events || [];
  const cache = data.coords || {};   // query -> {lat,lng}

  // Limpiar coords fuera de Santiago (geocodificaciones erróneas previas)
  let cleaned = 0;
  for (const e of events) { if (e.lat && e.lng && !inBox(e.lat, e.lng)) { delete e.lat; delete e.lng; cleaned++; } }
  for (const k of Object.keys(cache)) { const c = cache[k]; if (!c || !inBox(c.lat, c.lng)) delete cache[k]; }
  if (cleaned) console.log(`Limpiadas ${cleaned} coords fuera de Santiago`);

  // Lugares únicos que aún no tienen coords (ni el evento ni el caché)
  const need = new Map();
  for (const e of events) {
    if (e.lat && e.lng) continue;
    const q = query(e);
    if (cache[q]) { e.lat = cache[q].lat; e.lng = cache[q].lng; continue; }
    if (!need.has(q)) need.set(q, []);
    need.get(q).push(e);
  }
  const queries = [...need.keys()];
  console.log(`Eventos: ${events.length} | lugares únicos a geocodificar: ${queries.length}`);

  let ok = 0, fail = 0;
  await pool(queries, async (q) => {
    let res;
    try { res = await geocode(q); }
    catch (e) { console.warn('  límite alcanzado, pausa 2s'); await new Promise(r => setTimeout(r, 2000)); res = await geocode(q).catch(() => null); }
    if (res) { cache[q] = res; need.get(q).forEach(e => { e.lat = res.lat; e.lng = res.lng; }); ok++; }
    else fail++;
  }, CONCURRENCY);

  data.coords = cache;
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  const conCoords = events.filter(e => e.lat && e.lng).length;
  console.log(`\nGeocodificados OK: ${ok} | sin resultado: ${fail}`);
  console.log(`Eventos con coordenadas: ${conCoords}/${events.length} | caché: ${Object.keys(cache).length} lugares`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
