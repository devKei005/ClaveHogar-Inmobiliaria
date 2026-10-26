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
import {
  verifyPropertiesAgainstCriteria,
  extractCriteriaLocally,
  buildAgentConversationReply,
  ExtractedSearchCriteria,
} from './src/utils/aiConversationalAgent';
import { PropertyItem } from './src/types';

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

  app.use(express.json({ limit: '10mb' }));

  /**
   * ENDPOINT NUEVO: Asistente Inmobiliario Conversacional con IA (Clara - ClaveHogar)
   * Recibe el historial de la conversación, preferencias acumuladas y listado de propiedades.
   * La IA interpreta el lenguaje natural, recuerda las preferencias y elabora la respuesta,
   * mientras que el código estricto filtra las propiedades reales para evitar alucinaciones.
   */
  app.post('/api/ai/conversational-search', async (req, res) => {
    const { messages, currentCriteria, properties } = req.body as {
      messages?: { role: 'user' | 'assistant'; content: string }[];
      currentCriteria?: ExtractedSearchCriteria;
      properties?: PropertyItem[];
    };

    if (!Array.isArray(messages) || messages.length === 0 || !Array.isArray(properties)) {
      res.status(400).json({
        error: 'Se requiere el historial de mensajes y el catálogo de propiedades.',
      });
      return;
    }

    const latestUserMessage =
      [...messages].reverse().find((m) => m.role === 'user')?.content || '';

    // Si no hay API key de Gemini, usamos inmediatamente el motor local estructurado
    const localCriteria = extractCriteriaLocally(latestUserMessage, currentCriteria);
    const localVerification = verifyPropertiesAgainstCriteria(properties, localCriteria);
    const localFallbackReply = buildAgentConversationReply(
      latestUserMessage,
      localCriteria,
      localVerification
    );

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: localCriteria,
        exactMatches: localVerification.exactMatches,
        alternativeMatches: localVerification.alternativeMatches,
      });
      return;
    }

    try {
      const ai = getGenAIClient();
      const localCriteria = extractCriteriaLocally(latestUserMessage, currentCriteria);
      const preliminaryCriteria: ExtractedSearchCriteria = {
        operationType: localCriteria.operationType || currentCriteria?.operationType || null,
        propertyType: localCriteria.propertyType || currentCriteria?.propertyType || null,
        locations:
          localCriteria.locations && localCriteria.locations.length > 0
            ? localCriteria.locations
            : currentCriteria?.locations || [],
        maxPrice: localCriteria.maxPrice || currentCriteria?.maxPrice || null,
        minPrice: localCriteria.minPrice || currentCriteria?.minPrice || null,
        currency: localCriteria.currency || currentCriteria?.currency || null,
        isAmbiguousOrUnrealisticBudget: Boolean(
          localCriteria.isAmbiguousOrUnrealisticBudget || currentCriteria?.isAmbiguousOrUnrealisticBudget
        ),
        unrealisticBudgetReason: localCriteria.unrealisticBudgetReason,
        minBedrooms: localCriteria.minBedrooms || currentCriteria?.minBedrooms || null,
        minRooms: localCriteria.minRooms || currentCriteria?.minRooms || null,
        requiredFeatures: Array.from(
          new Set([
            ...(localCriteria.requiredFeatures || []),
            ...(currentCriteria?.requiredFeatures || []),
          ])
        ),
        isGeneralInquiry: localCriteria.isGeneralInquiry,
      };

      const preliminaryVerification = verifyPropertiesAgainstCriteria(properties, preliminaryCriteria);

      const verifiedCatalogSummary = [
        ...preliminaryVerification.exactMatches.map((p) => `[COINCIDENCIA DESTACADA] "${p.title}" (${p.propertyType}, en ${p.location}): ${p.currency} ${p.price.toLocaleString()} (${p.operationType}). ${p.bedrooms} dorm, ${p.bathrooms} baños, ${p.surface} m². Comodidades: ${(p.features || []).join(', ')}. Descripción: ${p.description}`),
        ...preliminaryVerification.alternativeMatches.map((alt) => `[ALTERNATIVA CERCANA - ${alt.humanDifferenceNote}] "${alt.property.title}" (${alt.property.propertyType}, en ${alt.property.location}): ${alt.property.currency} ${alt.property.price.toLocaleString()} (${alt.property.operationType}). ${alt.property.bedrooms} dorm, ${alt.property.bathrooms} baños, ${alt.property.surface} m². Comodidades: ${(alt.property.features || []).join(', ')}.`),
      ].join('\n');

      // 2. Formatear el historial reciente de conversación para el contexto de Gemini
      const conversationHistoryPrompt = messages
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Clara'}: ${m.content}`)
        .join('\n');

      const prompt = `Conversación previa con el cliente:
${conversationHistoryPrompt}

Último mensaje recibido del cliente: "${latestUserMessage}"

Criterios de búsqueda acumulados:
${JSON.stringify(preliminaryCriteria)}

Propiedades verificadas reales del catálogo de ClaveHogar para esta consulta:
${verifiedCatalogSummary || 'No disponemos en este momento de propiedades en catálogo con esos filtros específicos.'}

INSTRUCCIONES CLAVE PARA CLARA:
1. Personalidad: Habla como Clara, una asesora inmobiliaria cálida, atenta, profesional y de confianza. NUNCA uses lenguaje técnico ni menciones bases de datos, Firestore, algoritmos ni porcentajes.
2. CONTINUIDAD CONVERSACIONAL (MUY IMPORTANTE):
   - Si el cliente está respondiendo a una pregunta que tú le hiciste antes (ej: si quiere coordinar una visita, requisitos para alquilar, garantías, expensas, si aceptan mascotas, etc.):
     * RESPONDE DIRECTAMENTE a lo que te contestó o preguntó con naturalidad.
     * Si quiere visitar la propiedad: invítalo a tocar "Ver Ficha Completa" en la tarjeta para agendar o decile qué días/horarios le quedan cómodos para avisarle al agente.
     * Si pregunta por requisitos: 1 mes de depósito, 1 mes de alquiler, demostración de ingresos (triplicar alquiler) y garantía propietaria en CABA o seguro de caución (Finaer/Respaldar).
     * Si pregunta por mascotas: el dúplex de Belgrano R y las casas de Quilmes son aptas mascotas.
     * Si pregunta por expensas: explícale que son moderadas por tener pocos vecinos y servicios individuales.
3. RECOMENDACIONES DE PROPIEDADES:
   - Si hay propiedades encontradas que coinciden o se aproximan bastante (por ejemplo el Dúplex en Belgrano R de USD 1.550 para quien busca casa en Belgrano en alquiler hasta USD 2.000):
     * Preséntala con entusiasmo como una opción destacada que se adapta a lo que busca (amplitud en 2 plantas, 112 m², ubicación residencial arbolada en Belgrano R, precio dentro de presupuesto).
   - Si las opciones difieren (ej: casas con pileta en Quilmes a 185k cuando pedía hasta 150k):
     * Explícalo con amabilidad y transparencia ("En Quilmes encontré 2 casas hermosas con pileta que cumplen con la zona y comodidades, aunque su valor está un poco por encima del presupuesto...").
4. PREGUNTA ABIERTA AL FINAL (OBLIGATORIO):
   - Termina SIEMPRE tu mensaje con una pregunta abierta y cordial para que el cliente pueda continuar la charla con fluidez (ej: consultar qué día le vendría bien visitar, si tiene dudas sobre expensas/garantías, o si prefiere evaluar alguna otra zona).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `Eres Clara, una corredora y asesora inmobiliaria profesional, amable, cálida y de confianza en la inmobiliaria ClaveHogar (Argentina).
Hablas con la naturalidad, empatía y fluidez de un verdadero agente inmobiliario humano.

REGLAS:
1. PROHIBIDO mencionar términos técnicos como "Firestore", "base de datos", "código", "consultas", "algoritmo", "porcentajes de compatibilidad" ni procesos internos.
2. Si el cliente está respondiendo a una pregunta que tú le hiciste previamente (ej: "sí, me gustaría coordinar", "cuáles son los requisitos", "tiene expensas?"), RESPONDE DIRECTAMENTE A ESO con total claridad y amabilidad.
3. Moneda y presupuesto:
   - $200, 200 pesos argentinos y USD 200 NO son lo mismo. Si el cliente menciona un importe que no es realista para el mercado (ej: "200 pesos"), pídele con amabilidad que te aclare el valor o si buscaba en dólares.
4. Siempre termina con una pregunta abierta para mantener la conversación activa.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assistantMessage: { type: Type.STRING },
              isGeneralInquiry: { type: Type.BOOLEAN },
              isOffTopic: { type: Type.BOOLEAN },
              extractedCriteria: {
                type: Type.OBJECT,
                properties: {
                  operationType: { type: Type.STRING },
                  propertyType: { type: Type.STRING },
                  locations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  maxPrice: { type: Type.NUMBER },
                  minPrice: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  isAmbiguousOrUnrealisticBudget: { type: Type.BOOLEAN },
                  minBedrooms: { type: Type.NUMBER },
                  minRooms: { type: Type.NUMBER },
                  requiredFeatures: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  summary: { type: Type.STRING },
                },
                required: ['summary'],
              },
            },
            required: ['assistantMessage', 'extractedCriteria'],
          },
        },
      });

      const raw = response.text;
      if (!raw) {
        throw new Error('Gemini devolvió respuesta vacía');
      }

      const parsed = JSON.parse(raw.trim());

      const mergedCriteria: ExtractedSearchCriteria = {
        operationType:
          parsed.extractedCriteria.operationType ||
          localCriteria.operationType ||
          currentCriteria?.operationType ||
          null,
        propertyType:
          parsed.extractedCriteria.propertyType ||
          localCriteria.propertyType ||
          currentCriteria?.propertyType ||
          null,
        locations:
          parsed.extractedCriteria.locations && parsed.extractedCriteria.locations.length > 0
            ? parsed.extractedCriteria.locations
            : localCriteria.locations && localCriteria.locations.length > 0
            ? localCriteria.locations
            : currentCriteria?.locations || [],
        maxPrice:
          typeof parsed.extractedCriteria.maxPrice === 'number' && parsed.extractedCriteria.maxPrice > 0
            ? parsed.extractedCriteria.maxPrice
            : localCriteria.maxPrice || currentCriteria?.maxPrice || null,
        minPrice:
          typeof parsed.extractedCriteria.minPrice === 'number' && parsed.extractedCriteria.minPrice > 0
            ? parsed.extractedCriteria.minPrice
            : localCriteria.minPrice || currentCriteria?.minPrice || null,
        currency:
          (parsed.extractedCriteria.currency as any) ||
          localCriteria.currency ||
          currentCriteria?.currency ||
          null,
        isAmbiguousOrUnrealisticBudget: Boolean(
          parsed.extractedCriteria.isAmbiguousOrUnrealisticBudget ||
          localCriteria.isAmbiguousOrUnrealisticBudget
        ),
        unrealisticBudgetReason:
          localCriteria.unrealisticBudgetReason ||
          'El monto ingresado es ambiguo o poco realista para el mercado inmobiliario actual.',
        minBedrooms:
          typeof parsed.extractedCriteria.minBedrooms === 'number' && parsed.extractedCriteria.minBedrooms > 0
            ? parsed.extractedCriteria.minBedrooms
            : localCriteria.minBedrooms || currentCriteria?.minBedrooms || null,
        minRooms:
          typeof parsed.extractedCriteria.minRooms === 'number' && parsed.extractedCriteria.minRooms > 0
            ? parsed.extractedCriteria.minRooms
            : localCriteria.minRooms || currentCriteria?.minRooms || null,
        requiredFeatures: Array.from(
          new Set([
            ...(parsed.extractedCriteria.requiredFeatures || []),
            ...(localCriteria.requiredFeatures || []),
            ...(currentCriteria?.requiredFeatures || []),
          ])
        ),
        summary: parsed.extractedCriteria.summary || localCriteria.summary || '',
        isGeneralInquiry: Boolean(parsed.isGeneralInquiry ?? localCriteria.isGeneralInquiry),
      };

      // VERIFICACIÓN CON SISTEMA DE PUNTUACIÓN FLEXIBLE PONDERADO
      const verification = verifyPropertiesAgainstCriteria(properties, mergedCriteria);

      let finalAssistantMessage = parsed.assistantMessage;

      // Si el presupuesto es ambiguo o irreal (ej: "200 pesos"), priorizar la aclaración humana sin inventar recomendaciones
      if (mergedCriteria.isAmbiguousOrUnrealisticBudget) {
        finalAssistantMessage = `Veo que mencionaste un presupuesto de ${
          mergedCriteria.maxPrice ? `${mergedCriteria.maxPrice} pesos` : 'ese monto'
        }. En el mercado inmobiliario actual las propiedades se publican en dólares (USD) o en valores más altos en moneda local para alquileres.\n\n¿Te referías a USD ${mergedCriteria.maxPrice || ''} o quisiste indicar otro importe? Contame así puedo orientarte con opciones acordes.`;
      }

      res.json({
        assistantMessage: finalAssistantMessage,
        criteria: mergedCriteria,
        exactMatches:
          mergedCriteria.isGeneralInquiry || mergedCriteria.isAmbiguousOrUnrealisticBudget
            ? []
            : verification.exactMatches,
        alternativeMatches:
          mergedCriteria.isGeneralInquiry || mergedCriteria.isAmbiguousOrUnrealisticBudget
            ? []
            : verification.alternativeMatches,
      });
    } catch (err) {
      console.error('Error en /api/ai/conversational-search, usando fallback local:', err);
      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: localCriteria,
        exactMatches: localVerification.exactMatches,
        alternativeMatches: localVerification.alternativeMatches,
      });
    }
  });

  /**
   * ENDPOINT ANTERIOR (Mantenido para compatibilidad directa)
   */
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
    res.json(heuristicResult);
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
