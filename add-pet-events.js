// Run with: node add-pet-events.js
// Adds pet-friendly events to events.json

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'events.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const events = data.events || [];

// Find max id
let maxId = 0;
for (const ev of events) {
    if (typeof ev.id === 'number' && ev.id > maxId) maxId = ev.id;
}

const newEvents = [
    {
        title: "Dog Race Santiago 2026",
        cat: "sport",
        emoji: "🐕",
        desc: "Corrida donde dueño y perro participan en equipo. Distancias de 2K (perros chicos) y 3K (perros medianos/grandes). Incluye feria canina, veterinario, peluquería y concursos.",
        date: "Dom 11 de octubre 2026",
        dateMs: 1760140800000,
        month: 9,
        days: [11],
        venue: "Parque Metropolitano",
        address: "Acceso Pedro de Valdivia Norte, Providencia",
        zone: "prov",
        mapsQ: "Parque+Metropolitano+Acceso+Pedro+de+Valdivia+Santiago",
        price: 15000,
        src: "Dog Race Chile",
        srcUrl: "https://www.dograce.cl",
        web: "https://www.dograce.cl",
        instagram: "https://www.instagram.com/dogracechile",
        tickets: "https://www.dograce.cl/inscripciones.html",
        img: "",
        tags: ["Carrera", "Canina", "Feria canina"],
        acc: false, pet: true, kid: true, tipo: "dep",
        id: maxId + 1
    },
    {
        title: "Exposición Canina KCC — Junio 2026",
        cat: "culture",
        emoji: "🐕",
        desc: "2 Exposiciones Generales válidas para ranking del Kennel Club de Chile. Jueces internacionales evalúan todas las razas reconocidas.",
        date: "Sáb 13 y Dom 14 de junio 2026",
        dateMs: 1749772800000,
        month: 5,
        days: [13, 14],
        venue: "Club Hípico de Santiago",
        address: "Blanco Encalada 2540, Santiago",
        zone: "cen",
        mapsQ: "Club+Hipico+Santiago",
        price: null,
        src: "Kennel Club de Chile",
        srcUrl: "https://kennelclub.cl",
        img: "",
        tags: ["Perros", "Exposición canina", "Ranking KCC"],
        acc: false, pet: true, kid: true, tipo: "fest",
        id: maxId + 2
    },
    {
        title: "Competencia de Grooming KCC",
        cat: "culture",
        emoji: "✂️",
        desc: "Competencia de peluquería canina con participación de groomer nacionales. Jueces nacionales e internacionales.",
        date: "Lun 15 y Mar 16 de junio 2026",
        dateMs: 1749945600000,
        month: 5,
        days: [15, 16],
        venue: "Club Hípico de Santiago",
        address: "Blanco Encalada 2540, Santiago",
        zone: "cen",
        mapsQ: "Club+Hipico+Santiago",
        price: null,
        src: "Kennel Club de Chile",
        srcUrl: "https://kennelclub.cl",
        img: "",
        tags: ["Grooming", "Peluquería canina", "KCC"],
        acc: false, pet: true, kid: false, tipo: "fest",
        id: maxId + 3
    },
    {
        title: "Exposición Canina KCC — Julio 2026",
        cat: "culture",
        emoji: "🐕",
        desc: "Exposición Consejo de Jueces del Kennel Club de Chile con Festival de Especializadas. Válida para ranking nacional.",
        date: "Sáb 11 y Dom 12 de julio 2026",
        dateMs: 1752192000000,
        month: 6,
        days: [11, 12],
        venue: "Club Hípico de Santiago",
        address: "Blanco Encalada 2540, Santiago",
        zone: "cen",
        mapsQ: "Club+Hipico+Santiago",
        price: null,
        src: "Kennel Club de Chile",
        srcUrl: "https://kennelclub.cl",
        img: "",
        tags: ["Perros", "Exposición canina", "Especializadas"],
        acc: false, pet: true, kid: true, tipo: "fest",
        id: maxId + 4
    },
    {
        title: "Circuito Internacional Copa de Los Andes",
        cat: "sport",
        emoji: "🏆",
        desc: "El evento canino más importante del año en Chile. 4 exposiciones generales + especializadas. Jueces de Australia, Croacia, Azerbaijan, Puerto Rico, Chile e Irlanda. Válido para ranking internacional FCI.",
        date: "Sáb 10, Dom 11 y Lun 12 de octubre 2026",
        dateMs: 1760054400000,
        month: 9,
        days: [10, 11, 12],
        venue: "Club Hípico de Santiago",
        address: "Blanco Encalada 2540, Santiago",
        zone: "cen",
        mapsQ: "Club+Hipico+Santiago",
        price: null,
        src: "Kennel Club de Chile",
        srcUrl: "https://kennelclub.cl",
        img: "",
        tags: ["Perros", "Internacional", "FCI", "Copa Los Andes"],
        acc: false, pet: true, kid: true, tipo: "fest",
        id: maxId + 5
    }
];

// Check for duplicates by title
const existingTitles = new Set(events.map(e => e.title.toLowerCase()));
let added = 0;
for (const ev of newEvents) {
    if (!existingTitles.has(ev.title.toLowerCase())) {
        events.push(ev);
        existingTitles.add(ev.title.toLowerCase());
        added++;
        console.log(`  + Added: ${ev.title}`);
    } else {
        console.log(`  ~ Skip (exists): ${ev.title}`);
    }
}

data.events = events;
data.meta = {
    ...data.meta,
    lastUpdated: new Date().toISOString().split('T')[0],
    totalEvents: events.length
};

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log(`\nDone. Added ${added} events. Total: ${events.length}`);

// ── CIAO FIORENTINA ──
const ciaoFiorentina = {
    title: "Ciao Fiorentina",
    cat: "food",
    emoji: "☕",
    tipo: "rest",
    desc: "Cafetería de especialidad con carta de autor en una casona de 1942. Laboratorio gastronómico con café de especialidad, carta italiana-fusión y terraza. Pet friendly en toda la casa, área cowork en segundo piso, opciones sin gluten y sin azúcar.",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Sáb 9:00–21:00 | Dom 10:00–20:00",
    venue: "Ciao Fiorentina",
    address: "Avenida Pocuro 3015, Providencia",
    zone: "prov",
    mapsQ: "Ciao+Fiorentina+Pocuro+3015+Providencia+Santiago",
    price: null,
    priceRange: "$7.990–$15.000 aprox",
    web: "https://ciaofiorentina.cl",
    instagram: "https://www.instagram.com/ciaofiorentina",
    img: "https://ciaofiorentina.cl/wp-content/uploads/2026/02/WhatsApp-Image-2026-02-05-at-12.48.35-5.jpeg",
    tags: ["Café de especialidad", "Carta de autor", "Terraza", "Cowork", "Sin gluten"],
    acc: false,
    pet: true,
    kid: true,
    kidInfo: "Área de juegos sin costo adicional (solo consumo de la mesa). Opciones sin azúcar y sin gluten para niños.",
    petInfo: "Pet friendly en toda la casa, incluyendo terraza interior.",
    hours: {
        Mon: null,
        Tue: "09:00–21:00",
        Wed: "09:00–21:00",
        Thu: "09:00–21:00",
        Fri: "09:00–21:00",
        Sat: "09:00–21:00",
        Sun: "10:00–20:00"
    },
    id: maxId + 10
};

if (!existingTitles.has(ciaoFiorentina.title.toLowerCase())) {
    events.push(ciaoFiorentina);
    existingTitles.add(ciaoFiorentina.title.toLowerCase());
    added++;
    console.log(`  + Added: ${ciaoFiorentina.title}`);
}
