/**
 * fetch-events.js
 * Raspa agendas culturales de municipalidades de Santiago,
 * pasa TODO el texto a Claude en UNA sola llamada (batch),
 * y mergea con events.json sin duplicados.
 *
 * Uso: node scripts/fetch-events.js
 * Requiere: ANTHROPIC_API_KEY en variables de entorno
 * Node >= 18 (fetch nativo)
 */

const fs   = require('fs');
const path = require('path');

const EVENTS_PATH      = path.join(__dirname, '..', 'events.json');
const MODEL            = 'claude-haiku-4-5';
const TODAY            = new Date().toISOString().slice(0, 10);
const CHARS_PER_SOURCE = 4000;

// ── Fuentes a raspar ──────────────────────────────────────────────────────────
const SOURCES = [
  // Las Condes
  { name: 'Las Condes Cultural',               zone: 'lc',   url: 'https://agendacultural.culturallascondes.cl/' },
  { name: 'Las Condes - Panorama mensual',     zone: 'lc',   url: 'https://www2.lascondes.cl/vive-las-condes/panorama-mensual/' },
  // Santiago Centro
  { name: 'Santiago Cultura - Agenda',         zone: 'cen',  url: 'https://www.santiagocultura.cl/agenda-cultural/' },
  { name: 'GAM - Centro Gabriela Mistral',     zone: 'cen',  url: 'https://gam.cl/es/calendario/' },
  { name: 'MNBA - Cartelera',                  zone: 'cen',  url: 'https://www.mnba.gob.cl/cartelera' },
  { name: 'Estacion Mapocho',                  zone: 'cen',  url: 'https://www.estacionmapocho.cl/' },
  // Providencia
  { name: 'Municipalidad Providencia - Agenda',zone: 'prov', url: 'https://providencia.cl/provi/site/tax/port/fid_actividades/taxport_3_4__1.html' },
  // Nunoa
  { name: 'Corporacion Cultural Nunoa',        zone: 'nun',  url: 'https://www.ccn.cl/' },
  { name: 'Municipalidad Nunoa - Cultura',     zone: 'nun',  url: 'https://www.nunoa.cl/category/cultura/' },
  // Lo Barnechea
  { name: 'Corporacion Cultural Lo Barnechea', zone: 'lob',  url: 'https://corporacionculturaldelobarnechea.cl/agenda/' },
  // Vitacura
  { name: 'Vitacura Cultura',                  zone: 'vit',  url: 'https://vitacuracultura.cl/' },
  { name: 'Vitacura - Actividades municipales',zone: 'vit',  url: 'https://vitacura.cl/actividades/' },
  // La Reina
  { name: 'Corporacion Cultural La Reina',     zone: 'lare', url: 'https://culturalareina.cl/' },
  { name: 'Municipalidad La Reina - Eventos',  zone: 'lare', url: 'https://www.lareina.cl/eventos-y-actividades/' },
  // Huechuraba
  { name: 'Municipalidad Huechuraba - Cultura',zone: 'ind',  url: 'https://huechuraba.cl/sala-de-prensa/destacado/cultura' },
  // Agregadores (sin zona fija, Claude asigna segun evento)
  { name: 'Fever - Santiago',                  zone: 'cen',  url: 'https://feverup.com/es/santiago' },
  { name: 'Eventbrite - Santiago',             zone: 'cen',  url: 'https://www.eventbrite.cl/d/chile--santiago/eventos/' },
  // TicketPlus Chile - venta de entradas
  { name: 'TicketPlus - Region Metropolitana', zone: 'cen',  url: 'https://ticketplus.cl/region/region-metropolitana-de-santiago' },
  { name: 'TicketPlus - Teatro',               zone: 'cen',  url: 'https://ticketplus.cl/category/teatro' },
  { name: 'TicketPlus - Musica',               zone: 'cen',  url: 'https://ticketplus.cl/category/musica' },
  { name: 'TicketPlus - Fiestas',              zone: 'cen',  url: 'https://ticketplus.cl/category/fiesta' },
];

// ── Limpia HTML a texto plano ─────────────────────────────────────────────────
function htmlToText(html, maxChars = CHARS_PER_SOURCE) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi,   '')
    .replace(/<nav[\s\S]*?<\/nav>/gi,       '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g,            '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/\s{3,}/g,  '\n')
    .trim()
    .slice(0, maxChars);
}

// ── Prompt del sistema ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un extractor de eventos culturales para Gaut, una app de Santiago de Chile.
Recibiras texto de varias paginas de municipalidades y debes extraer eventos reales.

