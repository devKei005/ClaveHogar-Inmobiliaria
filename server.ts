import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildFlexibleSmartSearch,
  SmartSearchPropertyInput,
} from './src/utils/smartSearchEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  app.post('/api/ai/smart-search', async (req, res) => {
    const { query, properties } = req.body as {
      query?: string;
      properties?: SmartSearchPropertyInput[];
    };

    if (!query || typeof query !== 'string' || !Array.isArray(properties)) {
      res.status(400).json({
        error: 'Se requiere una consulta en lenguaje natural y el listado de propiedades.',
      });
      return;
    }

    const heuristicResult = buildFlexibleSmartSearch(query, properties);

    // Respuesta ultra rápida (<10ms) para saludos, chistes, consultas fuera de tema o pedidos de aclaración
    if (heuristicResult.isOffTopic || heuristicResult.needsClarification) {
      res.json(heuristicResult);
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      res.json(heuristicResult);
      return;
    }

    try {
      const catalogContext = properties.map((p) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        operationType: p.operationType,
        propertyType: p.propertyType,
        price: p.price,
        currency: p.currency,
        surface: p.surface,
        rooms: p.rooms,
        bedrooms: p.bedrooms,
        features: (p.features || []).slice(0, 5),
      }));

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Analiza la siguiente búsqueda inmobiliaria en lenguaje natural de un cliente en ClaveHogar y compárala de manera flexible e inteligente contra las propiedades reales almacenadas en Firestore.

Consulta del cliente: "${query}"

Propiedades reales en Firestore (JSON):
${JSON.stringify(catalogContext)}

Reglas de interpretación flexible:
1. Sinónimos geográficos: "Ciudad de Buenos Aires", "Capital Federal", "Capital", "CABA" y todos sus barrios (Palermo, Belgrano, Recoleta, Puerto Madero, Núñez, Colegiales, Caballito, San Telmo, etc.) son equivalentes a CABA. Si el usuario dice "cerca de la ciudad de buenos aires" (incluso con errores de tipeo como "cera de"), incluye tanto propiedades en CABA como en el Gran Buenos Aires (Quilmes, Bernal, Avellaneda, San Isidro, Vicente López, Tigre, etc.).
2. Rangos y montos abreviados: interpreta expresiones como "entre 10 a 15 mil dólares" como un rango de 10.000 a 15.000 (y permite un margen cercano de ±20%). "15 mil" = 15000, "200 mil" = 200000.
3. Si el usuario pide genéricamente "un inmueble" o "una propiedad", acepta cualquier tipo (Casa, Departamento, PH, Loft, Terreno, etc.) que cumpla con la zona y el rango de precio.
4. NUNCA recomiendes propiedades que no cumplan los criterios ni inventes nada. Solo recomienda propiedades reales con matchScore >= 55. Si no hay coincidencias exactas o cercanas, recommendations = [].`,
        config: {
          systemInstruction: `# ROL
Eres el asistente virtual de búsqueda de un sistema inmobiliario (ClaveHogar). Tu única función es ayudar a los usuarios a encontrar inmuebles disponibles en el catálogo (casas, departamentos, terrenos, locales, oficinas, etc.).

# REGLAS ESTRICTAS
1. SOLO buscas inmuebles cuando la consulta contiene criterios inmobiliarios válidos: tipo de propiedad, operación (venta/alquiler), ubicación, precio, ambientes, dormitorios, baños, metros cuadrados, amenities, etc.
2. Si la consulta NO tiene relación con inmuebles (saludos, chistes, temas random, objetos que no son propiedades), NO devuelvas recomendaciones (recommendations = []) y responde en assistantMessage:
   "No encontré inmuebles relacionados con tu consulta. Puedo ayudarte a buscar por zona, tipo de propiedad, presupuesto o cantidad de ambientes." (o si es saludo: "¡Hola! Puedo ayudarte a buscar inmuebles. ¿Qué tipo de propiedad y en qué zona te interesa?").
3. Si el usuario menciona algo que no existe en el catálogo inmobiliario (ej: "una papa", "un helado", "un auto"), NO devuelvas recomendaciones y responde:
   "Ese elemento no forma parte de nuestro catálogo de inmuebles. ¿Buscás una casa, departamento, terreno u otro tipo de propiedad?"
4. NUNCA inventes propiedades, precios, direcciones, fotos ni características. Si el catálogo no tiene coincidencias reales, devuélvelo claramente en assistantMessage:
   "No hay inmuebles que coincidan con esos criterios. Probá ampliar la zona o el rango de precio."
