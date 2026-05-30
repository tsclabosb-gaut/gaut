#!/usr/bin/env node

/**
 * add-restaurants.js
 * Agrega restaurantes y cafés kid-friendly a events.json
 */

const fs = require('fs');
const path = require('path');

const EVENTS_PATH = path.join(__dirname, '..', 'events.json');

// Datos de restaurantes por zona
const RESTAURANTS = [
  // PROVIDENCIA
  { name: 'Characata', zone: 'prov', type: 'cafe', instagram: 'characata.cl', desc: 'Café y comida saludable' },
  { name: 'POM Restaurante', zone: 'prov', type: 'restaurant', instagram: 'pom_restaurante', desc: 'Restaurante infantil amigable' },
  { name: 'Choco Café Providencia', zone: 'prov', type: 'cafe', instagram: 'chococafeprovidencia', desc: 'Café con chocolate artesanal' },
  { name: 'La Casa Juego', zone: 'prov', type: 'play', instagram: 'lacasajuego_', desc: 'Cowork, guardería y cafetería' },

  // MAIPÚ
  { name: 'Contigo me Divierto', zone: 'ind', type: 'play', instagram: 'contigomedivierto', desc: 'Espacio de juego para niños' },
  { name: 'Fun4Kids Maipú', zone: 'ind', type: 'play', instagram: 'fun4kids_maipu', desc: 'Centro de entretenimiento infantil' },
  { name: 'Cafetería Happy Monday', zone: 'ind', type: 'cafe', instagram: 'cafeteria_happymonday', desc: 'Café para familias' },

  // LA FLORIDA
  { name: 'Aquí Me Quedo Coffee', zone: 'ind', type: 'cafe', instagram: 'aquimequedo.coffee', desc: 'Café acogedor' },
  { name: 'Happy Good Coffee', zone: 'ind', type: 'cafe', instagram: 'happygood.coffee', desc: 'Café con ambiente familiar' },

  // LA REINA
  { name: 'Casa Tateti', zone: 'lare', type: 'play', instagram: 'casatateti', desc: 'Juegos y entretenimiento para niños' },
  { name: 'LeKe Park', zone: 'lare', type: 'play', instagram: 'lekepark', desc: 'Parque infantil cubierto' },

  // LAS CONDES
  { name: 'El Cafetín de Virgilio', zone: 'lc', type: 'cafe', instagram: 'elcafetindevirgilio', desc: 'Café familiar' },
  { name: 'KBoing', zone: 'lc', type: 'play', instagram: 'kboing.cl', desc: 'Centro de entretenimiento y diversión' },
  { name: 'B Kids Chile', zone: 'lc', type: 'play', instagram: 'bkids_chile', desc: 'Espacio infantil' },
  { name: 'Nido Café Play', zone: 'lc', type: 'play', instagram: 'nidocafe.play', desc: 'Café con zona de juegos' },
  { name: 'Wippiboo', zone: 'lc', type: 'play', instagram: 'wippiboo', desc: 'Centro de actividades infantiles' },
  { name: 'Cafetropa', zone: 'lc', type: 'cafe', instagram: 'cafetropa', desc: 'Café con ambiente tropical' },

  // ÑUÑOA
  { name: 'DeLucca Playroom', zone: 'nun', type: 'play', instagram: 'delucca.playroom', desc: 'Playroom con cafetería' },
  { name: 'Voy Contigo Café', zone: 'nun', type: 'cafe', instagram: 'voycontigocafe', desc: 'Café para familias' },
  { name: 'Livorno Kids', zone: 'nun', type: 'play', instagram: 'livornokids', desc: 'Entretenimiento infantil' },

  // VITACURA
  { name: 'Cafetería Together', zone: 'vit', type: 'cafe', instagram: 'cafeteria.together', desc: 'Café amigable con niños' },
  { name: 'Nolia', zone: 'vit', type: 'restaurant', instagram: 'nolia_cl', desc: 'Restaurante para familias' },
  { name: 'Helados Bosa', zone: 'vit', type: 'cafe', instagram: 'heladosbosa', desc: 'Heladería artesanal' },
  { name: 'Gluck Juegos y Café', zone: 'vit', type: 'play', instagram: 'gluck_juegosycafe', desc: 'Café con zona de juegos' },
  { name: 'Café LaMatta', zone: 'vit', type: 'cafe', instagram: 'cafelomatta', desc: 'Café tradicional' },
  { name: 'Espacio Cocarte', zone: 'vit', type: 'play', instagram: 'espaciococarte', desc: 'Taller y café para niños' },

  // LO BARNECHEA
  { name: 'Bambinelli Restaurante', zone: 'lob', type: 'restaurant', instagram: 'bambinollirestaurante', desc: 'Restaurante italiano infantil' },
  { name: 'KidsTopía Café', zone: 'lob', type: 'play', instagram: 'kidstopiacafe', desc: 'Café con juegos' },
  { name: 'Bee Play Coffee', zone: 'lob', type: 'cafe', instagram: 'beeplaycoffee.cl', desc: 'Café y zona de juegos' },
  { name: 'Kidix Stay and Play', zone: 'lob', type: 'play', instagram: 'kidix.stayandplay', desc: 'Centro de juego y café' },

  // QUILICURA
  { name: 'Monkey Kids', zone: 'ind', type: 'play', instagram: 'monkeykids.cl', desc: 'Centro infantil de entretenimiento' },

  // PUDAHUEL
  { name: 'Jungla Mágica CDLV', zone: 'ind', type: 'play', instagram: 'junglamagicacdlv', desc: 'Parque de diversiones cubierto' },
  { name: 'Moon Cat Fiesta', zone: 'ind', type: 'play', instagram: 'mooncat.fiesta', desc: 'Espacio de eventos y juegos infantiles' },

  // HUECHURABA
  { name: 'Espacio Cajú', zone: 'ind', type: 'play', instagram: 'espaciocaju', desc: 'Centro de actividades para niños' },

  // SAN MIGUEL
  { name: 'Café Kids', zone: 'cen', type: 'cafe', instagram: 'cafekidscl', desc: 'Café especializado en familias' },
  { name: 'My Wonderland San Miguel', zone: 'cen', type: 'play', instagram: 'mywonderland_sanmiguel', desc: 'Mundo de fantasía para niños' },

  // PEÑALOLÉN
  { name: 'Café La Casa del Sol', zone: 'ind', type: 'cafe', instagram: 'cafelacasadelsol', desc: 'Café acogedor' },
  { name: 'Espacio de Otro Mundo', zone: 'ind', type: 'play', instagram: 'espaciodeotromundo', desc: 'Espacio imaginativo infantil' },
  { name: 'Coffee Station', zone: 'ind', type: 'cafe', instagram: 'coffeestation.cl', desc: 'Café con servicio rápido' },
  { name: 'Porotines Party', zone: 'ind', type: 'play', instagram: 'porotines_party', desc: 'Fiestas y eventos infantiles' },
  { name: 'Alto Kids', zone: 'ind', type: 'play', instagram: 'alto.kids', desc: 'Centro de entretenimiento' },

  // CHICUREO / COLINA
  { name: 'MomBee Coffee', zone: 'ind', type: 'cafe', instagram: 'mombee_coffee', desc: 'Café para madres e hijos' },
  { name: 'Playbeats', zone: 'ind', type: 'play', instagram: 'playbeats_cl', desc: 'Entretenimiento musical infantil' },
  { name: 'Happy Play Chicureo', zone: 'ind', type: 'play', instagram: 'happyplay.chicureo', desc: 'Centro de juegos' },

  // LAMPA
  { name: 'Cafetería Valley Kids', zone: 'ind', type: 'cafe', instagram: 'cafeteriavalleykids', desc: 'Cafetería infantil' },
  { name: 'Casa Play', zone: 'ind', type: 'play', instagram: 'casaplay.cl', desc: 'Casa de juegos' },

  // PADRE HURTADO
  { name: 'La Casita de Bru', zone: 'ind', type: 'play', instagram: 'lacasitadebru', desc: 'Casa de juegos familiar' },

  // SAN BERNARDO
  { name: 'Crazy Mom', zone: 'ind', type: 'cafe', instagram: 'crazymom.cl', desc: 'Café para mamás' },
  { name: 'AmFer Cafetería', zone: 'ind', type: 'cafe', instagram: 'amfercafeteria', desc: 'Cafetería familiar' },

  // BUIN
  { name: 'Yupi Kids Buin', zone: 'ind', type: 'play', instagram: 'yupi_kidsbuin', desc: 'Centro de entretenimiento' },
  { name: 'Candy Park Buin', zone: 'ind', type: 'play', instagram: 'candyparkbuin', desc: 'Parque de diversiones' },
  { name: 'Café Sosta', zone: 'ind', type: 'cafe', instagram: 'cafesosta', desc: 'Café tradicional' },
  { name: 'Tres Delicias Buin', zone: 'ind', type: 'restaurant', instagram: 'tres.delicias.buin', desc: 'Restaurante familiar' },
];

