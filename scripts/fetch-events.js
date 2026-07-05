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
const CHARS_TICKETPLUS = 10000; // TicketPlus gets more chars (25 pages)

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
  // PuntoTicket - mayor ticketera de Chile, HTML estático
  { name: 'PuntoTicket - Santiago',            zone: 'cen',  url: 'https://www.puntoticket.com/' },
  // Teatro Municipal de Santiago
  { name: 'Teatro Municipal de Santiago',      zone: 'cen',  url: 'https://www.municipal.cl/cartelera/' },
  // TicketPlus ahora lo maneja scripts/scrape-ticketplus.js (JSON-LD, fechas reales, sin Claude)
  // Ticketmaster Chile - página principal + eventos específicos
  { name: 'Ticketmaster Chile - Home',         zone: 'cen',  url: 'https://www.ticketmaster.cl/es-cl/home' },
  { name: 'Ticketmaster - Family Fest Hasbro', zone: 'cen',  url: 'https://www.ticketmaster.cl/event/family-fest-by-hasbro' },
  // Passline - ticketera alternativa
  { name: 'Passline - Santiago',               zone: 'cen',  url: 'https://www.passline.com/eventos/ciudad-santiago' },
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
- Para eventos de TicketPlus: el srcUrl y tickets deben ser la URL completa (https://ticketplus.cl/events/...)
- Para eventos de TicketPlus: la imagen ya está en el campo "Imagen:" del texto
- Para eventos de Ticketmaster: srcUrl y tickets deben ser la URL del evento
- IMPORTANTE: Si el texto dice "Evento: X" con "URL entradas: Y", extrae ESO como evento con tickets=Y y srcUrl=Y
- IMPORTANTE: Extrae TODOS los eventos de TicketPlus que aparezcan en el texto
- IMPORTANTE: Para TicketPlus, usa la URL como identificador único - NO marques como duplicado si viene de URL diferente
- IMPORTANTE: Eventos de TicketPlus tienen zona="cen" por defecto, cat según el nombre del evento`;

// ── Raspar una URL ────────────────────────────────────────────────────────────
async function scrape(source) {
  try {
    const headers = {
      'User-Agent':      'Mozilla/5.0 (compatible; GautBot/1.0)',
      'Accept-Language': 'es-CL,es;q=0.9',
      'Accept':          source.isXml ? 'application/xml,text/xml' : 'text/html'
    };
    const res = await fetch(source.url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`  SKIP ${source.name}: HTTP ${res.status}`);
      return null;
    }
    const rawText = await res.text();
    let text;
    // For Ticketmaster, extract meta tags + body
    if (source.url && source.url.includes('ticketmaster.cl') && !source.isXml) {
      const metaTitle = (rawText.match(/meta-og:title:[^\S\n]*([^\n]+)/) || [])[1] || '';
      const metaDesc = (rawText.match(/meta-og:description:[^\S\n]*([^\n]+)/) || [])[1] || '';
      const metaImg = (rawText.match(/meta-og:image:[^\S\n]*([^\n]+)/) || [])[1] || '';
      const bodyText = htmlToText(rawText, 2000);
      text = [
        metaTitle ? `Evento: ${metaTitle}` : '',
        metaDesc ? `Fecha: ${metaDesc}` : '',
        metaImg ? `Imagen: ${metaImg}` : '',
        `URL: ${source.url}`,
        `Tickets: ${source.url}`,
        bodyText
      ].filter(Boolean).join('\n').slice(0, CHARS_PER_SOURCE);
      console.log(`  OK   ${source.name}: extracted from meta tags`);
    } else if (source.isXml) {
      // Extract event URLs from sitemap XML
      const urls = [...rawText.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      const eventUrls = urls.filter(u => u.includes('/events/') || u.includes('/evento/'));
      if (eventUrls.length === 0) {
        console.warn(`  SKIP ${source.name}: no event URLs in sitemap`);
        return null;
      }
      console.log(`  OK   ${source.name}: ${eventUrls.length} event URLs from sitemap, fetching first 25...`);
      // Fetch first 25 event pages to get real content
      const pageTexts = [];
      const toFetch = eventUrls.slice(0, 25);
      await Promise.allSettled(toFetch.map(async url => {
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GautBot/1.0)', 'Accept-Language': 'es-CL,es;q=0.9', 'Accept': 'text/html' },
            signal: AbortSignal.timeout(8000)
          });
          if (!r.ok) return;
          const pageHtml = await r.text();
          // Extract meta tags - TicketPlus has rich og: meta tags even though body is JS-rendered
          const gm = (key) => { const m = pageHtml.match(new RegExp(key + '[^\\S\\n]*([^\\n<"]+)')); return m ? m[1].trim() : ''; };
          const title = gm('meta-og:title:') || gm('title:') || '';
          const desc = gm('meta-og:description:') || gm('meta-description:') || '';
          const price = gm('meta-og:product:price:amount:');
          const img = gm('meta-og:image:');
          const cleanTitle = title.replace('Entradas para ', '').replace(/ - Ticketplus$/i, '').trim();
          if (!cleanTitle || cleanTitle.length < 3) return;
          const lines = [
            `Evento: ${cleanTitle}`,
            desc ? `Descripción: ${desc}` : '',
            price ? `Precio: $${price} CLP` : '',
            `URL entradas: ${url}`,
            img ? `Imagen: ${img}` : '',
          ].filter(Boolean).join('\n');
          pageTexts.push(`--- ${url} ---\n${lines}`);
        } catch(e) { /* skip */ }
      }));
      if (pageTexts.length === 0) {
        // Fallback: just send the URLs and let Claude infer from them
        text = 'Eventos en TicketPlus Chile (infiere de las URLs):\n' + eventUrls.slice(0, 30).join('\n');
      } else {
        text = pageTexts.join('\n\n').slice(0, CHARS_TICKETPLUS);
        console.log(`  TicketPlus: got content from ${pageTexts.length}/${toFetch.length} pages`);
      }
    } else {
      text = htmlToText(rawText);
      console.log(`  OK   ${source.name}: ${text.length} chars`);
    }
    return text.slice(0, CHARS_PER_SOURCE);
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
      max_tokens: 16000, // Max for claude-haiku
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

  const numIds = (existing.events || []).map(e => Number(e.id)).filter(n => !isNaN(n) && n > 0);
  let nextId = numIds.length ? Math.max(...numIds) + 1 : 1;
  let added = 0, dupes = 0;
  const merged = [...(existing.events || [])];

  // Also index by URL to avoid URL-based duplicates
  const byUrl = new Map();
  (existing.events || []).forEach(e => { if (e.srcUrl) byUrl.set(e.srcUrl, e); if (e.tickets) byUrl.set(e.tickets, e); });

  incoming.forEach(ev => {
    const key = normalize(ev.title);
    const urlKey = ev.srcUrl || ev.tickets || '';
    if (byTitle.has(key)) { dupes++; return; }
    if (urlKey && byUrl.has(urlKey)) { dupes++; return; }
    merged.push({ ...ev, id: nextId++, loadedAt: ev.loadedAt || TODAY });
    byTitle.set(key, ev);
    if (urlKey) byUrl.set(urlKey, ev);
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
    if (d.getTime() < cutoff - 86400000) d.setFullYear(thisYear + 1);
    return d.getTime() > cutoff - 86400000;
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

  // 2. Separate TicketPlus from the batch (it has large content)
  const tpScraped = scraped.filter(s => s.source.name.includes('TicketPlus'));
  const regularScraped = scraped.filter(s => !s.source.name.includes('TicketPlus'));
  
  console.log(`Llamando a Claude con ${scraped.length} fuentes en batch...`);
  let allNew = [];
  try {
    // Extract regular sources
    const regularNew = regularScraped.length > 0 ? await extractAllWithClaude(regularScraped) : [];
    // Extract TicketPlus separately  
    let tpNew = [];
    if (tpScraped.length > 0) {
      console.log(`  Extrayendo TicketPlus por separado (${tpScraped[0]?.text?.length || 0} chars)...`);
      tpNew = await extractAllWithClaude(tpScraped);
      console.log(`  TicketPlus extrajo: ${tpNew.length} eventos`);
    }
    allNew = [...regularNew, ...tpNew];
    console.log(`Claude extrajo: ${allNew.length} eventos en total`);
    if (allNew.length > 0) {
      console.log('  Títulos extraídos:');
      allNew.forEach(e => console.log(`    - ${e.title} | src: ${e.src || ''} | tickets: ${e.tickets || ''}`));
    }
    console.log('');
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
