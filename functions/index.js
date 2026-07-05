/**
 * Cloud Function: extractEvent
 * Recibe la URL de un evento, baja el contenido de la página (server-side),
 * y usa Gemini para extraer los datos como JSON. La API key de Gemini vive
 * SOLO en el servidor (secret GEMINI_KEY), nunca en el navegador.
 * Requiere sesión iniciada (solo usuarios autenticados pueden llamarla).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "us-central1", maxInstances: 3 });

const GEMINI_KEY = defineSecret("GEMINI_KEY");

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export const extractEvent = onCall({ secrets: [GEMINI_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para usar el relleno con IA.");
  }
  const url = String((request.data && request.data.url) || "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpsError("invalid-argument", "URL inválida.");
  }

  let pageText = "";
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DescubreTuCiudadBot/1.0)",
        "Accept-Language": "es-CL,es;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) pageText = htmlToText(await r.text());
  } catch (e) {
    // seguimos sin contenido de página
  }

  const base = pageText.length > 100
    ? `Extrae la información de este evento en Santiago Chile. RESPONDE SOLO JSON VÁLIDO sin markdown.\n\nURL del evento: ${url}\n\nTexto de la página:\n${pageText}`
    : `Basándote en esta URL de evento en Chile, infiere la información del evento. RESPONDE SOLO JSON VÁLIDO sin markdown.\nURL: ${url}\nNota: no se pudo obtener el contenido de la página, infiere lo que puedas del URL.`;

  const prompt = base + `\n\nFormato JSON requerido (todos los campos):\n{"title":"nombre del evento","desc":"descripción 1-2 oraciones","date":"fecha como aparece","schedule":"horario o vacío","venue":"nombre del lugar","address":"dirección o vacío","price":0,"isFree":true,"tickets":"${url}","instagram":"","web":"${url}","cat":"culture","pet":false,"kid":false,"acc":false}\n\nReglas para cat: "sport"=deporte/carrera, "culture"=arte/expo/teatro, "music"=concierto, "food"=gastronomía\npet=true si es evento con/para mascotas. kid=true si apto para niños.\nprice=número entero en pesos chilenos, 0 si gratis.`;

  let resp;
  try {
    resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_KEY.value(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(25000),
      }
    );
  } catch (e) {
    throw new HttpsError("internal", "No se pudo contactar la IA.");
  }
  if (!resp.ok) {
    throw new HttpsError("internal", "Error de la IA (" + resp.status + ").");
  }
  const data = await resp.json();
  const text = (data && data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts.map((p) => p.text || "").join("")) || "";
  const m = text.match(/\{[\s\S]+\}/);
  if (!m) {
    throw new HttpsError("internal", "La IA no devolvió un JSON válido.");
  }
  return { hasPageContent: pageText.length > 100, event: JSON.parse(m[0]) };
});