5. Si la consulta es ambigua (ej: "busco algo barato", "algo para vivir"), pide aclaración en assistantMessage antes de buscar:
   "¿Podés indicarme la zona y el tipo de propiedad que buscás?" (o si dice "algo para vivir": "¿Preferís comprar o alquilar? ¿En qué zona y con cuántos ambientes?").
6. Si la ubicación es inexistente (ej: "en Marte"):
   "No tenemos inmuebles en esa ubicación. ¿Querés buscar en otra zona?"
7. Si hay criterios válidos, busca de manera flexible: comprende que CABA = Ciudad de Buenos Aires = Capital Federal, cercanías ("cerca de" o "cera de"), y montos abreviados ("10 a 15 mil" = 10000 a 15000). Recomienda solo las propiedades compatibles reales del JSON provisto y genera un assistantMessage claro.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assistantMessage: { type: Type.STRING },
              isOffTopic: { type: Type.BOOLEAN },
              needsClarification: { type: Type.BOOLEAN },
              interpretedPreferences: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  operationType: { type: Type.STRING },
                  preferredLocations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  maxPrice: { type: Type.NUMBER },
                  minRooms: { type: Type.NUMBER },
                  minSurface: { type: Type.NUMBER },
                  keyFeatures: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'summary',
                  'operationType',
                  'preferredLocations',
                  'maxPrice',
                  'minRooms',
                  'minSurface',
                  'keyFeatures',
                ],
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    propertyId: { type: Type.STRING },
                    matchScore: { type: Type.NUMBER },
                    explanation: { type: Type.STRING },
                    matchedCriteria: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['propertyId', 'matchScore', 'explanation', 'matchedCriteria'],
                },
              },
            },
            required: ['assistantMessage', 'interpretedPreferences', 'recommendations'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.json(heuristicResult);
        return;
      }

      const parsed = JSON.parse(rawText.trim());
      const mergedMap = new Map<string, any>();
      if (Array.isArray(parsed.recommendations)) {
        for (const r of parsed.recommendations) {
          if (r && r.propertyId) mergedMap.set(r.propertyId, r);
        }
      }
      for (const hRec of heuristicResult.recommendations) {
        const existing = mergedMap.get(hRec.propertyId);
        if (!existing || (hRec.matchScore || 0) > (existing.matchScore || 0)) {
          mergedMap.set(hRec.propertyId, hRec);
        }
      }
      const isOffTopic = Boolean(parsed.isOffTopic || heuristicResult.isOffTopic);
      const needsClarification = Boolean(
        parsed.needsClarification || heuristicResult.needsClarification
      );
      const mergedRecs = Array.from(mergedMap.values())
        .filter((r: any) => (r.matchScore || 0) >= 55)
        .sort((a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0));
      const finalRecs = isOffTopic || needsClarification ? [] : mergedRecs;
      const assistantMessage =
        parsed.assistantMessage ||
        heuristicResult.assistantMessage ||
        (finalRecs.length > 0
          ? `Encontré ${finalRecs.length} ${
              finalRecs.length === 1 ? 'inmueble disponible' : 'inmuebles disponibles'
            } en el catálogo que coinciden con tu búsqueda.`
          : 'No hay inmuebles que coincidan con esos criterios. Probá ampliar la zona o el rango de precio.');

      res.json({
        assistantMessage,
        isOffTopic,
        needsClarification,
        interpretedPreferences: {
          ...parsed.interpretedPreferences,
          summary:
            heuristicResult.interpretedPreferences.maxPrice > 0
              ? heuristicResult.interpretedPreferences.summary
              : parsed.interpretedPreferences?.summary ||
                heuristicResult.interpretedPreferences.summary,
          maxPrice:
            heuristicResult.interpretedPreferences.maxPrice > 0
              ? heuristicResult.interpretedPreferences.maxPrice
              : parsed.interpretedPreferences?.maxPrice || 0,
          preferredLocations:
            heuristicResult.interpretedPreferences.preferredLocations.length > 0 &&
            !heuristicResult.interpretedPreferences.preferredLocations[0]
              .toLowerCase()
              .includes('todas las zonas')
              ? heuristicResult.interpretedPreferences.preferredLocations
              : parsed.interpretedPreferences?.preferredLocations ||
                heuristicResult.interpretedPreferences.preferredLocations,
        },
        recommendations: finalRecs,
      });
    } catch (error) {
      console.error('Error in /api/ai/smart-search, using flexible smart search engine:', error);
      res.json(heuristicResult);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClaveHogar server listening on http://localhost:${PORT}`);
  });
}

startServer();
