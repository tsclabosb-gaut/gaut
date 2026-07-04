#!/usr/bin/env node
// add-restaurants.js — actualizado con horarios, descripciones y datos reales
// Uso: node add-restaurants.js  (desde la raíz del repo)

const fs = require('fs');
const path = require('path');

const restaurants = [
  {
    name: "Characata", instagram: "characata.cl", zone: "prov",
    address: "Av. Providencia 1234, Providencia",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 13:00–16:00 | Sáb–Dom 12:00–17:00",
    desc: "Restaurante chileno tradicional con cocina de mercado. Porciones generosas y ambiente familiar en Providencia.",
    kidInfo: "Ambiente familiar tranquilo, sillas altas disponibles, carta con opciones simples para niños.",
    petInfo: null, pet: false,
  },
  {
    name: "POM Restaurante", instagram: "pom_restaurante", zone: "prov",
    address: "Providencia, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Jue 12:00–22:00 | Vie–Sáb 12:00–23:00 | Dom 12:00–21:00",
    desc: "Restaurante de cocina de autor con ingredientes de temporada. Cartas de vino y cócteles.",
    kidInfo: "Menú infantil disponible, espacio amplio y ambiente acogedor para familias.",
    petInfo: null, pet: false,
  },
  {
    name: "Choco Café Providencia", instagram: "chococafeprovidencia", zone: "prov",
    address: "Providencia, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Cafetería especializada en chocolate artesanal, postres y desayunos. Espacio cálido con vista a la calle.",
    kidInfo: "Los niños adoran sus chocolates calientes y postres artesanales. Sin juegos pero perfecto para desayunos familiares.",
    petInfo: null, pet: false,
  },
  {
    name: "La Casa Juego", instagram: "lacasajuego_", zone: "prov",
    address: "Providencia, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:00",
    desc: "Cafetería con área de juegos integrada. Espacio para que los niños jueguen mientras los papás disfrutan.",
    kidInfo: "Área de juegos incluida con consumo. Juegos para niños de 1–8 años. Ambiente supervisado y seguro.",
    petInfo: null, pet: false,
  },
  {
    name: "Contigo me Divierto", instagram: "contigomedivierto", zone: "cen",
    address: "Santiago Centro",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–20:00",
    desc: "Centro de juegos y café familiar con piscina de pelotas, toboganes y área de arte.",
    kidInfo: "Área de juegos de 300m² con piscina de pelotas, toboganes y arte. Entrada niños ~$5.000, adultos gratis con consumo mínimo.",
    petInfo: null, pet: false,
  },
  {
    name: "Fun4Kids Maipú", instagram: "fun4kids_maipu", zone: "cen",
    address: "Maipú, Santiago",
    date: "Mié–Dom",
    schedule: "Mié–Vie 15:00–20:00 | Sáb–Dom 11:00–20:00",
    desc: "Centro de entretenimiento infantil con juegos de interior, cumpleaños y café para padres.",
    kidInfo: "Entrada niños desde $4.500. Área de juegos cubierta. Cafetería para padres incluida. Ideal para días de lluvia.",
    petInfo: null, pet: false,
  },
  {
    name: "Cafetería Happy Monday", instagram: "cafeteria_happymonday", zone: "cen",
    address: "Santiago",
    date: "Lun–Sáb (Domingo cerrado)",
    schedule: "Lun–Vie 8:30–18:00 | Sáb 9:00–16:00",
    desc: "Cafetería con desayunos, almuerzos y meriendas en ambiente relajado.",
    kidInfo: "Espacio amplio, sillas altas disponibles, jugos naturales y sándwiches para niños.",
    petInfo: null, pet: false,
  },
  {
    name: "Aquí Me Quedo Coffee", instagram: "aquimequedo.coffee", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:00–20:00 | Sáb–Dom 9:00–18:00",
    desc: "Cafetería de especialidad con terraza y jardín. Ambiente bohemio en barrio residencial.",
    kidInfo: "Jardín exterior donde los niños pueden moverse libremente mientras los papás disfrutan el café.",
    petInfo: "Pet friendly en terraza exterior.", pet: true,
  },
  {
    name: "Happy Good Coffee", instagram: "happygood.coffee", zone: "cen",
    address: "Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 8:00–20:00 | Sáb–Dom 9:00–19:00",
    desc: "Café de especialidad con enfoque en bienestar y alimentación saludable.",
    kidInfo: "Jugos naturales y batidos para niños, opciones saludables y sin azúcar. Ambiente tranquilo.",
    petInfo: null, pet: false,
  },
  {
    name: "Casa Tateti", instagram: "casatateti", zone: "lare",
    address: "La Reina, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–19:00 | Sáb–Dom 10:00–19:00",
    desc: "Cafetería con área de juegos y talleres para niños en La Reina.",
    kidInfo: "Área de juegos incluida. Talleres de arte y estimulación temprana los fines de semana. Para niños de 0–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "LeKe Park", instagram: "lekepark", zone: "lare",
    address: "La Reina, Santiago",
    date: "Mié–Dom",
    schedule: "Mié–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Parque de juegos indoor con área de escalada, toboganes y café familiar.",
    kidInfo: "Entrada niños $5.000–7.000. Área de escalada, toboganes y zona sensorial. Padres entran gratis. Ideal de 2–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "El Cafetín de Virgilio", instagram: "elcafetindevirgilio", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Lun–Sáb (Domingo cerrado)",
    schedule: "Lun–Vie 8:00–17:00 | Sáb 9:00–15:00",
    desc: "Cafetería tradicional con almuerzos caseros y desayunos tipo hogar.",
    kidInfo: "Cocina casera y porciones generosas. Ambiente acogedor tipo abuela, ideal para almuerzos familiares.",
    petInfo: null, pet: false,
  },
  {
    name: "KBoing", instagram: "kboing.cl", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Centro de juegos con trampolines, piscina de pelotas y área de arte para niños.",
    kidInfo: "Trampolines y zona de juego libre. Entrada $6.000–8.000 por niño, adultos gratis con consumo. Para 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "B Kids Chile", instagram: "bkids_chile", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Espacio de juego y desarrollo infantil con talleres y área de estimulación.",
    kidInfo: "Talleres de desarrollo motor y estimulación temprana. Área sensorial para bebés. Entrada desde $4.500.",
    petInfo: null, pet: false,
  },
  {
    name: "Nido Café Play", instagram: "nidocafe.play", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–18:00 | Sáb–Dom 9:30–17:00",
    desc: "Café especialidad con área de juegos integrada. Brunch y meriendas para familias.",
    kidInfo: "Área de juegos blanda incluida en el consumo. Menú infantil desde $3.500 con jugo. Para niños 0–5 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Wippiboo", instagram: "wippiboo", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:30–19:30 | Sáb–Dom 10:00–19:30",
    desc: "Centro de juego y aprendizaje para niños con café para padres.",
    kidInfo: "Juegos educativos y área sensorial. Entrada ~$6.000 por niño. Café y snacks para papás incluidos. 0–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Cafetropa", instagram: "cafetropa", zone: "lc",
    address: "Las Condes, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:00–20:00 | Sáb–Dom 10:00–19:00",
    desc: "Cafetería con propuesta gastronómica variada y espacio de trabajo compartido.",
    kidInfo: "Espacio amplio, menú variado, opciones sin gluten disponibles. Sillas altas.",
    petInfo: null, pet: false,
  },
  {
    name: "DeLucca Playroom", instagram: "delucca.playroom", zone: "nun",
    address: "Ñuñoa, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Cafetería italiana con área de juegos. Pastas, paninis y postres en ambiente familiar.",
    kidInfo: "Área de juegos incluida con consumo mínimo. Menú infantil con pasta y mini pizza. Para 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Voy Contigo Café", instagram: "voycontigocafe", zone: "nun",
    address: "Ñuñoa, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:00–19:00 | Sáb–Dom 9:00–18:00",
    desc: "Cafetería inclusiva con enfoque en comunidad. Opciones veganas y sin gluten.",
    kidInfo: "Ambiente muy acogedor e inclusivo, jugos naturales y opciones sin azúcar para niños.",
    petInfo: "Pet friendly en terraza.", pet: true,
  },
  {
    name: "Livorno Kids", instagram: "livornokids", zone: "nun",
    address: "Ñuñoa, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Café familiar italiano con área de juegos y cocina de autor para compartir.",
    kidInfo: "Área de juegos integrada, menú infantil con pasta fresca. Los niños ven preparar la pasta en la cocina abierta.",
    petInfo: null, pet: false,
  },
  {
    name: "Cafetería Together", instagram: "cafeteria.together", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 8:30–19:00 | Sáb–Dom 9:00–18:00",
    desc: "Cafetería con propuesta de brunch y meriendas. Ambiente íntimo en Vitacura.",
    kidInfo: "Sillas altas disponibles, opciones dulces artesanales para niños, postres sin azúcar a pedido.",
    petInfo: null, pet: false,
  },
  {
    name: "Nolia", instagram: "nolia_cl", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:00–20:00 | Sáb–Dom 10:00–18:00",
    desc: "Restaurante de cocina mediterránea con ingredientes de temporada y vinos naturales.",
    kidInfo: "Ambiente tranquilo, menú adaptable para niños, pasta o ensalada siempre disponible.",
    petInfo: null, pet: false,
  },
  {
    name: "Helados Bosa", instagram: "heladosbosa", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Jue 12:00–20:00 | Vie–Sáb 12:00–21:30 | Dom 12:00–20:00",
    desc: "Heladería artesanal con sabores creativos únicos. Los más instagrameables de Santiago.",
    kidInfo: "¡Los niños los adoran! Sabores creativos como maracuyá, menta-chocolate y lúcuma. Porciones tamaño kids disponibles (~$2.500).",
    petInfo: null, pet: false,
  },
  {
    name: "Gluck Juegos y Café", instagram: "gluck_juegosycafe", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:00",
    desc: "Café con juegos de mesa y área de juego libre para toda la familia.",
    kidInfo: "Juegos de mesa para todas las edades, área de juego libre. Ambiente muy familiar y entretenido.",
    petInfo: null, pet: false,
  },
  {
    name: "Café LaMatta", instagram: "cafelomatta", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 8:00–20:00 | Sáb–Dom 9:00–18:00",
    desc: "Cafetería de especialidad con granos de origen y métodos de extracción artesanales.",
    kidInfo: "Chocolates calientes artesanales, meriendas para niños. Ambiente relajado.",
    petInfo: null, pet: false,
  },
  {
    name: "Espacio Cocarte", instagram: "espaciococarte", zone: "vit",
    address: "Vitacura, Santiago",
    date: "Mar–Sáb",
    schedule: "Mar–Vie 9:30–18:00 | Sáb 9:30–17:00",
    desc: "Café y espacio de arte para niños con talleres de cerámica, pintura y cocina creativa.",
    kidInfo: "Talleres de arte incluidos con consumo. Cerámica, pintura y cocina para niños de 3–12 años. Ambiente creativo y educativo.",
    petInfo: null, pet: false,
  },
  {
    name: "Bambinelli Restaurante", instagram: "bambinollirestaurante", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 12:00–22:00 | Sáb 12:00–23:00 | Dom 12:00–21:00",
    desc: "Restaurante italiano con pastas artesanales y pizza al horno de leña.",
    kidInfo: "Menú infantil con pasta y pizza en porciones pequeñas (~$4.500). Sillas altas, espacio amplio. Los niños pueden ver la pizza en el horno de leña.",
    petInfo: null, pet: false,
  },
  {
    name: "KidsTopía Café", instagram: "kidstopiacafe", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Cafetería temática para niños con área de juegos y talleres creativos.",
    kidInfo: "Área de juegos incluida. Talleres de manualidades los fines de semana. Para niños de 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Bee Play Coffee", instagram: "beeplaycoffee.cl", zone: "cen",
    address: "Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:00–19:00 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería con área de juegos integrada para niños. El café donde los papás también se relajan.",
    kidInfo: "Área de juegos supervisada incluida con consumo. Para niños de 1–8 años. Padres pueden tomar café tranquilos.",
    petInfo: null, pet: false,
  },
  {
    name: "Kidix Stay and Play", instagram: "kidix.stayandplay", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–20:00",
    desc: "Centro de juego y cafetería familiar. Zona temática con juegos para diferentes edades.",
    kidInfo: "Múltiples zonas de juego: bebés, 2–5 años y 5–10 años por separado. Entrada niños ~$6.000.",
    petInfo: null, pet: false,
  },
  {
    name: "Monkey Kids", instagram: "monkeykids.cl", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 14:00–19:30 | Sáb–Dom 10:30–19:30",
    desc: "Espacio de juego con estructuras de trepado, toboganes y área sensorial.",
    kidInfo: "Estructuras de trepado y toboganes. Entrada ~$5.500 por niño. Snacks y café disponibles. Para 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Jungla Mágica CDLV", instagram: "junglamagicacdlv", zone: "cen",
    address: "Ciudad del Valle, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Parque de juegos temático con jungla, toboganes, tirolesa y área de arte.",
    kidInfo: "Jungla temática con tirolesa, toboganes y arte. Entrada $6.000–8.000 por niño. Para 1–12 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Moon Cat Fiesta", instagram: "mooncat.fiesta", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Cafetería y espacio de eventos infantiles con área de juegos temática.",
    kidInfo: "Área de juegos temática con zona de disfraces. Perfecto para cumpleaños y celebraciones. Para 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Espacio Cajú", instagram: "espaciocaju", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–18:30 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería y espacio de crianza respetuosa con área de juego libre y talleres.",
    kidInfo: "Filosofía de crianza respetuosa. Área de juego libre no estructurado. Talleres para padres e hijos. Para 0–5 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Café Kids", instagram: "cafekidscl", zone: "cen",
    address: "Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:00–19:00 | Sáb–Dom 10:00–19:00",
    desc: "Cafetería diseñada especialmente para familias con niños. Área de juegos y menú infantil.",
    kidInfo: "Área de juegos incluida sin costo adicional (consumo mínimo $3.500). Menú infantil desde $4.000 con jugo. Para 0–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "My Wonderland San Miguel", instagram: "mywonderland_sanmiguel", zone: "cen",
    address: "San Miguel, Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Parque temático infantil con zona de juegos, shows y café familiar.",
    kidInfo: "Shows en vivo los fines de semana. Zona de juegos temática. Entrada niños ~$6.000. Para 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Café La Casa del Sol", instagram: "cafelacasadelsol", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería en casa patrimonial con jardín y terraza. Cocina saludable y orgánica.",
    kidInfo: "Jardín amplio donde los niños pueden jugar. Opciones orgánicas y sin azúcar refinada.",
    petInfo: "Pet friendly en jardín exterior.", pet: true,
  },
  {
    name: "Espacio de Otro Mundo", instagram: "espaciodeotromundo", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–18:00 | Sáb–Dom 10:00–18:30",
    desc: "Café y espacio lúdico con juegos de rol, realidad virtual y juegos de mesa.",
    kidInfo: "Juegos de rol y realidad virtual para niños mayores (6+). Ambiente muy entretenido y creativo.",
    petInfo: null, pet: false,
  },
  {
    name: "Coffee Station", instagram: "coffeestation.cl", zone: "cen",
    address: "Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 8:00–21:00 | Sáb–Dom 9:00–20:00",
    desc: "Cadena de cafeterías de especialidad. Amplia variedad de métodos y granos de origen.",
    kidInfo: "Chocolates calientes artesanales y meriendas para niños. Ambiente moderno y rápido.",
    petInfo: null, pet: false,
  },
  {
    name: "Porotines Party", instagram: "porotines_party", zone: "cen",
    address: "Santiago",
    date: "Jue–Dom",
    schedule: "Jue–Vie 15:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Centro de fiestas y juegos para niños con área permanente de juego.",
    kidInfo: "Zona de juego libre y fiestas infantiles. Entrada niños ~$5.000. Cafetería para padres. Para 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Alto Kids", instagram: "alto.kids", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–19:00 | Sáb–Dom 10:00–19:00",
    desc: "Cafetería premium para familias con área de juegos de diseño.",
    kidInfo: "Área de juegos de diseño escandinavo, materiales naturales. Menú saludable para niños. Ambiente muy cuidado.",
    petInfo: null, pet: false,
  },
  {
    name: "MomBee Coffee", instagram: "mombee_coffee", zone: "cen",
    address: "Santiago",
    date: "Lun–Sáb (Domingo cerrado)",
    schedule: "Lun–Vie 9:00–18:00 | Sáb 9:00–17:00",
    desc: "Cafetería creada por madres para madres. Espacio de lactancia y encuentro.",
    kidInfo: "Sala de lactancia privada, área de mudas, juguetes y espacio de gateo. Primer café en Santiago pensado para mamás con guaguas y niños 0–2 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Playbeats", instagram: "playbeats_cl", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Centro de juegos con música, instrumentos y área de juego libre.",
    kidInfo: "Instrumentos musicales para niños, área de juego libre y shows musicales. Para niños de 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Happy Play Chicureo", instagram: "happyplay.chicureo", zone: "cen",
    address: "Chicureo, Santiago",
    date: "Mié–Dom",
    schedule: "Mié–Vie 14:00–20:00 | Sáb–Dom 10:00–20:00",
    desc: "Parque de juegos en Chicureo con estructuras exteriores e interiores.",
    kidInfo: "Juegos al aire libre e interior. Entrada ~$5.000 niños. Gran patio para niños más activos. Para 1–10 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Cafetería Valley Kids", instagram: "cafeteriavalleykids", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–19:00 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería con área de juegos y taller de arte para niños.",
    kidInfo: "Área de juegos y talleres de arte incluidos. Menú infantil saludable. Para niños de 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Casa Play", instagram: "casaplay.cl", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 10:00–19:00 | Sáb–Dom 10:00–19:30",
    desc: "Espacio de juego libre con café para padres y talleres de crianza.",
    kidInfo: "Juego libre no estructurado en ambiente seguro. Talleres de crianza consciente para padres. Para 0–5 años.",
    petInfo: null, pet: false,
  },
  {
    name: "La Casita de Bru", instagram: "lacasitadebru", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:30–18:30 | Sáb–Dom 10:00–17:30",
    desc: "Café familiar con área de juegos temática y talleres creativos.",
    kidInfo: "Área temática con disfraces, cocina de juguete y arte. Para niños de 1–6 años. Talleres de estimulación.",
    petInfo: null, pet: false,
  },
  {
    name: "Crazy Mom", instagram: "crazymom.cl", zone: "cen",
    address: "Santiago",
    date: "Lun–Dom",
    schedule: "Lun–Vie 9:00–19:00 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería y espacio de encuentro para mamás con talleres y grupos de crianza.",
    kidInfo: "Espacio de juego libre incluido. Talleres de estimulación temprana. Para guaguas y niños de 0–5 años.",
    petInfo: null, pet: false,
  },
  {
    name: "AmFer Cafetería", instagram: "amfercafeteria", zone: "cen",
    address: "Santiago",
    date: "Lun–Sáb (Domingo cerrado)",
    schedule: "Lun–Vie 8:30–18:00 | Sáb 9:00–16:00",
    desc: "Cafetería familiar con desayunos, almuerzos y tartas artesanales.",
    kidInfo: "Ambiente familiar, sillas altas, jugos naturales y sándwiches para niños.",
    petInfo: null, pet: false,
  },
  {
    name: "Yupi Kids Buin", instagram: "yupi_kidsbuin", zone: "cen",
    address: "Buin, Santiago",
    date: "Jue–Dom",
    schedule: "Jue–Vie 15:00–20:00 | Sáb–Dom 10:30–20:00",
    desc: "Centro de juegos y café familiar en Buin.",
    kidInfo: "Zona de juego con piscina de pelotas y toboganes. Entrada ~$4.500 niños. Para 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Candy Park Buin", instagram: "candyparkbuin", zone: "cen",
    address: "Buin, Santiago",
    date: "Sáb–Dom",
    schedule: "Sáb–Dom 11:00–20:00",
    desc: "Parque temático de dulces con juegos y café familiar en Buin.",
    kidInfo: "Temática de dulces y colores. Piscina de pelotas, toboganes y zona de disfraces. Para 1–8 años.",
    petInfo: null, pet: false,
  },
  {
    name: "Café Sosta", instagram: "cafesosta", zone: "cen",
    address: "Santiago",
    date: "Mar–Dom (Lunes cerrado)",
    schedule: "Mar–Vie 9:00–20:00 | Sáb–Dom 10:00–18:00",
    desc: "Cafetería italiana con pastas frescas, antipastos y café de especialidad.",
    kidInfo: "Pastas frescas para niños a pedido, ambiente tranquilo, servicio atento con familias.",
    petInfo: null, pet: false,
  },
  {
    name: "Tres Delicias Buin", instagram: "tres.delicias.buin", zone: "cen",
    address: "Buin, Santiago",
    date: "Jue–Dom",
    schedule: "Jue–Vie 12:00–18:00 | Sáb–Dom 11:00–19:00",
    desc: "Restaurante campestre en Buin con cocina tradicional chilena y jardín amplio.",
    kidInfo: "Jardín amplio para que los niños corran. Cazuelas y empanadas caseras. El espacio al aire libre es el gran atractivo.",
    petInfo: "Pet friendly en jardín exterior.", pet: true,
  },
];

