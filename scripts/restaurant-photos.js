/**
 * restaurant-photos.js — pone la FOTO REAL de Google a cada restaurante.
 * Busca el lugar (Places Text Search legacy), toma su foto y guarda la URL
 * final (googleusercontent, sin API key) en events.json. Cachea: no re-baja
 * los que ya tienen foto de Google.
 *
 * Requiere la key en GEOCODE_KEY (key sin restricción de dominio, con Places API).
 * Uso:  GEOCODE_KEY=AIza... node scripts/restaurant-photos.js
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const KEY = process.env.GEOCODE_KEY || process.env.GOOGLE_KEY;
if (!KEY) { console.error('Falta GEOCODE_KEY'); process.exit(1); }

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
  return r.headers.get('location'); // URL final (lh3.googleusercontent.com), sin key
}

async function pool(items, worker, size) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  }));
}

async function main() {
  const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const rests = (data.events || []).filter(e => e.tipo === 'rest');
  // Solo los que aún no tienen foto real de Google
  const pending = rests.filter(e => !(e.img || '').includes('googleusercontent'));
  console.log(`Restaurantes: ${rests.length} | sin foto real de Google: ${pending.length}`);

  let ok = 0, fail = 0;
  await pool(pending, async (e) => {
    try {
      const q = [e.title, e.address].filter(Boolean).join(', ');
      const ref = await findPhotoRef(q);
      if (!ref) { fail++; return; }
      const url = await resolvePhotoUrl(ref);
      if (url && url.startsWith('http')) { e.img = url; ok++; } else fail++;
    } catch (err) { fail++; }
  }, 5);

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nFotos reales asignadas: ${ok} | sin foto encontrada: ${fail}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
