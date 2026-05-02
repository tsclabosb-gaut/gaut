/**
 * fetch-events.js
 * Raspa agendas culturales de municipalidades de Santiago,
 * pasa el texto a Gemini para estructurarlo en JSON,
 * y mergea con events.json sin duplicados.
 *
 * Uso: node scripts/fetch-events.js
 * Requiere: GEMINI_API_KEY en variables de entorno
 * Node >= 18 (fetch nativo)
 */

const fs   = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');
const MODEL       = 'gemini-2.0-flash';
const TODAY       = new Date().toISOString().slice(0, 10);

function geminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

// ── Fuentes a raspar ─────────────────────────────────────────────────────────
const SOURCES = [
  {
    name: 'Las Condes Cultural',
    zone: 'lc',
    url:  'https://agendacultural.culturallascondes.cl/',
  },
  {
    name: 'Santiago Cultura – Novedades',
    zone: 'cen',
    url:  'https://www.santiagocultura.cl/category/novedades-culturales/',
  },
  {
    name: 'Municipalidad de Ñuñoa – Cultura',
    zone: 'nun',
    url:  'https://www.nunoa.cl/cultura/',
  },
  {
    name: 'Las Condes – Panorama mensual',
    zone: 'lc',
    url:  'https://www2.lascondes.cl/vive-las-condes/panorama-mensual/',
  },

  // Lo Barnechea
  {
    name: 'Corporación Cultural Lo Barnechea',
    zone: 'lob',
    url:  'https://corporacionculturaldelobarnechea.cl/agenda/',
  },

  // Vitacura
  {
    name: 'Vitacura Cultura',
    zone: 'vit',
    url:  'https://vitacuracultura.cl/',
  },
  {
    name: 'Vitacura – Actividades municipales',
    zone: 'vit',
    url:  'https://vitacura.cl/actividades/',
  },

  // La Reina
  {
    name: 'Corporación Cultural La Reina',
    zone: 'lare',
    url:  'https://culturalareina.cl/',
  },
  {
    name: 'Municipalidad La Reina – Eventos',
    zone: 'lare',
    url:  'https://www.lareina.cl/eventos-y-actividades/',
  },

  // Huechuraba
  {
    name: 'Municipalidad Huechuraba – Cultura',
    zone: 'ind',
    url:  'https://huechuraba.cl/sala-de-prensa/destacado/cultura',
  },
];

// ── Limpia HTML a texto plano ─────────────────────────────────────────────────
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi,   '')
    .replace(/<nav[\s\S]*?<\/nav>/gi,        '')
    .replace(/<footer[\s\S]*?<\/footer>/gi,  '')
    .replace(/<!--[\s\S]*?-->/g,             '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g,  ' ')
    .replace(/&amp;/g,   '&')
    .replace(/&lt;/g,    '<')
    .replace(/&gt;/g,    '>')
    .replace(/\s{3,}/g,  '\n')
    .trim()
    .slice(0, 12000);
}

// ── Prompt del sistema ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
Eres un extractor de eventos culturales para Gaut, una app de Santiago de Chile.
Recibirás texto extraído de páginas de municipalidades y debes extraer eventos reales.

REGLAS:
- Solo eventos con fecha concreta en los próximos 60 días desde hoy (${TODAY})
- Ignora talleres recurrentes sin fecha específica, cursos y trámites administrativos
- Si no hay precio explícito usa null. Si dice "gratis" o "entrada liberada" usa 0
- Sé conservador: 3 eventos buenos son mejor que 10 dudosos

CATEGORÍAS ("cat"):
- "music"   → conciertos, recitales, ópera, coro
- "culture" → exposiciones, teatro, charlas, cine, literatura, danza
- "sport"   → deporte, actividad física, al aire libre
- "food"    → gastronomía, ferias de comida

ZONAS ("zone"): lc | cen | nun | prov | bella | vit | lare | ind | lob
TIPO ("tipo"):  conc | fest | expo | tetr | dep | charla

RESPONDE SOLO con un array JSON válido, sin texto adicional ni backticks.