REGLAS:
- Solo eventos con fecha concreta en los proximos 60 dias desde hoy (${TODAY})
- Ignora talleres recurrentes sin fecha especifica, cursos y tramites administrativos
- Si no hay precio explicito usa null. Si dice "gratis" o "entrada liberada" usa 0
- Se conservador: 3 eventos buenos son mejor que 10 dudosos

CATEGORIAS ("cat"):
- "music"   -> conciertos, recitales, opera, coro
- "culture" -> exposiciones, teatro, charlas, cine, literatura, danza
- "sport"   -> deporte, actividad fisica, al aire libre
- "food"    -> gastronomia, ferias de comida

ZONAS ("zone"): lc | cen | nun | prov | bella | vit | lare | ind | lob
TIPO ("tipo"):  conc | fest | expo | tetr | dep | charla

RESPONDE SOLO con un array JSON valido, sin texto adicional ni backticks.

Ejemplo:
[{"title":"Nombre del evento","cat":"culture","emoji":"🎨","desc":"Descripcion breve.","date":"Sab 15 de mayo 19:00","dateMs":1747357200000,"month":4,"days":[15,16,17],"venue":"Centro Cultural Las Condes","address":"Apoquindo 6570, Las Condes","zone":"lc","mapsQ":"Centro+Cultural+Las+Condes+Santiago","price":null,"src":"Las Condes Cultural","srcUrl":"https://agendacultural.culturallascondes.cl/","img":"","tags":["Exposicion"],"acc":false,"pet":false,"kid":false,"tipo":"expo"}]

NOTAS:
- "month": 0=Ene 1=Feb 2=Mar 3=Abr 4=May 5=Jun (JS Date.getMonth())
- "days": dias del mes en que ocurre
- "dateMs": timestamp ms del primer dia a las 20:00 si no hay hora especifica
- "img": URL real de imagen si aparece en el texto, sino cadena vacia ""
- Para eventos de TicketPlus: el srcUrl debe ser la URL completa del evento (https://ticketplus.cl/events/...)
- Para eventos de TicketPlus: el tickets debe ser la misma URL del evento`;

// ── Raspar una URL ────────────────────────────────────────────────────────────
async function scrapeTicketPlus(source) {
  // TicketPlus renders via JS — try their search API endpoint first
  const region = 'region-metropolitana-de-santiago';
  try {
    // Try JSON API endpoint (undocumented but works)
    const apiUrl = `https://ticketplus.cl/api/v1/events?country=CL&region=${region}&per_page=50&sort=date`;
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const data = await res.json();
        const events = data.events || data.data || data || [];
        if (Array.isArray(events) && events.length > 0) {
          const text = events.map(e =>
            `Evento: ${e.name || e.title || ''}\nFecha: ${e.start_date || e.date || ''}\nLugar: ${e.venue?.name || e.place || ''}\nPrecio: ${e.min_price || e.price || 'consultar'}\nURL: https://ticketplus.cl/events/${e.slug || e.id || ''}`
          ).join('\n\n');
          console.log(`  OK   ${source.name} (API): ${events.length} eventos`);
          return text.slice(0, 4000);
        }
      }
    }
  } catch(e) { /* fall through to HTML scrape */ }

  // Fallback: scrape HTML normally
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GautBot/1.0)', 'Accept-Language': 'es-CL,es;q=0.9' },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) { console.warn(`  SKIP ${source.name}: HTTP ${res.status}`); return null; }
    const html = await res.text();
    const text = htmlToText(html);
    // TicketPlus HTML might be sparse — only use if meaningful content found
    if (text.length > 500) {
      console.log(`  OK   ${source.name} (HTML): ${text.length} chars`);
      return text;
    }
    console.warn(`  SKIP ${source.name}: contenido insuficiente (JS-rendered)`);
    return null;
  } catch(err) {
    console.warn(`  SKIP ${source.name}: ${err.message}`);
    return null;
  }
}
// ── Raspar una URL ────────────────────────────────────────────────────────────
async function scrape(source) {
  // Route TicketPlus to dedicated scraper
  if (source.url.includes('ticketplus.cl')) return scrapeTicketPlus(source);

  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; GautBot/1.0)',
        'Accept-Language': 'es-CL,es;q=0.9',
        'Accept':          'text/html'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      console.warn(`  SKIP ${source.name}: HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    const text = htmlToText(html);
    console.log(`  OK   ${source.name}: ${text.length} chars`);
    return text;
  } catch (err) {
    console.warn(`  SKIP ${source.name}: ${err.message}`);
    return null;
  }
}

// ── Llamar a Claude API ───────────────────────────────────────────────────────
async function callClaude(userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 16000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }]
    }),
    signal: AbortSignal.timeout(60000)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Batch: una sola llamada con todas las fuentes ─────────────────────────────
async function extractAllWithClaude(scraped) {
  const bloques = scraped
    .map(({ source, text }) =>
      `=== FUENTE: ${source.name} | zona="${source.zone}" | url=${source.url} ===\n${text}\n=== FIN ${source.name} ===`
    )
    .join('\n\n');

  const userPrompt = `Fecha de hoy: ${TODAY}
Tienes texto de ${scraped.length} fuentes distintas de municipalidades de Santiago.
Extrae todos los eventos validos de TODAS las fuentes y devuelve UN SOLO array JSON.

${bloques}`;

  const text = await callClaude(userPrompt);

  if (!text) throw new Error('Claude no devolvio contenido');

  let clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,     '')
    .replace(/```\s*$/i,     '')
    .trim();

  // Si el JSON está cortado, intentar repararlo cerrando el array
  if (!clean.endsWith(']')) {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace !== -1) clean = clean.slice(0, lastBrace + 1) + ']';
    else clean = '[]';
  }

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch(e) {
    console.warn('  JSON malformado, devolviendo array vacio');
    return [];
  }
  return Array.isArray(parsed) ? parsed : (parsed.events || []);
}

