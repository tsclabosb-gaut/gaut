#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const restaurants = [
    { name: "Characata", instagram: "characata.cl", zone: "prov" },
    { name: "POM Restaurante", instagram: "pom_restaurante", zone: "prov" },
    { name: "Choco Café Providencia", instagram: "chococafeprovidencia", zone: "prov" },
    { name: "La Casa Juego", instagram: "lacasajuego_", zone: "prov" },
    { name: "Contigo me Divierto", instagram: "contigomedivierto", zone: "cen" },
    { name: "Fun4Kids Maipú", instagram: "fun4kids_maipu", zone: "cen" },
    { name: "Cafetería Happy Monday", instagram: "cafeteria_happymonday", zone: "cen" },
    { name: "Aquí Me Quedo Coffee", instagram: "aquimequedo.coffee", zone: "cen" },
    { name: "Happy Good Coffee", instagram: "happygood.coffee", zone: "cen" },
    { name: "Casa Tateti", instagram: "casatateti", zone: "lare" },
    { name: "LeKe Park", instagram: "lekepark", zone: "lare" },
    { name: "El Cafetín de Virgilio", instagram: "elcafetindevirgilio", zone: "lc" },
    { name: "KBoing", instagram: "kboing.cl", zone: "lc" },
    { name: "B Kids Chile", instagram: "bkids_chile", zone: "lc" },
    { name: "Nido Café Play", instagram: "nidocafe.play", zone: "lc" },
    { name: "Wippiboo", instagram: "wippiboo", zone: "lc" },
    { name: "Cafetropa", instagram: "cafetropa", zone: "lc" },
    { name: "DeLucca Playroom", instagram: "delucca.playroom", zone: "nun" },
    { name: "Voy Contigo Café", instagram: "voycontigocafe", zone: "nun" },
    { name: "Livorno Kids", instagram: "livornokids", zone: "nun" },
    { name: "Cafetería Together", instagram: "cafeteria.together", zone: "vit" },
    { name: "Nolia", instagram: "nolia_cl", zone: "vit" },
    { name: "Helados Bosa", instagram: "heladosbosa", zone: "vit" },
    { name: "Gluck Juegos y Café", instagram: "gluck_juegosycafe", zone: "vit" },
    { name: "Café LaMatta", instagram: "cafelomatta", zone: "vit" },
    { name: "Espacio Cocarte", instagram: "espaciococarte", zone: "vit" },
    { name: "Bambinelli Restaurante", instagram: "bambinollirestaurante", zone: "cen" },
    { name: "KidsTopía Café", instagram: "kidstopiacafe", zone: "cen" },
    { name: "Bee Play Coffee", instagram: "beeplaycoffee.cl", zone: "cen" },
    { name: "Kidix Stay and Play", instagram: "kidix.stayandplay", zone: "cen" },
    { name: "Monkey Kids", instagram: "monkeykids.cl", zone: "cen" },
    { name: "Jungla Mágica CDLV", instagram: "junglamagicacdlv", zone: "cen" },
    { name: "Moon Cat Fiesta", instagram: "mooncat.fiesta", zone: "cen" },
    { name: "Espacio Cajú", instagram: "espaciocaju", zone: "cen" },
    { name: "Café Kids", instagram: "cafekidscl", zone: "cen" },
    { name: "My Wonderland San Miguel", instagram: "mywonderland_sanmiguel", zone: "cen" },
    { name: "Café La Casa del Sol", instagram: "cafelacasadelsol", zone: "cen" },
    { name: "Espacio de Otro Mundo", instagram: "espaciodeotromundo", zone: "cen" },
    { name: "Coffee Station", instagram: "coffeestation.cl", zone: "cen" },
    { name: "Porotines Party", instagram: "porotines_party", zone: "cen" },
    { name: "Alto Kids", instagram: "alto.kids", zone: "cen" },
    { name: "MomBee Coffee", instagram: "mombee_coffee", zone: "cen" },
    { name: "Playbeats", instagram: "playbeats_cl", zone: "cen" },
    { name: "Happy Play Chicureo", instagram: "happyplay.chicureo", zone: "cen" },
    { name: "Cafetería Valley Kids", instagram: "cafeteriavalleykids", zone: "cen" },
    { name: "Casa Play", instagram: "casaplay.cl", zone: "cen" },
    { name: "La Casita de Bru", instagram: "lacasitadebru", zone: "cen" },
    { name: "Crazy Mom", instagram: "crazymom.cl", zone: "cen" },
    { name: "AmFer Cafetería", instagram: "amfercafeteria", zone: "cen" },
    { name: "Yupi Kids Buin", instagram: "yupi_kidsbuin", zone: "cen" },
    { name: "Candy Park Buin", instagram: "candyparkbuin", zone: "cen" },
    { name: "Café Sosta", instagram: "cafesosta", zone: "cen" },
    { name: "Tres Delicias Buin", instagram: "tres.delicias.buin", zone: "cen" },
];

function generateId(existingEvents) {
    return Math.max(...existingEvents.map(e => e.id || 0), 0) + 1;
}

function createRestaurantEvent(restaurant, id) {
    const today = new Date();
    const dateMs = today.getTime();
    
    return {
        "title": restaurant.name,
        "cat": "food",
        "emoji": "🍴",
        "desc": `Café/Restaurante kid-friendly. Instagram: @${restaurant.instagram}`,
        "date": "Abierto",
        "dateMs": dateMs,
        "month": today.getMonth(),
        "days": [],
        "venue": restaurant.name,
        "address": "Santiago",
        "zone": restaurant.zone,
        "mapsQ": restaurant.name + "+Santiago",
        "price": 0,
        "src": "Descubre Tu Ciudad - Restaurantes",
        "srcUrl": `https://www.instagram.com/${restaurant.instagram}/`,
        "img": "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&h=300&fit=crop",
        "tags": ["Kid friendly", "Familia", "Café", "Comida"],
        "acc": false,
        "pet": false,
        "kid": true,
        "tipo": "food",
        "id": id
    };
}

try {
    const filePath = path.join(__dirname, '..', 'events.json');
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ No se encontró: ${filePath}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data.events || !Array.isArray(data.events)) {
        console.error('❌ events.json no tiene estructura válida');
        process.exit(1);
    }

    let startId = generateId(data.events);
    let added = 0;

    restaurants.forEach((restaurant, index) => {
        const newEvent = createRestaurantEvent(restaurant, startId + index);
        
        if (!data.events.find(e => e.title === newEvent.title)) {
            data.events.push(newEvent);
            added++;
        }
    });

    data.meta.totalEvents = data.events.length;
    data.meta.lastUpdated = new Date().toISOString().split('T')[0];

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    console.log(`\n✅ Restaurantes agregados exitosamente`);
    console.log(`📍 Nuevos eventos: ${added}`);
    console.log(`🍴 Total restaurantes: ${added}`);
    console.log(`📊 Total eventos: ${data.events.length}\n`);

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
