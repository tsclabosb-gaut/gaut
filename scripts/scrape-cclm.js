/**
 * Scraper del Centro Cultural La Moneda (CCLM).
 * - Lista actividades vía API de WordPress (/wp-json/wp/v2/actividad).
 * - De cada página extrae la fecha y hora reales (sección "COORDENADAS").
 * - Sin Claude. Reemplaza los eventos con src 'CCLM' en events.json.
 *
 * Uso:  node scripts/scrape-cclm.js [--limit N] [--dry]
 */
const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const API = 'https://www.cclm.cl/wp-json/wp/v2/actividad';
const CONCURRENCY = 10;
const UA = 'Mozilla/5.0 (compatible; GautBot/1.0; +https://descubretuciudad.com)';
const VENUE = 'Centro Cultural La Moneda';
const ADDRESS = 'Plaza de la Ciudadanía 26, Santiago';

const DOW = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_RE = MONTHS.join('|');

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENT[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/<[^>]+>/g, '').trim();
}
function inferCat(text) {
  const t = text.toLowerCase();
  if (/(concierto|sinf[oó]nic|m[uú]sica|orquesta|recital|jazz|coro|banda)/.test(t)) return 'music';
  if (/(cine|pel[ií]cula|film|documental)/.test(t)) return 'culture';
  return 'culture';
}
const CAT_EMOJI = { music: '🎵', sport: '⚽', food: '🍽️', culture: '🎭' };

async function fetchText(url, ms = 9000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// Lista todas las actividades (paginado)
async function listActivities(maxPages = 3) {
  const out = [];
  for (let p = 1; p <= maxPages; p++) {
    let arr;
    try {
      const txt = await fetchText(`${API}?per_page=100&page=${p}&_fields=link,title`, 20000);
      arr = JSON.parse(txt);
    } catch { break; }
    if (!Array.isArray(arr) || arr.length === 0) break;
    arr.forEach(a => out.push({ title: decodeEntities(a.title && a.title.rendered), link: a.link }));
    if (arr.length < 100) break;
  }
  return out;
}

function parseDate(html) {
  // Fecha tipo "04 de julio, 2026" (con o sin año)
  const m = html.match(new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTHS_RE})(?:\\s*,?\\s*(\\d{4}))?`, 'i'));
  if (!m) return null;
  const day = Number(m[1]);
  const mo = MONTHS.indexOf(m[2].toLowerCase());
  const year = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (mo < 0) return null;
  // Hora de inicio (ej. "11:00 a 14:00" o "10:15 - 18:45")
  const hm = html.match(/(\d{1,2}):(\d{2})\s*(?:a|-|–)\s*\d{1,2}:\d{2}/);
  const hh = hm ? Number(hm[1]) : 12, mm = hm ? Number(hm[2]) : 0;
  const dateObj = new Date(year, mo, day, hh, mm, 0);
  return { dateObj, day, mo, year, time: hm ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '' };
}

function ogImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : '';
}

function toEvent(act, html) {
  const title = act.title;
  if (!title || title.length < 3) return null;
  const pd = parseDate(html);
  if (!pd) return null;
  const { dateObj, day, mo, time } = pd;
  const text = (title + ' ' + html.slice(0, 4000)).toLowerCase();
  const cat = inferCat(title);
  const free = /actividad gratuita|gratis|entrada liberada/.test(text);
  const kid = /(ni[ñn]o|ni[ñn]a|infantil|familiar|criatura)/.test(text);
  return {
    title,
    cat,
    emoji: CAT_EMOJI[cat] || '🎭',
    desc: '',
    date: `${DOW[dateObj.getDay()]} ${day} de ${MONTHS[mo]}${time ? ' ' + time : ''}`,
    dateMs: dateObj.getTime(),
    month: mo,
    days: [day],
    venue: VENUE,
    address: ADDRESS,
    zone: 'cen',
    mapsQ: encodeURIComponent(`${VENUE} Santiago`).replace(/%20/g, '+'),
    price: free ? 0 : null,
    src: 'CCLM',
    srcUrl: act.link,
    tickets: act.link,
    img: ogImage(html),
    tags: [],
    acc: false,
    pet: false,
    kid,
    tipo: 'event',
  };
}

async function pool(items, worker, size) {
  let i = 0;
  const runners = Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  });
  await Promise.all(runners);
}

async function main() {
  const limArg = process.argv.indexOf('--limit');
  const LIMIT = limArg > -1 ? Number(process.argv[limArg + 1]) : Infinity;

  console.log('Listando actividades de CCLM...');
  let acts = await listActivities();
  if (LIMIT < acts.length) acts = acts.slice(0, LIMIT);
  console.log(`Actividades a revisar: ${acts.length}`);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const maxMs = todayMs + 425 * 86400000;

  let ok = 0, past = 0, nodate = 0, far = 0;
  const events = [];
  await pool(acts, async (act) => {
    let html;
    try { html = await fetchText(act.link); } catch { return; }
    const ev = toEvent(act, html);
    if (!ev) { nodate++; return; }
    if (ev.dateMs < todayMs) { past++; return; }
    if (ev.dateMs > maxMs) { far++; return; }
    ok++; events.push(ev);
  }, CONCURRENCY);

  console.log(`\nPróximos: ${ok} | Pasados: ${past} | Sin fecha: ${nodate} | Muy a futuro: ${far}`);

  let data = { events: [], coords: {}, meta: {} };
  if (fs.existsSync(EVENTS_PATH)) data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  const others = (data.events || []).filter(e => e.src !== 'CCLM');
  const before = (data.events || []).length;
  let nextId = 1;
  const all = [...others, ...events].map(e => ({ ...e, id: nextId++ }));

  if (process.argv.includes('--dry')) {
    console.log(`[DRY] events.json: ${before} -> ${all.length} (CCLM: ${events.length}). No se escribió.`);
    events.slice(0, 8).forEach(e => console.log(`   ${new Date(e.dateMs).toISOString().slice(0, 10)} | ${e.cat} | ${e.title.slice(0, 45)}`));
    return;
  }
  data.events = all;
  data.meta = { ...(data.meta || {}), lastUpdated: new Date().toISOString().slice(0, 10), totalEvents: all.length };
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nListo. events.json: ${before} -> ${all.length} (CCLM próximos: ${events.length}).`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
