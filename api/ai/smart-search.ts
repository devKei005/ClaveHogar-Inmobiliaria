import { GoogleGenAI, Type } from '@google/genai';
import {
  buildFlexibleSmartSearch,
  SmartSearchPropertyInput,
} from '../../src/utils/smartSearchEngine';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const { query, properties } = body as {
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

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    res.status(200).json(heuristicResult);
    return;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const catalogContext = properties.map((p) => ({
      id: p.id,
      title: p.title,
      location: p.location,
      address: p.address,
      operationType: p.operationType,
      propertyType: p.propertyType,
      price: p.price,
      currency: p.currency,
      surface: p.surface,
      rooms: p.rooms,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      features: p.features,
      availability: p.availability,
      description: (p.description || '').slice(0, 300),
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analiza la siguiente búsqueda inmobiliaria en lenguaje natural de un cliente en ClaveHogar y compárala de manera flexible e inteligente contra las propiedades reales almacenadas en Firestore.

Consulta del cliente: "${query}"

Propiedades reales en Firestore (JSON):
${JSON.stringify(catalogContext, null, 2)}

Reglas de interpretación flexible:
1. Sinónimos geográficos: "Ciudad de Buenos Aires", "Capital Federal", "Capital", "CABA" y todos sus barrios (Palermo, Belgrano, Recoleta, Puerto Madero, Núñez, Colegiales, Caballito, San Telmo, etc.) son equivalentes a CABA. Si el usuario dice "cerca de la ciudad de buenos aires" (incluso con errores de tipeo como "cera de"), incluye tanto propiedades en CABA como en el Gran Buenos Aires (Quilmes, Bernal, Avellaneda, San Isidro, Vicente López, Tigre, etc.).
2. Rangos y montos abreviados: interpreta expresiones como "entre 10 a 15 mil dólares" como un rango de 10.000 a 15.000 (y permite un margen cercano de ±20%). "15 mil" = 15000, "200 mil" = 200000.
3. Si el usuario pide genéricamente "un inmueble" o "una propiedad", acepta cualquier tipo (Casa, Departamento, PH, Loft, Terreno, etc.) que cumpla con la zona y el rango de precio.
4. Recomienda todas las propiedades compatibles (matchScore >= 55) y explica en español por qué coinciden.`,
      config: {
        systemInstruction:
          'Eres el motor de inteligencia inmobiliaria de ClaveHogar. Comprendes sinónimos geográficos argentinos (CABA = Ciudad de Buenos Aires = Capital Federal), cercanías, errores de tipeo y rangos de precios abreviados ("10 a 15 mil"). Devuelves JSON válido.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
          required: ['interpretedPreferences', 'recommendations'],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      res.status(200).json(heuristicResult);
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
    const mergedRecs = Array.from(mergedMap.values()).sort(
      (a: any, b: any) => (b.matchScore || 0) - (a.matchScore || 0)
    );

    res.status(200).json({
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
      recommendations: mergedRecs,
    });
  } catch (err) {
    console.error('Fallback smart search triggered:', err);
    res.status(200).json(heuristicResult);
  }
}
