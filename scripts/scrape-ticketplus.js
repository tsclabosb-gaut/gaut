/**
 * Scraper dedicado de Ticketplus por JSON-LD (schema.org/Event).
 * - Recorre TODO el sitemap (no solo 25).
 * - Extrae fecha REAL (startDate), nombre, lugar, descripción, precio, imagen.
 * - Infiere zona (comuna) y categoría desde el texto.
 * - Filtra a solo eventos PRÓXIMOS y descarta abonos/membresías.
 * - No usa Claude (no requiere ANTHROPIC_API_KEY).
 * - Reemplaza los eventos de Ticketplus en events.json y deja el resto intacto.
 *
 * Uso:  node scripts/scrape-ticketplus.js [--limit N]
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const SITEMAP = 'https://ticketplus.cl/sitemap.xml';
const CONCURRENCY = 12;
const UA = 'Mozilla/5.0 (compatible; GautBot/1.0; +https://descubretuciudad.com)';

const DOW = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Comuna -> código de zona usado por el frontend
const ZONE_MAP = [
  [/lo barnechea/i, 'lob'],
  [/vitacura/i, 'vit'],
  [/las condes/i, 'lc'],
  [/la reina/i, 'lare'],
  [/[ñn]u[ñn]oa/i, 'nun'],
  [/providencia/i, 'prov'],
  [/huechuraba|independencia|recoleta|conchal[ií]/i, 'ind'],
];
function inferZone(text) {
  for (const [re, z] of ZONE_MAP) if (re.test(text)) return z;
  return 'cen';
}

function inferCat(text) {
  const t = text.toLowerCase();
  if (/(concierto|sinf[oó]nic|m[uú]sica|orquesta|banda|tour|festival|dj|jazz|rock|cumbia|recital|cantante)/.test(t)) return 'music';
  if (/(f[uú]tbol|deporte|partido|marat[oó]n|running|b[aá]squet|tenis|estadio)/.test(t)) return 'sport';
  if (/(gastron|cena|degustaci|cerveza|vino|food|restaurant|brunch)/.test(t)) return 'food';
  return 'culture'; // teatro, expo, danza, stand-up, familiar, etc.
}
const CAT_EMOJI = { music: '🎵', sport: '⚽', food: '🍽️', culture: '🎭' };

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENT[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

async function fetchText(url, ms = 8000) {
  const ctrl = AbortSignal.timeout(ms);
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: ctrl });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function extractEventLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of blocks) {
    let data;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
    for (const it of items) if (it && it['@type'] === 'Event') return it;
  }
  return null;
}

function ogImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/meta-og:image:\s*([^\n<"]+)/i);
  return m ? m[1].trim() : '';
}

function toEvent(ld, html, url) {
  const name = decodeEntities(ld.name || '');
  if (!name || name.length < 3) return null;
  const startStr = (ld.startDate || '').slice(0, 10);
  const m = startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;                       // sin fecha utilizable → descartar
  const [, y, mo, d] = m.map(Number);
  const dateObj = new Date(y, mo - 1, d, 12, 0, 0);
  const dateMs = dateObj.getTime();

  const loc = ld.location || {};
  const venue = decodeEntities(loc.name || '');
  const addr = decodeEntities((loc.address && (typeof loc.address === 'string' ? loc.address : loc.address.streetAddress)) || '');
  const desc = decodeEntities((ld.description || '').replace(/\s+/g, ' ')).slice(0, 300);
  const haystack = `${name} ${venue} ${addr} ${desc}`;

  // precio
  let price = null;
  const offers = ld.offers ? (Array.isArray(ld.offers) ? ld.offers : [ld.offers]) : [];
  for (const o of offers) {
    const p = Number(o.price || o.lowPrice);
    if (!isNaN(p) && p > 0) { price = (price === null) ? p : Math.min(price, p); }
  }

  const cat = inferCat(haystack);
  const zone = inferZone(haystack);
  const img = (typeof ld.image === 'string' ? ld.image : (ld.image && ld.image.url)) || ogImage(html) || '';
  const kid = /(kids|ni[ñn]o|infantil|familiar)/i.test(haystack);

  return {
    title: name,
    cat,
    emoji: CAT_EMOJI[cat] || '🎫',
    desc,
    date: `${DOW[dateObj.getDay()]} ${d} de ${MONTHS[mo - 1]}`,
    dateMs,
    month: mo - 1,
    days: [d],
    venue: venue || 'Ticketplus',
    address: addr,
    zone,
    mapsQ: encodeURIComponent(`${venue || name} Santiago`).replace(/%20/g, '+'),
    price,
    src: 'Ticketplus',
    srcUrl: url,
    tickets: url,
    img,
    tags: [],
    acc: false,
    pet: false,
    kid,
    tipo: 'event',
  };
}

async function pool(items, worker, size) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]).catch(() => null);
    }
  });
  await Promise.all(runners);
  return out;
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  console.log('Bajando sitemap de Ticketplus...');
  const xml = await fetchText(SITEMAP, 20000);
  let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).filter(u => /\/events\//.test(u));
  // Descartar URLs que claramente no son eventos puntuales
  const NON_EVENT = /(abono|abonado|membresia|membres[ií]a|socio|temporada|liga-|plan-|gift-?card)/i;
  urls = urls.filter(u => !NON_EVENT.test(u));
  if (LIMIT < urls.length) urls = urls.slice(0, LIMIT);
  console.log(`URLs de eventos a revisar: ${urls.length}`);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const maxMs = todayMs + 425 * 86400000;          // ~14 meses (descarta basura muy a futuro)

  let ok = 0, past = 0, nold = 0, far = 0;
  const events = [];
  await pool(urls, async (url) => {
    let html;
    try { html = await fetchText(url); } catch { return; }
    const ld = extractEventLd(html);
    if (!ld) { nold++; return; }
    const ev = toEvent(ld, html, url);
    if (!ev) { nold++; return; }
    if (ev.dateMs < todayMs) { past++; return; }   // solo próximos
    if (ev.dateMs > maxMs) { far++; return; }        // descartar muy a futuro (probable basura)
    ok++; events.push(ev);
  }, CONCURRENCY);

  console.log(`\nPróximos: ${ok} | Pasados: ${past} | Muy a futuro: ${far} | Sin datos: ${nold}`);
  const byZone = {};
  events.forEach(e => { byZone[e.zone] = (byZone[e.zone] || 0) + 1; });
  console.log('Por zona:', JSON.stringify(byZone));

  // Merge: reemplazar solo los eventos de Ticketplus, conservar el resto
  let data = { events: [], coords: {}, meta: {} };
  if (fs.existsSync(EVENTS_PATH)) data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const others = (data.events || []).filter(e => e.src !== 'Ticketplus' && !/ticketplus\.cl/.test(e.srcUrl || ''));
  const before = (data.events || []).length;

  // Reasignar ids
  let nextId = 1;
  const all = [...others, ...events].map(e => ({ ...e, id: nextId++ }));
  data.events = all;
  data.meta = { ...(data.meta || {}), lastUpdated: new Date().toISOString().slice(0, 10), totalEvents: all.length };

  if (process.argv.includes('--dry')) {
    console.log(`\n[DRY] events.json pasaría de ${before} a ${all.length} eventos (Ticketplus: ${events.length}). No se escribió.`);
    return;
  }
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nListo. events.json: ${before} → ${all.length} eventos (Ticketplus próximos: ${events.length}).`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
