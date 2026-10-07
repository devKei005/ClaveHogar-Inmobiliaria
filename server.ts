import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface PropertyInput {
  id: string;
  title: string;
  description: string;
  location: string;
  address: string;
  operationType: 'alquiler' | 'venta';
  propertyType: string;
  price: number;
  currency: string;
  surface: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  features: string[];
  availability: string;
}

function buildFallbackSmartSearch(queryText: string, properties: PropertyInput[]) {
  const q = queryText.toLowerCase();
  const isRent = q.includes('alquil') || q.includes('renta') || q.includes('mes');
  const isSale = q.includes('compr') || q.includes('venta') || q.includes('invertir') || q.includes('casa');
  const detectedOperation = isRent && !isSale ? 'alquiler' : isSale && !isRent ? 'venta' : 'ambos';

  const knownLocations = [
    'Quilmes',
    'Bernal',
    'Palermo',
    'Belgrano',
    'Recoleta',
    'Puerto Madero',
    'Núñez',
    'Colegiales',
    'Caballito',
    'San Isidro',
    'Vicente López',
    'Tigre',
    'La Plata',
  ];
  const preferredLocations = knownLocations.filter((loc) =>
    q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
      loc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
  );

  let minBedrooms = 0;
  const bedMatch = q.match(/(\d+)\s*(habitaciones|dormitorios|dorm|cuartos)/);
  if (bedMatch) {
    minBedrooms = parseInt(bedMatch[1], 10);
  }

  let minRooms = 1;
  const roomsMatch = q.match(/(\d+)\s*(ambientes|amb)/);
  if (roomsMatch) {
    minRooms = parseInt(roomsMatch[1], 10);
  } else if (minBedrooms > 0) {
    minRooms = minBedrooms + 1;
  }

  let maxPrice = 0;
  const priceMatch = q.match(/(?:hasta|maximo|máximo|presupuesto|menos de|\$|usd)\s*(?:de\s*)?(?:\$|usd\s*)?(\d[\d.,]*)/i);
  if (priceMatch) {
    const clean = Number(priceMatch[1].replace(/[.,]/g, ''));
    if (!Number.isNaN(clean) && clean > 0) maxPrice = clean;
  }

  const wantsCasa = q.includes('casa') || q.includes('chalet') || q.includes('villa');
  const wantsDepto = q.includes('departamento') || q.includes('depto') || q.includes('piso');
  const wantsPH = q.includes('ph');

  const featureKeywords = [
    { keys: ['pileta', 'piscina'], label: 'Piscina / Pileta' },
    { keys: ['mascota', 'perro', 'gato'], label: 'Apto mascotas' },
    { keys: ['balcón', 'balcon', 'terraza'], label: 'Balcón terraza' },
    { keys: ['cochera', 'garage', 'estacionamiento'], label: 'Cochera cubierta' },
    { keys: ['seguridad', 'vigilancia'], label: 'Seguridad 24h' },
    { keys: ['jardín', 'jardin', 'parque', 'patio'], label: 'Jardín / Patio' },
    { keys: ['luminoso', 'luz', 'sol', 'norte'], label: 'Luz natural / Orientación Norte' },
    { keys: ['parrilla', 'quincho', 'asador'], label: 'Parrilla' },
  ];

  const keyFeatures = featureKeywords
    .filter((fk) => fk.keys.some((k) => q.includes(k)))
    .map((fk) => fk.label);

  const scored = properties
    .map((p) => {
      let score = 50;
      const matchedCriteria: string[] = [];
      let hardMismatch = false;

      if (detectedOperation !== 'ambos') {
        if (p.operationType === detectedOperation) {
          score += 12;
          matchedCriteria.push(`Operación: ${p.operationType}`);
        } else {
          score -= 15;
        }
      }

      if (wantsCasa && !wantsDepto) {
        if (p.propertyType.toLowerCase().includes('casa')) {
          score += 15;
          matchedCriteria.push('Tipo: Casa');
        } else {
          score -= 15;
        }
      } else if (wantsDepto && !wantsCasa) {
        if (p.propertyType.toLowerCase().includes('departamento') || p.propertyType.toLowerCase().includes('loft')) {
          score += 15;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else {
          score -= 15;
        }
      } else if (wantsPH) {
        if (p.propertyType.toLowerCase().includes('ph')) {
          score += 15;
          matchedCriteria.push('Tipo: PH');
        }
      }

      if (preferredLocations.length > 0) {
        const propLocNorm = `${p.location} ${p.address}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const locMatched = preferredLocations.find((loc) =>
          propLocNorm.includes(loc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        );
        if (locMatched) {
          score += 22;
          matchedCriteria.push(`Ubicación en ${p.location}`);
        } else {
          score -= 22;
        }
      }

      if (minBedrooms > 0) {
        if (p.bedrooms >= minBedrooms) {
          score += 12;
          matchedCriteria.push(`${p.bedrooms} dormitorios (${p.rooms} amb.)`);
        } else {
          score -= 15;
        }
      } else if (minRooms > 1) {
        if (p.rooms >= minRooms) {
          score += 10;
          matchedCriteria.push(`${p.rooms} ambientes`);
        } else {
          score -= 10;
        }
      }

      if (maxPrice > 0) {
        if (p.price <= maxPrice) {
          score += 15;
          matchedCriteria.push(`Dentro de presupuesto (${p.currency} ${p.price.toLocaleString()})`);
        } else if (p.price <= maxPrice * 1.15) {
          score += 4;
          matchedCriteria.push(`Cercano al presupuesto (${p.currency} ${p.price.toLocaleString()})`);
        } else {
          score -= 30;
          hardMismatch = true;
        }
      }

      const textPool = `${p.title} ${p.description} ${p.features.join(' ')}`.toLowerCase();
      keyFeatures.forEach((feat) => {
        const keywords =
          feat.includes('Piscina')
            ? ['piscina', 'pileta']
            : feat.includes('Jardín')
            ? ['jardín', 'jardin', 'patio', 'parque']
            : [feat.split(' ')[0].toLowerCase()];
        if (keywords.some((kw) => textPool.includes(kw))) {
          score += 10;
          matchedCriteria.push(feat);
        }
      });

      const clamped = Math.min(99, Math.max(0, score));
      return {
        propertyId: p.id,
        matchScore: clamped,
        hardMismatch,
        matchedCriteria:
          matchedCriteria.length > 0
            ? matchedCriteria
            : [`${p.propertyType} en ${p.location}`, `${p.bedrooms} dormitorios`, `${p.surface} m²`],
        explanation: `Coincide con tu búsqueda porque ofrece ${
          matchedCriteria.length > 0
            ? matchedCriteria.join(', ')
            : `${p.rooms} ambientes y ${p.surface} m² en ${p.location}`
        }. Además cuenta con ${p.features.slice(0, 3).join(', ')}.`,
      };
    })
    .filter((item) => item.matchScore >= 55 && !item.hardMismatch)
    .sort((a, b) => b.matchScore - a.matchScore);

  return {
    interpretedPreferences: {
      summary: `Búsqueda interpretada para: "${queryText}"`,
      operationType: detectedOperation,
      preferredLocations: preferredLocations.length > 0 ? preferredLocations : ['Todas las zonas disponibles'],
      maxPrice: maxPrice || 0,
      minRooms: minRooms || 1,
      minSurface: 45,
      keyFeatures: keyFeatures.length > 0 ? keyFeatures : ['Confort y buena ubicación'],
    },
    recommendations: scored.map(({ hardMismatch, ...rest }) => rest),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.post('/api/ai/smart-search', async (req, res) => {
    const { query, properties } = req.body as {
      query?: string;
      properties?: PropertyInput[];
    };

    if (!query || typeof query !== 'string' || !Array.isArray(properties)) {
      res.status(400).json({ error: 'Se requiere una consulta en lenguaje natural y el listado de propiedades.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      res.json(buildFallbackSmartSearch(query, properties));
      return;
    }

    try {
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
        description: p.description.slice(0, 300),
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Analiza la siguiente búsqueda inmobiliaria en lenguaje natural de un cliente en ClaveHogar y compárala contra las propiedades reales almacenadas en Firestore.

Consulta del cliente: "${query}"

Propiedades reales en Firestore (JSON):
${JSON.stringify(catalogContext, null, 2)}

Reglas estrictas:
1. Interpreta los requisitos del usuario (tipo de operación, ubicación como Quilmes/Palermo/San Isidro/etc., presupuesto máximo, habitaciones/dormitorios, pileta/piscina y otras comodidades).
2. Recomienda ÚNICAMENTE las propiedades del catálogo que realmente coincidan o se acerquen razonablemente a lo que pide el usuario (con matchScore >= 60). Si ninguna propiedad cumple razonablemente con la zona, presupuesto o características pedidas, devuelve un array vacío [] en "recommendations".
3. Redacta en español una explicación clara y personalizada para cada propiedad recomendada.`,
        config: {
          systemInstruction:
            'Eres el motor de inteligencia inmobiliaria de ClaveHogar. Analizas propiedades reales de Firestore y devuelves JSON válido.',
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
        res.json(buildFallbackSmartSearch(query, properties));
        return;
      }

      const parsed = JSON.parse(rawText.trim());
      res.json(parsed);
    } catch (error) {
      console.error('Error in /api/ai/smart-search, using smart heuristic fallback:', error);
      res.json(buildFallbackSmartSearch(query, properties));
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