// ── Merge sin duplicados ──────────────────────────────────────────────────────
function normalize(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function mergeEvents(existing, incoming) {
  const byTitle = new Map();
  (existing.events || []).forEach(e => byTitle.set(normalize(e.title), e));

  let nextId = existing.events?.length
    ? Math.max(...existing.events.map(e => e.id)) + 1
    : 1;
  let added = 0, dupes = 0;
  const merged = [...(existing.events || [])];

  incoming.forEach(ev => {
    const key = normalize(ev.title);
    if (byTitle.has(key)) { dupes++; return; }
    merged.push({ ...ev, id: nextId++ });
    byTitle.set(key, ev);
    added++;
  });

  const cutoff = Date.now();
  const thisYear = new Date().getFullYear();

  const valid  = merged.filter(e => {
    if (!e.dateMs) return true;
    // Construir la fecha real usando month + days (ignorar el año del dateMs que puede ser incorrecto)
    if (e.month !== undefined && e.days && e.days.length > 0) {
      const lastDay  = Math.max(...e.days);
      // Intentar este año primero, si ya pasó probar el siguiente
      let lastDate = new Date(thisYear, e.month, lastDay, 23, 59, 59);
      if (lastDate.getTime() < cutoff) {
        lastDate = new Date(thisYear + 1, e.month, lastDay, 23, 59, 59);
      }
      return lastDate.getTime() > cutoff;
    }
    // Fallback: usar dateMs pero corregir el año si está en el pasado
    const d = new Date(e.dateMs);
    if (d.getFullYear() < thisYear) d.setFullYear(thisYear);
    if (d.getTime() < cutoff) d.setFullYear(thisYear + 1);
    return d.getTime() > cutoff;
  });
  const expired = merged.length - valid.length;

  console.log(`  Nuevos: ${added} | Duplicados ignorados: ${dupes} | Expirados eliminados: ${expired}`);

  return {
    events: valid,
    coords: existing.coords || {},
    meta: { lastUpdated: TODAY, totalEvents: valid.length, generatedBy: 'github-actions + scraping + claude' }
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');

  let existing = { events: [], coords: {}, meta: {} };
  if (fs.existsSync(EVENTS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
      console.log(`events.json actual: ${existing.events?.length || 0} eventos\n`);
    } catch { console.warn('events.json corrupto, empezando desde cero\n'); }
  }

  // 1. Raspar todas las fuentes en paralelo
  console.log('Raspando fuentes en paralelo...');
  const results = await Promise.allSettled(SOURCES.map(s => scrape(s)));

  const scraped = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) scraped.push({ source: SOURCES[i], text: r.value });
  });
  console.log(`\n${scraped.length}/${SOURCES.length} fuentes OK\n`);

  if (scraped.length === 0) {
    console.warn('Ninguna fuente disponible. Saliendo sin cambios.');
    return;
  }

  // 2. Una sola llamada a Claude (batch)
  console.log(`Llamando a Claude con ${scraped.length} fuentes en batch...`);
  let allNew = [];
  try {
    allNew = await extractAllWithClaude(scraped);
    console.log(`Claude extrajo: ${allNew.length} eventos en total\n`);
  } catch (err) {
    console.error(`Error en Claude: ${err.message}`);
    process.exit(1);
  }

  // 3. Merge y guardar
  console.log(`Mergeando ${allNew.length} eventos...`);
  const result = mergeEvents(existing, allNew);
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\nListo. events.json: ${result.events.length} eventos activos`);
}

main().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
