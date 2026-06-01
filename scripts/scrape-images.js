#!/usr/bin/env node

/**
 * scrape-images.js
 * 
 * Intenta extraer imágenes reales de los eventos desde sus fuentes
 * Con fallback a Unsplash si no encuentra imagen
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

// Fallback por defecto
const FALLBACK_IMAGES = {
  'culture|expo': 'https://images.unsplash.com/photo-1578301978162-7aae4d755744?w=400&h=250&fit=crop',
  'culture|tetr': 'https://images.unsplash.com/photo-1503852931313-52581002a659?w=400&h=250&fit=crop',
  'culture|charla': 'https://images.unsplash.com/photo-1540575467063-178f50902556?w=400&h=250&fit=crop',
  'culture|conc': 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400&h=250&fit=crop',
  'culture|fest': 'https://images.unsplash.com/photo-1516989236390-4d25abb49bd1?w=400&h=250&fit=crop',
  'music|conc': 'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400&h=250&fit=crop',
  'music|fest': 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop',
  'sport|dep': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=250&fit=crop',
  'food|food': 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=250&fit=crop',
  'default': 'https://images.unsplash.com/photo-1517457373614-b7152f800bb1?w=400&h=250&fit=crop',
};

/**
 * Intenta obtener imagen de una URL usando scraping básico
 */
async function fetchImageFromUrl(url) {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : require('http');
      const timeout = setTimeout(() => resolve(null), 5000);
      
      protocol.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000 
      }, (res) => {
        clearTimeout(timeout);
        let html = '';
        
        res.on('data', chunk => {
          html += chunk;
          if (html.length > 500000) res.destroy(); // Limitar descarga
        });
        
        res.on('end', () => {
          // Buscar imágenes en el HTML
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          const match = imgRegex.exec(html);
          
          if (match && match[1]) {
            const imgUrl = match[1];
            // Validar que sea URL absoluta
            if (imgUrl.startsWith('http')) {
              resolve(imgUrl);
            } else if (imgUrl.startsWith('/')) {
              resolve(new URL(imgUrl, url).href);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
        
        res.on('error', () => resolve(null));
      });
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Intenta obtener imagen del evento
 */
async function getEventImage(event) {
  // Si ya tiene imagen HTTP, mantenerla
  if (event.img && event.img.startsWith('http')) {
    return event.img;
  }

  // Si tiene srcUrl, intentar scraping
  if (event.srcUrl) {
    console.log(`  🔍 Scrapeando: ${event.title.slice(0, 40)}...`);
    const scrapedImg = await fetchImageFromUrl(event.srcUrl);
    if (scrapedImg) {
      console.log(`  ✅ Imagen encontrada`);
      return scrapedImg;
    }
  }

  // Fallback a Unsplash genérico
  const key = `${event.cat}|${event.tipo}`;
  return FALLBACK_IMAGES[key] || FALLBACK_IMAGES['default'];
}

async function main() {
  if (!fs.existsSync(EVENTS_PATH)) {
    console.error('❌ events.json no encontrado');
    process.exit(1);
  }

  let data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  console.log(`\n📸 Scrapeando imágenes de ${data.events?.length || 0} eventos...\n`);

  let updated = 0;
  let withFallback = 0;

  // Procesar eventos secuencialmente para no saturar
  for (const event of data.events || []) {
    const imgUrl = await getEventImage(event);
    
    if (imgUrl !== event.img) {
      event.img = imgUrl;
      if (!imgUrl.includes('unsplash')) {
        updated++;
      } else {
        withFallback++;
      }
    }
    
    // Delay para no sobrecargar
    await new Promise(r => setTimeout(r, 300));
  }

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`\n✨ Listo:`);
  console.log(`   Imágenes reales encontradas: ${updated}`);
  console.log(`   Usando Unsplash (fallback): ${withFallback}`);
  console.log(`   Total eventos: ${data.events?.length || 0}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
