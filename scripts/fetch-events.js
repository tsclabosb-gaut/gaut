/**
 * fetch-events.js
 * Raspa agendas culturales de municipalidades de Santiago,
 * pasa TODO el texto a Gemini en UNA sola llamada (batch),
 * y mergea con events.json sin duplicados.
 *
 * Uso: node scripts/fetch-events.js
 * Requiere: GEMINI_API_KEY en variables de entorno
 * Node >= 18 (fetch nativo)
 */

const fs   = require('fs');
const path = require('path');

const EVENTS_PATH    = path.join(__dirname, '..', 'events.json');
const MODEL          = 'gemini-2.0-flash';
const TODAY          = new Date().toISOString().slice(0, 10);
const RETRY_DELAYS   = [15_000, 30_000, 60_000]; // ante 429
const CHARS_PER_SOURCE = 4000; // limite por fuente en el batch

function geminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

// ── Fuentes a raspar ──────────────────────────────────────────────────────────
const SOURCES = [
  { name: 'Las Condes Cultural',               zone: 'lc',   url: 'https://agendacultural.culturallascondes.cl/' },
  { name: 'Santiago Cultura - Novedades',      zone: 'cen',  url: 'https://www.santiagocultura.cl/category/novedades-culturales/' },
  { name: 'Municipalidad de Nunoa - Cultura',  zone: 'nun',  url: 'https://www.nunoa.cl/cultura/' },
  { name: 'Las Condes - Panorama mensual',     zone: 'lc',   url: 'https://www2.lascondes.cl/vive-las-condes/panorama-mensual/' },
  { name: 'Corporacion Cultural Lo Barnechea', zone: 'lob',  url: 'https://corporacionculturaldelobarnechea.cl/agenda/' },
  { name: 'Vitacura Cultura',                  zone: 'vit',  url: 'https://vitacuracultura.cl/' },
  { name: 'Vitacura - Actividades municipales',zone: 'vit',  url: 'https://vitacura.cl/actividades/' },
  { name: 'Corporacion Cultural La Reina',     zone: 'lare', url: 'https://culturalareina.cl/' },
  { name: 'Municipalidad La Reina - Eventos',  zone: 'lare', url: 'https://www.lareina.cl/eventos-y-actividades/' },
  { name: 'Municipalidad Huechuraba - Cultura',zone: 'ind',  url: 'https://huechuraba.cl/sala-de-prensa/destacado/cultura' },
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

Ejemplo de un evento:
[{"title":"Nombre del evento","cat":"culture","emoji":"🎨","desc":"Descripcion breve.","date":"Sab 15 de mayo 19:00","dateMs":1747357200000,"month":4,"days":[15,16,17],"venue":"Centro Cultural Las Condes","address":"Apoquindo 6570, Las Condes","zone":"lc","mapsQ":"Centro+Cultural+Las+Condes+Santiago","price":null,"src":"Las Condes Cultural","srcUrl":"https://agendacultural.culturallascondes.cl/","img":"","tags":["Exposicion"],"acc":false,"pet":false,"kid":false,"tipo":"expo"}]

NOTAS:
- "month": 0=Ene 1=Feb 2=Mar 3=Abr 4=May 5=Jun (JS Date.getMonth())
- "days": dias del mes en que ocurre
- "dateMs": timestamp ms del primer dia a las 20:00 si no hay hora especifica
- "img": URL real de imagen si aparece en el texto, sino cadena vacia ""`;

// ── Raspar una URL ────────────────────────────────────────────────────────────
async function scrape(source) {
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

// ── Llamar a Gemini con retry ante 429 ───────────────────────────────────────
async function callGeminiWithRetry(prompt) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch(geminiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (res.ok) return res;

    const errText = await res.text();

    if (res.status === 429 && attempt < RETRY_DELAYS.length) {
      const waitSeg = RETRY_DELAYS[attempt] / 1000;
      console.warn(`  Gemini 429 — esperando ${waitSeg}s (intento ${attempt + 2}/${RETRY_DELAYS.length + 1})...`);
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }
}

// ── Batch: una sola llamada con todas las fuentes ─────────────────────────────
async function extractAllWithGemini(scraped) {
  const bloques = scraped
    .map(({ source, text }) =>
      `=== FUENTE: ${source.name} | zona="${source.zone}" | url=${source.url} ===\n${text}\n=== FIN ${source.name} ===`
    )
    .join('\n\n');

  const prompt = `${SYSTEM_PROMPT}

Fecha de hoy: ${TODAY}
Tienes texto de ${scraped.length} fuentes distintas de municipalidades de Santiago.
Extrae todos los eventos validos de TODAS las fuentes y devuelve UN SOLO array JSON.

${bloques}`;

  const res  = await callGeminiWithRetry(prompt);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) throw new Error('Gemini no devolvio contenido');

  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,     '')
    .replace(/```\s*$/i,     '')
    .trim();

  const parsed = JSON.parse(clean);
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

  const cutoff  = Date.now() - 86_400_000;
  const valid   = merged.filter(e => !e.dateMs || e.dateMs > cutoff);
  const expired = merged.length - valid.length;

  console.log(`  Nuevos: ${added} | Duplicados ignorados: ${dupes} | Expirados eliminados: ${expired}`);

  return {
    events: valid,
    coords: existing.coords || {},
    meta: { lastUpdated: TODAY, totalEvents: valid.length, generatedBy: 'github-actions + scraping + gemini' }
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');

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

  // 2. Una sola llamada a Gemini (batch)
  console.log(`Llamando a Gemini con ${scraped.length} fuentes en una sola llamada...`);
  let allNew = [];
  try {
    allNew = await extractAllWithGemini(scraped);
    console.log(`Gemini extrajo: ${allNew.length} eventos en total\n`);
  } catch (err) {
    console.error(`Error en Gemini: ${err.message}`);
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
