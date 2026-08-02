/**
 * venue-photos.js — foto REAL del recinto (Google Places) para cualquier evento
 * que tenga foto stock (Unsplash), no tenga foto, o cuya foto de Google Places
 * ya haya expirado. Los links que resuelve la Places Photo API
 * (lh3.googleusercontent.com/place-photos/...) son firmados y temporales —
 * Google no garantiza que sigan sirviendo indefinidamente — así que se
 * refrescan antes de que caduquen en vez de cachearse para siempre.
 * Cachea por venue en events.json (data.venuePhotos), con fecha de resolución.
 * Mantiene las fotos reales de otras fuentes (Ticketplus/CCLM) sin tocarlas.
 *
 * Requiere la key en GEOCODE_KEY (sin restricción de dominio, con Places API).
 * Uso:  GEOCODE_KEY=AIza... node scripts/venue-photos.js
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const KEY = process.env.GEOCODE_KEY || process.env.GOOGLE_KEY;
if (!KEY) { console.error('Falta GEOCODE_KEY'); process.exit(1); }

// Ventana de refresco: antes de que se cumpla, se reusa el link cacheado.
// Después, se vuelve a resolver aunque ya haya uno guardado.
const REFRESH_MS = 20 * 24 * 60 * 60 * 1000; // 20 días

const GENERIC = new Set(['', 'santiago', 'santiago centro', 'centro', 'providencia', 'consultar']);
const usableVenue = (v) => v && v.trim().length >= 4 && !GENERIC.has(v.trim().toLowerCase());
// Las fotos que resuelve este script siempre quedan en este dominio — así se
// reconocen aunque el caché de venues no tenga el registro (ej. si se perdió
// por un bug anterior), en vez de depender de que coincidan con el caché.
const isGooglePlacesPhoto = (img) => typeof img === 'string' && img.includes('googleusercontent.com/place-photos');

function cacheEntryStale(entry) {
  if (!entry) return true;
  if (typeof entry === 'string') return true; // formato viejo (sin fecha) = tratar como vencido
  const ts = entry.url ? entry.updatedAt : entry.checkedAt;
  if (!ts) return true;
  return (Date.now() - new Date(ts).getTime()) > REFRESH_MS;
}

const seenFailures = new Set();
function logFailureOnce(status, errorMessage) {
  const label = status + (errorMessage ? `: ${errorMessage}` : '');
  if (seenFailures.has(label)) return;
  seenFailures.add(label);
  console.warn(`  status no-OK (primera vez, se resume al final): ${label}`);
}

async function findPhotoRef(query) {
  const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(query) + '&region=cl&key=' + KEY;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const d = await r.json();
  if (d.status !== 'OK' || !d.results[0]) {
    if (d.status !== 'ZERO_RESULTS') logFailureOnce(d.status, d.error_message);
    return null;
  }
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
  const cache = data.venuePhotos || {};   // venue -> { url, updatedAt } | { url: '', checkedAt }

  // Agrupar eventos que necesitan foto (nueva, o cuya foto cacheada ya expiró), por venue usable
  const byVenue = new Map();
  for (const e of events) {
    if (!usableVenue(e.venue)) continue;
    const v = e.venue.trim();
    const cached = cache[v];
    // Solo se toca lo que "es nuestro": sin foto, placeholder de Unsplash, o una
    // foto de Google Places (aunque ya esté vencida). Fotos reales de otra fuente
    // (Ticketplus/CCLM) se dejan intactas.
    const ownsCurrentPhoto = !e.img || e.img.includes('images.unsplash.com') || isGooglePlacesPhoto(e.img);
    if (!ownsCurrentPhoto) continue;

    if (!cacheEntryStale(cached)) {
      if (cached.url) e.img = cached.url;
      continue;
    }
    if (!byVenue.has(v)) byVenue.set(v, []);
    byVenue.get(v).push(e);
  }
  const venues = [...byVenue.keys()];
  console.log(`Venues a buscar/refrescar: ${venues.length}`);

  let ok = 0, fail = 0;
  await pool(venues, async (v) => {
    try {
      const ref = await findPhotoRef(v + ' Santiago Chile');
      const url = ref ? await resolvePhotoUrl(ref) : null;
      if (url && url.startsWith('http')) {
        cache[v] = { url, updatedAt: new Date().toISOString() };
        byVenue.get(v).forEach(e => { e.img = url; });
        ok++;
      } else {
        cache[v] = { url: '', checkedAt: new Date().toISOString() };
        fail++;
      }
    } catch (e) { logFailureOnce('exception', e.message); fail++; }
  }, 5);

  data.venuePhotos = cache;
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  const real = events.filter(e => e.img && !e.img.includes('images.unsplash.com')).length;
  console.log(`\nVenues con foto: ${ok} | sin foto: ${fail}`);
  if (seenFailures.size) console.log(`Motivos de falla vistos: ${[...seenFailures].join(' | ')}`);
  console.log(`Eventos con foto REAL: ${real}/${events.length}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
