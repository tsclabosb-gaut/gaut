/**
 * Scraper de la Corporación Cultural de Las Condes (CCLC).
 * Ticketera: sertex.stonline.cl/cclc (plataforma STOnline/Sertex).
 * - Descubre las categorías (estId) desde el portal.
 * - De cada listado saca título, precio, sala, dirección, descripción e imagen.
 * - Entra a cada evento y usa la PRÓXIMA función real (día + hora).
 * - Sin Claude. Reemplaza los eventos con src 'CCLC' en events.json.
 *
 * Uso:  node scripts/scrape-cclc.js [--limit N] [--dry]
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const BASE = 'https://sertex.stonline.cl';
const PORTAL = BASE + '/cclc/cclcFrontOffice/Portal/';
const CONCURRENCY = 6;
const UA = 'Mozilla/5.0 (compatible; GautBot/1.0; +https://descubretuciudad.com)';

const DOW = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Comuna -> zona (mismos códigos que usa el sitio)
const ZONE_BY_COMUNA = {
  'las condes': 'lc', 'vitacura': 'vit', 'providencia': 'prov', 'ñuñoa': 'nun',
  'nunoa': 'nun', 'la reina': 'lare', 'lo barnechea': 'lob', 'santiago': 'cen',
  'independencia': 'ind',
};

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENT[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

// La etiqueta de la sección (Teatro, Danza, Música...) manda sobre el texto,
// porque una descripción de teatro puede mencionar "música" y confundir.
function catFromLabel(label) {
  const t = label.toLowerCase();
  if (/(teatro|danza|ballet|exposici|expo|muestra|cine|pel[ií]cula|humor|stand|circo|arte|charla|conferencia|taller|literat|infantil|familiar)/.test(t)) return 'culture';
  if (/(concierto|sinf[oó]nic|m[uú]sica|orquesta|recital|jazz|coro|banda|c[aá]mara|[oó]pera)/.test(t)) return 'music';
  if (/(gastron|degustaci|culinari|cocina)/.test(t)) return 'food';
  return null;
}
function inferCat(label, text) {
  const fromLabel = catFromLabel(label);
  if (fromLabel) return fromLabel;
  const t = text.toLowerCase();
  if (/(concierto|sinf[oó]nic|orquesta|recital|jazz|[oó]pera)/.test(t)) return 'music';
  if (/(gastron|degustaci|culinari)/.test(t)) return 'food';
  return 'culture'; // teatro, danza, exposición, cine, humor, etc.
}
const CAT_EMOJI = { music: '🎵', sport: '⚽', food: '🍽️', culture: '🎭' };

async function fetchText(url, ms = 15000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// Descubre los estId (categorías/subtipos) desde el portal
async function listSubtypes() {
  let html = '';
  try { html = await fetchText(PORTAL); } catch { return []; }
  const ids = new Set();
  for (const m of html.matchAll(/estId=(\d+)/g)) ids.add(m[1]);
  return [...ids];
}

// Parsea una tarjeta de evento del listado
function parseCards(html) {
  const cards = [];
  // Etiqueta de categoría de la sección (ej. "Teatro")
  const catM = html.match(/font-size:18px[^>]*>([^<]+)</i);
  const label = catM ? stripTags(catM[1]) : '';
  // Cada evento es un div.row con borde gris
  const chunks = html.split(/<div class="row" style="border:1px solid #808080/i).slice(1);
  for (const chunk of chunks) {
    const link = chunk.match(/Funciones\?eprId=(\d+)&(?:amp;)?ecoId=(\d+)/i);
    if (!link) continue;
    const title = chunk.match(/<b>([^<]+)<\/b>/i);
    if (!title) continue;
    const img = chunk.match(/GetImageContent\?gimId=(\d+)/i);
    const precio = chunk.match(/Precio:\s*([^<]+)/i);
    const sala = chunk.match(/Sala:\s*([^<]+?)<br/i);
    const dir = chunk.match(/Direcci[oó]n:\s*([^<\n]+)/i);
    const descM = chunk.match(/<p style="color:#fff;">([\s\S]*?)<\/p>/i);
    cards.push({
      eprId: link[1], ecoId: link[2],
      title: stripTags(title[1]),
      img: img ? `${BASE}/cclc/cclcFrontOffice/Portal/GetImageContent?gimId=${img[1]}` : '',
      precio: precio ? stripTags(precio[1]) : '',
      sala: sala ? stripTags(sala[1]) : '',
      dir: dir ? stripTags(dir[1]) : '',
      desc: descM ? stripTags(descM[1]) : '',
      label,
    });
  }
  return cards;
}

// Extrae precio mínimo en pesos ($4.000 -> 4000). Gratis -> 0. Sin dato -> null.
function parsePrice(s) {
  if (/gratis|liberad|gratuit|sin costo/i.test(s)) return 0;
  const nums = [...s.matchAll(/\$?\s*([\d.]{3,})/g)].map(m => Number(m[1].replace(/\./g, ''))).filter(n => n > 0);
  return nums.length ? Math.min(...nums) : null;
}

// De la página de detalle saca las funciones (fecha dd-mm-yyyy + hora HH:MM).
// Parsea fila por fila (cada función es un div con "border-bottom") para no
// cruzar la fecha de una función con la hora de otra.
function parseFunctions(html) {
  const fns = [];
  const rows = html.split(/border-bottom:1px solid #808080/i).slice(1);
  for (const row of rows) {
    const seg = row.slice(0, 700);
    const d = seg.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (!d) continue;
    const t = seg.match(/\b([0-2]?\d):([0-5]\d)\b/);
    const dateObj = new Date(+d[3], +d[2] - 1, +d[1], t ? +t[1] : 20, t ? +t[2] : 0, 0);
    if (!isNaN(dateObj)) fns.push(dateObj);
  }
  // Respaldo: si no se reconoció ninguna fila, usar barrido suelto
  if (!fns.length) {
    let m; const re = /(\d{2})-(\d{2})-(\d{4})[\s\S]{0,180}?\b([0-2]?\d):([0-5]\d)\b/g;
    while ((m = re.exec(html))) {
      const dateObj = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], 0);
      if (!isNaN(dateObj)) fns.push(dateObj);
    }
  }
  // dedupe por timestamp + orden ascendente
  const seen = new Set();
  return fns.filter(f => { const k = f.getTime(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a - b);
}

function toEvent(card, functions) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayMs = now.getTime();
  const upcoming = functions.filter(f => f.getTime() >= todayMs);
  if (!upcoming.length) return null; // toda la temporada ya pasó
  const next = upcoming[0];
  const day = next.getDate(), mo = next.getMonth();
  const time = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;

  const comuna = (card.dir.split(/[-,]/).pop() || '').trim().toLowerCase();
  const zone = ZONE_BY_COMUNA[comuna] || 'lc';
  // venue: parte después del " - " de la Sala (el recinto), o la Sala completa
  const venue = (card.sala.includes(' - ') ? card.sala.split(' - ').pop() : card.sala).trim()
    || 'Corporación Cultural Las Condes';
  const text = (card.title + ' ' + card.desc + ' ' + card.label).toLowerCase();
  const cat = inferCat(card.label, card.desc);
  const url = `${PORTAL}Funciones?eprId=${card.eprId}&ecoId=${card.ecoId}`;

  return {
    title: card.title.replace(/\s+/g, ' ').trim(),
    cat,
    emoji: CAT_EMOJI[cat] || '🎭',
    desc: card.desc.slice(0, 400),
    date: `${DOW[next.getDay()]} ${day} de ${MONTHS[mo]} ${time}`,
    dateMs: next.getTime(),
    month: mo,
    days: [day],
    venue,
    address: card.dir || 'Las Condes',
    zone,
    mapsQ: encodeURIComponent(`${venue} Las Condes`).replace(/%20/g, '+'),
    price: parsePrice(card.precio),
    src: 'CCLC',
    srcUrl: url,
    tickets: url,
    img: card.img,
    tags: [],
    acc: false,
    pet: /mascota|perro|pet friendly|pet-friendly/.test(text),
    kid: /(ni[ñn]o|ni[ñn]a|infantil|familiar|criatura|todo p[uú]blico|toda la familia)/.test(text),
    tipo: 'event',
  };
}

async function pool(items, worker, size) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  }));
}

async function main() {
  const limArg = process.argv.indexOf('--limit');
  const LIMIT = limArg > -1 ? Number(process.argv[limArg + 1]) : Infinity;

  console.log('Descubriendo categorías de CCLC...');
  const subtypes = await listSubtypes();
  console.log(`Categorías (estId): ${subtypes.join(', ') || '(ninguna)'}`);

  // Junta todas las tarjetas de todos los listados (dedupe por eprId)
  const byEpr = new Map();
  for (const estId of subtypes) {
    let html;
    try { html = await fetchText(`${PORTAL}EventosPorSubtipo?estId=${estId}`); } catch { continue; }
    for (const c of parseCards(html)) if (!byEpr.has(c.eprId)) byEpr.set(c.eprId, c);
  }
  let cards = [...byEpr.values()];
  if (LIMIT < cards.length) cards = cards.slice(0, LIMIT);
  console.log(`Eventos encontrados en los listados: ${cards.length}`);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxMs = today.getTime() + 425 * 86400000;

  let ok = 0, past = 0, nodate = 0, far = 0;
  const events = [];
  await pool(cards, async (card) => {
    let html;
    try { html = await fetchText(`${PORTAL}Funciones?eprId=${card.eprId}&ecoId=${card.ecoId}`); } catch { nodate++; return; }
    const functions = parseFunctions(html);
    if (!functions.length) { nodate++; return; }
    const ev = toEvent(card, functions);
    if (!ev) { past++; return; }
    if (ev.dateMs > maxMs) { far++; return; }
    ok++; events.push(ev);
  }, CONCURRENCY);

  console.log(`\nPróximos: ${ok} | Pasados: ${past} | Sin fecha: ${nodate} | Muy a futuro: ${far}`);

  let data = { events: [], coords: {}, meta: {} };
  if (fs.existsSync(EVENTS_PATH)) data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const oldCclc = (data.events || []).filter(e => e.src === 'CCLC');
  const others = (data.events || []).filter(e => e.src !== 'CCLC');
  const before = (data.events || []).length;

  // Preservar loadedAt (fecha de primera carga) por srcUrl; nuevo evento -> hoy
  const todayIso = new Date().toISOString().slice(0, 10);
  const loadedAtByUrl = new Map(oldCclc.map(e => [e.srcUrl, e.loadedAt]).filter(([, v]) => v));
  events.forEach(e => { e.loadedAt = loadedAtByUrl.get(e.srcUrl) || todayIso; });

  let nextId = 1;
  const all = [...others, ...events].map(e => ({ ...e, id: nextId++ }));

  if (process.argv.includes('--dry')) {
    console.log(`[DRY] events.json: ${before} -> ${all.length} (CCLC: ${events.length}). No se escribió.`);
    events.forEach(e => console.log(`   ${new Date(e.dateMs).toISOString().slice(0, 10)} ${e.date.slice(-5)} | ${e.cat} | $${e.price} | ${e.venue.slice(0, 22)} | ${e.title.slice(0, 40)}`));
    return;
  }
  data.events = all;
  data.meta = { ...(data.meta || {}), lastUpdated: todayIso, totalEvents: all.length };
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nListo. events.json: ${before} -> ${all.length} (CCLC próximos: ${events.length}).`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
