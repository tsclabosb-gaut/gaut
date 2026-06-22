/**
 * venue-photos.js — foto REAL del recinto (Google Places) para cualquier evento
 * que tenga foto stock (Unsplash) o no tenga foto, usando su `venue`.
 * Cachea por venue en events.json (data.venuePhotos) para no repetir búsquedas.
 * Mantiene las fotos reales existentes (Ticketplus/CCLM/Google).
 *
 * Requiere la key en GEOCODE_KEY (sin restricción de dominio, con Places API).
 * Uso:  GEOCODE_KEY=AIza... node scripts/venue-photos.js
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const KEY = process.env.GEOCODE_KEY || process.env.GOOGLE_KEY;
if (!KEY) { console.error('Falta GEOCODE_KEY'); process.exit(1); }

const GENERIC = new Set(['', 'santiago', 'santiago centro', 'centro', 'providencia', 'consultar']);
const needsPhoto = (img) => !img || img.includes('images.unsplash.com');
const usableVenue = (v) => v && v.trim().length >= 4 && !GENERIC.has(v.trim().toLowerCase());

async function findPhotoRef(query) {
  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(query) + '&region=cl&key=' + KEY;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const d = await r.json();
  if (d.status !== 'OK' || !d.results[0]) return null;
  const photos = d.results[0].photos;
  return photos && photos[0] ? photos[0].photo_reference : null;
}
async function resolvePhotoUrl(ref) {
  const url = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=' + ref + '&key=' + KEY;
  const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
  return r.headers.get('location');
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
  const cache = data.venuePhotos || {};   // venue -> url (o "" si no se halló)

  // Agrupar eventos que necesitan foto, por venue usable
  const byVenue = new Map();
  for (const e of events) {
    if (!needsPhoto(e.img) || !usableVenue(e.venue)) continue;
    const v = e.venue.trim();
    if (cache[v]) { e.img = cache[v]; continue; }     // ya cacheado
    if (cache[v] === '') continue;                    // ya buscado, sin foto
    if (!byVenue.has(v)) byVenue.set(v, []);
    byVenue.get(v).push(e);
  }
  const venues = [...byVenue.keys()];
  console.log(`Venues únicos a buscar: ${venues.length}`);

  let ok = 0, fail = 0;
  await pool(venues, async (v) => {
    try {
      const ref = await findPhotoRef(v + ' Santiago Chile');
      const url = ref ? await resolvePhotoUrl(ref) : null;
      if (url && url.startsWith('http')) {
        cache[v] = url;
        byVenue.get(v).forEach(e => { e.img = url; });
        ok++;
      } else { cache[v] = ''; fail++; }
    } catch (e) { fail++; }
  }, 5);

  data.venuePhotos = cache;
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  const real = events.filter(e => e.img && !e.img.includes('images.unsplash.com')).length;
  console.log(`\nVenues con foto: ${ok} | sin foto: ${fail}`);
  console.log(`Eventos con foto REAL: ${real}/${events.length}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