const EMOJIS = {
  restaurant: '🍽️',
  cafe: '☕',
  play: '🎪'
};

const CATEGORIES = {
  restaurant: 'food',
  cafe: 'food',
  play: 'sport'
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function createRestaurantEvent(restaurant) {
  const today = new Date();
  const daysArray = [];
  // Agregar días del mes actual
  for (let i = 1; i <= 31; i++) {
    if (new Date(today.getFullYear(), today.getMonth(), i).getMonth() === today.getMonth()) {
      daysArray.push(i);
    }
  }

  return {
    id: generateId(),
    title: restaurant.name,
    cat: CATEGORIES[restaurant.type] || 'food',
    emoji: EMOJIS[restaurant.type] || '🍽️',
    desc: restaurant.desc,
    date: `Abierto diariamente`,
    dateMs: today.getTime(),
    month: today.getMonth(),
    days: daysArray,
    venue: restaurant.name,
    address: `${restaurant.name}, Santiago`,
    zone: restaurant.zone,
    mapsQ: encodeURIComponent(`${restaurant.name} Santiago`),
    price: 0,
    src: `Instagram @${restaurant.instagram}`,
    srcUrl: `https://instagram.com/${restaurant.instagram}`,
    img: '',
    tags: ['Kid friendly', 'Familia'],
    acc: 0,
    pet: 0,
    kid: 1,
    tipo: restaurant.type === 'play' ? 'fest' : 'conc'
  };
}

async function main() {
  console.log('📍 Agregando restaurantes kid-friendly...\n');

  // Leer events.json
  if (!fs.existsSync(EVENTS_PATH)) {
    console.error('❌ events.json no encontrado');
    process.exit(1);
  }

  let data = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8'));
  let events = data.events || [];

  // Crear eventos para cada restaurante
  const newEvents = RESTAURANTS.map(createRestaurantEvent);

  // Agregar eventos nuevos
  events = [...events, ...newEvents];

  // Eliminar duplicados (por nombre)
  const seen = new Map();
  events = events.filter(e => {
    if (seen.has(e.title)) return false;
    seen.set(e.title, true);
    return true;
  });

  // Guardar
  data.events = events;
  data.meta.lastUpdated = new Date().toISOString().split('T')[0];

  fs.writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2), 'utf8');

  console.log(`✨ Completado:`);
  console.log(`   Restaurantes agregados: ${newEvents.length}`);
  console.log(`   Total eventos en archivo: ${events.length}`);
  console.log(`\n💾 Archivo actualizado: events.json`);
  console.log(`\n🎯 Restaurantes por zona:`);
  
  const byZone = {};
  newEvents.forEach(e => {
    if (!byZone[e.zone]) byZone[e.zone] = [];
    byZone[e.zone].push(e.title);
  });

  Object.entries(byZone).forEach(([zone, names]) => {
    console.log(`   ${zone.toUpperCase()}: ${names.length} lugares`);
  });
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