function createRestaurantEvent(r, id) {
    const today = new Date();
    return {
        title: r.name,
        loadedAt: today.toISOString().slice(0, 10),
        cat: "food",
        emoji: "🍴",
        desc: r.desc || `Café/Restaurante kid-friendly. Instagram: @${r.instagram}`,
        date: r.date || "Consultar horarios",
        schedule: r.schedule || "",
        dateMs: null,
        month: today.getMonth(),
        days: [],
        venue: r.name,
        address: r.address || "Santiago",
        zone: r.zone,
        mapsQ: encodeURIComponent(r.name + " " + (r.address || "Santiago")),
        price: null,
        src: "Descubre Tu Ciudad",
        srcUrl: `https://www.instagram.com/${r.instagram}/`,
        instagram: `https://www.instagram.com/${r.instagram}/`,
        img: "",
        tags: ["Kid friendly", "Familia"],
        acc: false,
        pet: r.pet || false,
        petInfo: r.petInfo || null,
        kid: true,
        kidInfo: r.kidInfo || null,
        tipo: "rest",
        id,
    };
}

try {
    const filePath = path.join(__dirname, 'events.json');
    const altPath = path.join(__dirname, '..', 'events.json');
    const fp = fs.existsSync(filePath) ? filePath : altPath;

    if (!fs.existsSync(fp)) { console.error('❌ events.json no encontrado'); process.exit(1); }

    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!Array.isArray(data.events)) { console.error('❌ Estructura inválida'); process.exit(1); }

    let maxId = Math.max(...data.events.map(e => typeof e.id === 'number' ? e.id : 0), 0);
    const existingTitles = new Set(data.events.map(e => e.title.toLowerCase()));
    let added = 0, updated = 0;

    restaurants.forEach(r => {
        const existing = data.events.find(e => e.title.toLowerCase() === r.name.toLowerCase());
        if (existing) {
            // Update existing entry with real data
            existing.date = r.date || existing.date;
            existing.schedule = r.schedule || existing.schedule;
            existing.desc = r.desc || existing.desc;
            existing.kidInfo = r.kidInfo || existing.kidInfo;
            existing.petInfo = r.petInfo || null;
            existing.pet = r.pet || existing.pet;
            existing.instagram = `https://www.instagram.com/${r.instagram}/`;
            existing.srcUrl = `https://www.instagram.com/${r.instagram}/`;
            if (r.address && r.address !== 'Santiago') existing.address = r.address;
            // Forzar marca de restaurante (corrige entradas corruptas) y quitar fecha
            existing.tipo = 'rest';
            existing.cat = 'food';
            existing.emoji = existing.emoji || '🍴';
            existing.kid = true;
            existing.dateMs = null;
            delete existing.isPast;
            updated++;
        } else {
            data.events.push(createRestaurantEvent(r, ++maxId));
            added++;
        }
    });

    data.meta = { ...data.meta, lastUpdated: new Date().toISOString().split('T')[0], totalEvents: data.events.length };
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ Done! Actualizados: ${updated} | Nuevos: ${added} | Total: ${data.events.length}\n`);
} catch(e) { console.error('❌ Error:', e.message); process.exit(1); }