[
  {
    "title":   "Nombre del evento",
    "cat":     "culture",
    "emoji":   "🎨",
    "desc":    "Descripción breve (2-3 oraciones).",
    "date":    "Sáb 15 de mayo · 19:00",
    "dateMs":  1747357200000,
    "month":   4,
    "days":    [15, 16, 17],
    "venue":   "Centro Cultural Las Condes",
    "address": "Apoquindo 6570, Las Condes",
    "zone":    "lc",
    "mapsQ":   "Centro+Cultural+Las+Condes+Santiago",
    "price":   null,
    "src":     "Las Condes Cultural",
    "srcUrl":  "https://agendacultural.culturallascondes.cl/",
    "img":     "",
    "tags":    ["Exposición", "Arte"],
    "acc":     false,
    "pet":     false,
    "kid":     false,
    "tipo":    "expo"
  }
]

NOTAS:
- "month": 0=Ene 1=Feb 2=Mar 3=Abr 4=May 5=Jun ... (JS Date.getMonth())
- "days": días del mes en que ocurre (exposición del 5 al 31 → [5,6,...,31])
- "dateMs": timestamp ms del primer día a las 20:00 si no hay hora específica
- "img": URL real de imagen si aparece en el texto, sino cadena vacía ""
`.trim();

// ── Raspar una URL ────────────────────────────────────────────────────────────
async function scrape(source) {
  console.log(`  🌐 Raspando: ${source.name}`);
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
      console.warn(`  ⚠️  ${source.name}: HTTP ${res.status} — omitiendo`);
      return null;
    }

    const html = await res.text();
    const text = htmlToText(html);
    console.log(`  ✅ ${source.name}: ${text.length} chars`);
    return text;

  } catch (err) {
    console.warn(`  ⚠️  ${source.name}: ${err.message} — omitiendo`);
    return null;
  }
}

// ── Llamar a Gemini para estructurar el texto ─────────────────────────────────
async function extractWithGemini(source, rawText) {
  const prompt = `
${SYSTEM_PROMPT}

Fuente: ${source.name}
URL fuente: ${source.url}
Zona por defecto si no se especifica: "${source.zone}"
Fecha de hoy: ${TODAY}

Texto de la página:
---
${rawText}
---

Extrae los eventos válidos y devuelve SOLO el array JSON, sin texto adicional.
`.trim();

  const res = await fetch(geminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 4096
      }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) throw new Error('Gemini no devolvió contenido');

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
    const newEv = { ...ev, id: nextId++ };
    merged.push(newEv);
    byTitle.set(key, newEv);
    added++;
  });

  const cutoff  = Date.now() - 86_400_000;
  const valid   = merged.filter(e => !e.dateMs || e.dateMs > cutoff);
  const expired = merged.length - valid.length;

  console.log(`  📊 Nuevos: ${added} | Duplicados ignorados: ${dupes} | Expirados eliminados: ${expired}`);

  return {
    events: valid,
    coords: existing.coords || {},
    meta: {
      lastUpdated: TODAY,
      totalEvents: valid.length,
      generatedBy: 'github-actions + scraping + gemini'
    }
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY');
  }

  let existing = { events: [], coords: {}, meta: {} };
  if (fs.existsSync(EVENTS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
      console.log(`📂 events.json actual: ${existing.events?.length || 0} eventos\n`);
    } catch {
      console.warn('⚠️  events.json corrupto, empezando desde cero\n');
    }
  }

  let allNew = [];

  for (const source of SOURCES) {
    const rawText = await scrape(source);
    if (!rawText) continue;

    try {
      console.log(`  🤖 Extrayendo con Gemini: ${source.name}…`);
      const events = await extractWithGemini(source, rawText);
      console.log(`  🎯 Resultado: ${events.length} eventos\n`);
      allNew = allNew.concat(events);
    } catch (err) {
      console.warn(`  ⚠️  Error en Gemini para ${source.name}: ${err.message}\n`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`🔄 Mergeando ${allNew.length} eventos encontrados…`);
  const result = mergeEvents(existing, allNew);

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n✅ Listo. events.json: ${result.events.length} eventos activos`);
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
