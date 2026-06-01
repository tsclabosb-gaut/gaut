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
      
      const req = protocol.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 2000 
      }, (res) => {
        let html = '';
        
        res.on('data', chunk => {
          html += chunk;
          if (html.length > 500000) res.destroy();
        });
        
        res.on('end', () => {
          try {
            const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (match?.[1]) {
              const imgUrl = match[1];
              if (imgUrl.startsWith('http')) return resolve(imgUrl);
              if (imgUrl.startsWith('/')) return resolve(new URL(imgUrl, url).href);
            }
            resolve(null);
          } catch {
            resolve(null);
          }
        });
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      
    } catch {
      resolve(null);
    }
  });
}

async function main() {
  try {
    const data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
    console.log(`📸 Procesando ${data.events?.length || 0} eventos...\n`);

    let updated = 0;
    
    for (const event of data.events || []) {
      try {
        if (!event.img || event.img === '') {
          let imgUrl = null;
          
          if (event.srcUrl) {
            imgUrl = await fetchImageFromUrl(event.srcUrl);
          }
          
          event.img = imgUrl || FALLBACK_IMAGES[`${event.cat}|${event.tipo}`] || FALLBACK_IMAGES['default'];
          updated++;
        }
      } catch (e) {
        event.img = FALLBACK_IMAGES[`${event.cat}|${event.tipo}`] || FALLBACK_IMAGES['default'];
      }
      
      await new Promise(r => setTimeout(r, 600));
    }

    fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`\n✨ ${updated} eventos con imágenes\n`);
    
  } catch (err) {
    console.log(`⚠️  Error: ${err.message}`);
  }
}

main();
