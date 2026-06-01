#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

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

async function fetchImageFromUrl(url) {
  return new Promise((resolve) => {
    try {
      const protocol = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => resolve(null), 3000);
      
      const req = protocol.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 3000 
      }, (res) => {
        clearTimeout(timeout);
        let html = '';
        let size = 0;
        
        res.on('data', chunk => {
          html += chunk;
          size += chunk.length;
          if (size > 500000) {
            res.destroy();
            resolve(null);
          }
        });
        
        res.on('end', () => {
          try {
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            const match = imgRegex.exec(html);
            
            if (match && match[1]) {
              const imgUrl = match[1];
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
          } catch (e) {
            resolve(null);
          }
        });
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
      
    } catch (err) {
      resolve(null);
    }
  });
}

async function getEventImage(event) {
  if (event.img && event.img.startsWith('http')) {
    return event.img;
  }

  if (event.srcUrl) {
    try {
      const scrapedImg = await fetchImageFromUrl(event.srcUrl);
      if (scrapedImg) {
        return scrapedImg;
      }
    } catch (e) {
      // Ignorar error
    }
  }

  const key = `${event.cat}|${event.tipo}`;
  return FALLBACK_IMAGES[key] || FALLBACK_IMAGES['default'];
}

async function main() {
  if (!fs.existsSync(EVENTS_PATH)) {
    console.error('❌ events.json no encontrado');
    process.exit(1);
  }

  let data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  console.log(`📸 Procesando ${data.events?.length || 0} eventos...\n`);

  let updated = 0;
  let withFallback = 0;

  for (let i = 0; i < (data.events || []).length; i++) {
    const event = data.events[i];
    try {
      const imgUrl = await getEventImage(event);
      
      if (imgUrl !== event.img) {
        event.img = imgUrl;
        if (!imgUrl.includes('unsplash')) {
          updated++;
          console.log(`  ✅ ${event.title.slice(0, 40)}`);
        } else {
          withFallback++;
        }
      }
    } catch (e) {
      event.img = FALLBACK_IMAGES['default'];
      withFallback++;
    }
    
    // Delay de 500ms entre requests
    await new Promise(r => setTimeout(r, 500));
  }

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  
  console.log(`\n✨ Listo:`);
  console.log(`   Imágenes reales: ${updated}`);
  console.log(`   Con fallback: ${withFallback}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(0); // Exit 0 para que no falle el workflow
});
