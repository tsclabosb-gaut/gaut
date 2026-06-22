#!/usr/bin/env node

/**
 * add-placeholder-images.js
 * 
 * Agrega imágenes placeholder a eventos basadas en categoría/tipo
 * Usa una combinación de Unsplash + fallback emoji/color
 * 
 * NO requiere API key
 * 
 * Uso: node scripts/add-placeholder-images.js
 */

const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

// URLs públicas de Unsplash (sin auth requerida)
const IMAGE_LIBRARY = {
  'culture|expo': [
    'https://images.unsplash.com/photo-1578301978162-7aae4d755744?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=250&fit=crop',
  ],
  'culture|tetr': [
    'https://images.unsplash.com/photo-1503852931313-52581002a659?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=250&fit=crop',
  ],
  'culture|charla': [
    'https://images.unsplash.com/photo-1540575467063-178f50902556?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=250&fit=crop',
  ],
  'culture|conc': [
    'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop',
  ],
  'music|conc': [
    'https://images.unsplash.com/photo-1511379938547-c1f69b13d835?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=400&h=250&fit=crop',
  ],
  'music|fest': [
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1496424897867-48df53147e43?w=400&h=250&fit=crop',
  ],
  'sport|dep': [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25ddfcbf042?w=400&h=250&fit=crop',
  ],
  'food|fest': [
    'https://images.unsplash.com/photo-1555939594-58d7cb561d1f?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561d1f?w=400&h=250&fit=crop',
  ],
  'culture|fest': [
    'https://images.unsplash.com/photo-1516989236390-4d25abb49bd1?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1517457373614-b7152f800bb1?w=400&h=250&fit=crop',
  ],
  'default': [
    'https://images.unsplash.com/photo-1517457373614-b7152f800bb1?w=400&h=250&fit=crop',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=250&fit=crop',
  ],
};

// IDs de Unsplash VERIFICADOS (HTTP 200) por categoría — evita las URLs muertas (404)
const VERIFIED = {
  food: ['1517248135467-4c7edcad34c4', '1414235077428-338989a2e8c0', '1555396273-367ea4eb4db5'],
  music: ['1459749411175-04bf5292ceea', '1493225457124-a3eb161ffa5f'],
  sport: ['1461896836934-ffe607ba8211'],
  culture: ['1561070791-2526d30994b5', '1514320291840-2e0a9bf2a9ae', '1578301978162-7aae4d755744', '1552664730-d307ca884978', '1487180144351-b8472da7d491'],
};
function getImageUrl(cat, tipo) {
  const list = VERIFIED[cat] || VERIFIED.culture;
  const seed = (String(cat) + String(tipo)).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return 'https://images.unsplash.com/photo-' + list[seed % list.length] + '?w=400&h=250&fit=crop';
}

async function main() {
  if (!fs.existsSync(EVENTS_PATH)) {
    console.error('❌ events.json no encontrado');
    process.exit(1);
  }

  let data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  console.log(`📷 Agregando imágenes a ${data.events?.length || 0} eventos...\n`);

  let updated = 0;

  for (const event of data.events || []) {
    // Mantener fotos reales (Ticketplus/CCLM); reemplazar placeholders de Unsplash
    // (muchos IDs viejos daban 404) y rellenar los que no tienen imagen
    if (event.img && event.img.startsWith('http') && !event.img.includes('images.unsplash.com')) {
      continue;
    }

    const imgUrl = getImageUrl(event.cat, event.tipo);
    event.img = imgUrl;
    updated++;

    console.log(`  ✅ ${event.title.slice(0, 40)}`);
  }

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');

  console.log(`\n✨ Listo:`);
  console.log(`   Imágenes agregadas: ${updated}`);
  console.log(`   Total eventos: ${data.events?.length || 0}`);
  console.log(`\n💡 Próximo paso:`);
  console.log(`   git add events.json`);
  console.log(`   git commit -m "feat: agregar imágenes a eventos"`);
  console.log(`   git push`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
