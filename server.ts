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
  mergeConversationalCriteria,
  isGreetingOrNonPropertyMessage,
  hasSufficientCriteriaToSearch,
  getMissingCriteriaQuestion,
  analyzeOffTopicIntent,
  isDeclineOrGoodbyeMessage,
  isExploreOtherOptionsIntent,
  isVisitSchedulingIntent,
  isPropertyDetailOrProceduralInquiry,
  shouldSuppressPropertyCards,
  extractAvailableLocationsSummary,
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
   * ENDPOINT: Asistente Inmobiliario Conversacional con IA (Clara - ClaveHogar)
   * Memoria conversacional acumulativa, reglas estrictas de ubicación (CABA vs Quilmes),
   * detección de direcciones reales sin repreguntas de zona, redirección off-topic a inmuebles,
   * aviso de zonas sin publicaciones con recomendación de alternativas que cumplen el resto de necesidades,
   * y envío ÚNICAMENTE de coincidencias exactas cuando existan.
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

    // Análisis de desvío de tema (off-topic) o saludo puro
    const offTopicCheck = analyzeOffTopicIntent(latestUserMessage, currentCriteria);
    const isPureGreeting =
      isGreetingOrNonPropertyMessage(latestUserMessage) && !offTopicCheck.isOffTopic;

    const localNewExtraction = extractCriteriaLocally(latestUserMessage, currentCriteria);
    const preliminaryCriteria = mergeConversationalCriteria(
      currentCriteria,
      latestUserMessage,
      localNewExtraction
    );

    const isVisitQuery = isVisitSchedulingIntent(latestUserMessage);
    const isDetailQuery = isPropertyDetailOrProceduralInquiry(latestUserMessage);
    const hasNewLocation = Boolean(localNewExtraction.locations && localNewExtraction.locations.length > 0);
    const suppressCards =
      shouldSuppressPropertyCards(latestUserMessage, preliminaryCriteria) ||
      ((isVisitQuery || isDetailQuery) && !hasNewLocation);

    const hasSufficient = hasSufficientCriteriaToSearch(preliminaryCriteria);
    const preliminaryVerification =
      !isPureGreeting && !offTopicCheck.isOffTopic && hasSufficient && !suppressCards
        ? verifyPropertiesAgainstCriteria(properties, preliminaryCriteria)
        : { exactMatches: [], alternativeMatches: [], criteria: preliminaryCriteria };

    const localFallbackReply = buildAgentConversationReply(
      latestUserMessage,
      currentCriteria,
      preliminaryCriteria,
      preliminaryVerification,
      properties
    );

    // Caso de desvío de tema (off-topic) -> Devolver aviso, resetear filtros y no enviar publicaciones
    if (offTopicCheck.isOffTopic) {
      res.json({
        assistantMessage:
          offTopicCheck.reply ||
          'Disculpá, no sé de qué estás hablando ya que solo me especializo en temas inmobiliarios. ¿Te interesa buscar alguna propiedad para comprar o alquilar?',
        criteria: { resetTriggered: true },
        exactMatches: [],
        alternativeMatches: [],
      });
      return;
    }

    // Caso de saludo cordial puro -> Saludar amablemente como nueva charla, resetear filtros y no enviar publicaciones
    if (isPureGreeting) {
      res.json({
        assistantMessage:
          localFallbackReply.message ||
          '¡Hola! Soy Clara, asesora en ClaveHogar. ¿Te gustaría que te ayude a encontrar una propiedad? Contame qué buscás (operación, zona, presupuesto) y te busco opciones.',
        criteria: { resetTriggered: true },
        exactMatches: [],
        alternativeMatches: [],
      });
      return;
    }

    // Caso de despedida o rechazo -> Resetear estado a nueva charla
    if (preliminaryCriteria.resetTriggered || isDeclineOrGoodbyeMessage(latestUserMessage)) {
      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: { resetTriggered: true },
        exactMatches: [],
        alternativeMatches: [],
      });
      return;
    }

    // Caso de consultar otras zonas o explorar opciones sin criterios específicos aún
    if (
      preliminaryCriteria.isExploringOtherZones ||
      (isExploreOtherOptionsIntent(latestUserMessage) &&
        (!preliminaryCriteria.locations || preliminaryCriteria.locations.length === 0))
    ) {
      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: preliminaryCriteria,
        exactMatches: [],
        alternativeMatches: [],
      });
      return;
    }

    // Si no hay API key o es un placeholder, usamos el motor determinístico local
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      const canReturnProps =
        !isPureGreeting &&
        hasSufficient &&
        !suppressCards &&
        !preliminaryCriteria.isExploringOtherZones &&
        !preliminaryCriteria.resetTriggered &&
        !preliminaryCriteria.isAmbiguousOrUnrealisticBudget;

      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: preliminaryCriteria,
        exactMatches: canReturnProps ? preliminaryVerification.exactMatches : [],
        alternativeMatches:
          canReturnProps && preliminaryVerification.exactMatches.length === 0
            ? preliminaryVerification.alternativeMatches
            : [],
      });
      return;
    }

    try {
      const ai = getGenAIClient();

      // Caso A: Saludo o mensaje ajeno a inmuebles
      if (isPureGreeting) {
        res.json({
          assistantMessage: localFallbackReply.message,
          criteria: preliminaryCriteria,
          exactMatches: [],
          alternativeMatches: [],
        });
        return;
      }

      // Caso B: Faltan datos esenciales (operación o ubicación/dirección)
      if (!hasSufficient) {
        const missingQuestion = getMissingCriteriaQuestion(preliminaryCriteria);
        res.json({
          assistantMessage:
            missingQuestion ||
            '¿Podrías indicarme la zona, barrio o dirección y si preferís comprar o alquilar?',
          criteria: preliminaryCriteria,
          exactMatches: [],
          alternativeMatches: [],
        });
        return;
      }

      // Caso C: Búsqueda con datos suficientes -> Consultar Gemini con el catálogo verificado
      const verifiedCatalogSummary = [
        ...preliminaryVerification.exactMatches.map(
          (p) =>
            `[COINCIDENCIA EXACTA] "${p.title}" (${p.propertyType}, en ${p.location}, dirección: ${p.address}): ${p.currency} ${p.price.toLocaleString()} (${p.operationType}). ${p.bedrooms} dorm, ${p.bathrooms} baños, ${p.surface} m². Comodidades: ${(p.features || []).join(', ')}. Descripción: ${p.description}`
        ),
        ...(preliminaryVerification.exactMatches.length === 0
          ? preliminaryVerification.alternativeMatches.map(
              (alt) =>
                `[ALTERNATIVA CERCANA - ${alt.humanDifferenceNote}] "${alt.property.title}" (${alt.property.propertyType}, en ${alt.property.location}, dirección: ${alt.property.address}): ${alt.property.currency} ${alt.property.price.toLocaleString()} (${alt.property.operationType}). ${alt.property.bedrooms} dorm, ${alt.property.bathrooms} baños, ${alt.property.surface} m². Comodidades: ${(alt.property.features || []).join(', ')}.`
            )
          : []),
      ].join('\n');

      const conversationHistoryPrompt = messages
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Clara'}: ${m.content}`)
        .join('\n');

      const dynamicAvailableLocations = extractAvailableLocationsSummary(properties);

      const prompt = `Conversación previa con el cliente:
${conversationHistoryPrompt}

Último mensaje recibido del cliente: "${latestUserMessage}"

Criterios de búsqueda acumulados:
${JSON.stringify(preliminaryCriteria)}

Propiedades verificadas reales del catálogo de ClaveHogar para esta consulta:
${verifiedCatalogSummary || 'No disponemos en este momento de propiedades en catálogo con esos filtros específicos.'}

INSTRUCCIONES CLAVE PARA CLARA:
1. Personalidad: Habla como Clara, una asesora inmobiliaria cálida, atenta, profesional y de confianza. NUNCA uses lenguaje técnico ni menciones bases de datos, Firestore, algoritmos ni porcentajes.
2. DETECCIÓN DE DIRECCIONES Y CALLES (CRÍTICO):
   - Si el cliente escribió una dirección o calle (por ejemplo "Av. Cabildo 1500", "Alvear 840", "Mitre 450", "Melián 2245", "Conde 1190", etc.): Reconócela inmediatamente y responde sobre esa dirección o zona. NUNCA le preguntes "¿en qué zona buscás?" porque el cliente ya te dio la dirección o calle.
3. SI EL CLIENTE SE VA DE TEMA (OFF-TOPIC / AJENO AL SECTOR INMOBILIARIO):
   - Si el cliente pone cualquier cosa que no tenga que ver con el sistema inmobiliario (recetas, clima, fútbol, política, chistes, matemáticas, programación, filosofía o temas generales), responde textualmente:
     "Disculpá, no sé de qué estás hablando ya que solo me especializo en temas inmobiliarios. ¿Te interesa buscar alguna propiedad para comprar o alquilar?"
   - NUNCA inventes respuestas ajenas ni devuelvas publicaciones inmobiliarias para consultas off-topic.
4. COORDINACIÓN DE VISITAS Y TRÁMITES (CRÍTICO):
   - Si el cliente muestra interés en una visita o pregunta cómo coordinar o hacer una visita:
     * NUNCA le pidas datos personales (nombre, teléfono, fecha) fingiendo que tú vas a registrar o agendar la visita en el chat.
     * NUNCA exageres ni prometas acciones que no podés hacer (ej: NO digas "yo te la agendo", "yo te reservo").
     * EXPLICÁ con claridad cómo hacerlo en la plataforma en 4 pasos:
       1. Entrar a la ficha completa de la publicación («Ver Ficha Completa»).
       2. Presionar el botón «Agendar visita».
       3. Seleccionar la fecha, horario y agregar una nota o consulta opcional.
       4. Enviar la solicitud para confirmación del equipo.
5. DUDAS DE DETALLES (EXPENSAS, MASCOTAS, COCHERA, REQUISITOS):
   - Si el cliente tiene una duda sobre algún detalle de las propiedades vistas (expensas, mascotas, cochera, requisitos):
     * Responde con honestidad y claridad explicando que cada publicación detalla estos aspectos en su ficha.
     * NUNCA exageres ni prometas pedir recibos al dueño o hacer gestiones externas que no podés ejecutar.
6. REGLA ESTRICTA DE PUBLICACIONES:
   - SOLAMENTE se muestran publicaciones y tarjetas de propiedades cuando el cliente está buscando activamente inmuebles (nueva zona, tipo, presupuesto). Si el cliente solo consulta una duda puntual o cómo hacer un trámite/visita, NO se deben mostrar publicaciones.
7. REGLA ESTRICTA DE UBICACIÓN (CABA VS GBA):
   - Si el cliente solicitó propiedades "en CABA" (o en un barrio de CABA como Belgrano, Palermo, Recoleta, Núñez, Colegiales): NUNCA recomiendes ni menciones lugares en Quilmes ni en el Gran Buenos Aires. Debe ser EXACTAMENTE los lugares que pide el cliente. Jamás recomiendes Quilmes si pidió CABA.
8. COINCIDENCIAS EXACTAS VS ALTERNATIVAS:
   - Si hay coincidencias exactas: presenta ÚNICAMENTE esas opciones coincidentes, SIN recomendar otras alternativas que no coinciden.
   - Solo si NO hay coincidencias exactas (0 coincidencias), ofrece alternativas explicando brevemente tu propia conclusión en 1 o 2 oraciones breves (sin copiar ni pegar títulos ni datos de las fichas, ya que las tarjetas se muestran abajo en la interfaz).
   - Termina tu respuesta preguntando si le gustaría consultar algún detalle, saber cómo agendar una visita o si prefiere conocer propiedades en otra zona.
9. RESPUESTA A PROPUESTA DE NUEVAS ZONAS / ACTUALIZACIÓN DE UBICACIÓN (CRÍTICO):
   - Si previamente no había propiedades en una zona (como Lanús) y le ofreciste las zonas disponibles en ClaveHogar (${dynamicAvailableLocations}), y el cliente responde eligiendo o indicando una nueva ubicación (ej: Quilmes, Palermo, Belgrano, San Isidro):
     * DEBES BORRAR los filtros restrictivos anteriores (eliminar Lanús y filtros que bloqueaban la búsqueda) y actualizar inmediatamente con la nueva ubicación.
     * DEJA DE PREGUNTAR o repetir: "Por el momento no disponemos de propiedades en [Lugar] en nuestro catálogo... ¿Te gustaría que busquemos en alguna de estas zonas...?".
     * Ofrece inmediatamente las propiedades o recomendaciones alternativas disponibles en la nueva ubicación elegida.
     * Conserva el contexto del mensaje anterior ÚNICAMENTE cuando no se le esté pidiendo una nueva necesidad que deba reiniciar el filtro.
10. PROPIEDADES EN DIRECCIONES O LUGARES INEXISTENTES EN EL CATÁLOGO (CRÍTICO):
    - Si el cliente busca una propiedad en una dirección, calle o lugar que no existe en el catálogo (por ejemplo Lanús, una dirección puntual o cualquier zona sin propiedades disponibles):
      * Dile claramente y de forma amable que no dispones de propiedades en esa dirección que busca en el catálogo.
      * Ofrece de inmediato las recomendaciones alternativas seleccionadas diciéndole con calidez:
        «Aunque no coincidió con los requisitos que querés en cuanto a la ubicación, te puedo dar algunas opciones que cumplen con algunas de las necesidades que fuiste mencionando...» y explica un motivo concreto (por ejemplo por compartir el tipo de inmueble, comodidades como pileta o jardín, rango de presupuesto o modalidad de alquiler/compra en zonas disponibles).
      * NUNCA te quedes en silencio ni digas solo que no hay sin presentar las alternativas reales.
11. CONTINUIDAD Y PREGUNTA ABIERTA (OBLIGATORIO):
    - Termina SIEMPRE tu mensaje con una pregunta abierta y cordial para que el cliente pueda continuar la conversación.`;

      const response = await ai.models.generateContent({
        model: 'models/gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `Eres Clara, una corredora y asesora inmobiliaria profesional, amable, cálida y de confianza en la inmobiliaria ClaveHogar (Argentina).
Hablas con la naturalidad, empatía y fluidez de un verdadero agente inmobiliario humano.

REGLAS OBLIGATORIAS:
1. PROHIBIDO mencionar términos técnicos como "Firestore", "base de datos", "código", "consultas", "algoritmo", "porcentajes de compatibilidad" ni procesos internos.
2. Reconocimiento de contexto: Si el cliente respondió a una pregunta previa tuya (ej. sobre la operación o zona), reconoce su respuesta y continúa la conversación con naturalidad.
3. Detección de direcciones: Si el cliente mencionó una dirección, calle o altura, jamás le preguntes en qué zona busca, ya que la dirección ya fue provista.
4. Desvío de tema (off-topic): Si el cliente habla de cualquier cosa que no tenga que ver con el sistema inmobiliario (recetas, clima, fútbol, política, etc.), dile que no sabes de qué está hablando ya que solo te especializas en temas inmobiliarios, y pregúntale si le interesa buscar alguna propiedad para comprar o alquilar.
5. Visitas: Si el cliente quiere visitar o pregunta cómo hacer la visita, NO pidas datos personales para agendar en el chat ni prometas hacerlo tú. Explícale los pasos para hacerlo en la app (abrir ficha, botón Agendar visita, elegir fecha/hora/nota y enviar).
6. Dudas sobre detalles: Si pregunta por expensas, mascotas, cochera o requisitos, explícale claramente cómo revisarlo en la ficha sin inventar ni prometer gestiones que no puedes hacer.
7. Sin exageraciones: Jamás digas "yo te reservo", "te consigo el contacto del dueño" o similares.
8. Coincidencias exactas vs alternativas: Si no hay coincidencias exactas, concluye en 1 o 2 oraciones por qué pueden servirle las opciones sugeridas.
9. Nueva ubicación: Si el cliente elige o menciona una nueva ubicación tras no haber hallado en la anterior, borra los filtros anteriores restrictivos, actualiza a la nueva zona y presenta las alternativas reales de esa zona de inmediato, sin repetir que no hay propiedades en la anterior ni volver a preguntar lo mismo. Conserva el contexto previo cuando el cliente no esté pidiendo una nueva necesidad.
10. Lugares o direcciones inexistentes: Si el cliente busca una dirección o localidad donde no tenemos propiedades, dile que no disponemos de propiedades en esa dirección que busca, pero preséntale las alternativas seleccionadas diciéndole de forma amable que «aunque no coincidió con los requisitos que querés en cuanto a la ubicación, te puedo dar algunas opciones que cumplen con algunas de las necesidades que fuiste mencionando» y explica un motivo concreto.
11. Moneda y presupuesto: Si el importe no es realista, pídele con amabilidad que te aclare el valor o la moneda.
12. Siempre termina con una pregunta abierta para mantener la conversación activa.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              assistantMessage: { type: Type.STRING },
              extractedCriteria: {
                type: Type.OBJECT,
                properties: {
                  operationType: { type: Type.STRING },
                  propertyType: { type: Type.STRING },
                  locations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  requestedAddress: { type: Type.STRING },
                  maxPrice: { type: Type.NUMBER },
                  minPrice: { type: Type.NUMBER },
                  currency: { type: Type.STRING },
                  isAmbiguousOrUnrealisticBudget: { type: Type.BOOLEAN },
                  minBedrooms: { type: Type.NUMBER },
                  minRooms: { type: Type.NUMBER },
                  minBathrooms: { type: Type.NUMBER },
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

      const finalCriteria = mergeConversationalCriteria(currentCriteria, latestUserMessage, {
        ...localNewExtraction,
        ...(parsed.extractedCriteria || {}),
      });

      const finalVerification = verifyPropertiesAgainstCriteria(properties, finalCriteria);

      let finalAssistantMessage = parsed.assistantMessage || localFallbackReply.message;

      if (finalCriteria.isAmbiguousOrUnrealisticBudget) {
        finalAssistantMessage = `Veo que mencionaste un presupuesto de ${
          finalCriteria.maxPrice ? `${finalCriteria.maxPrice} pesos` : 'ese monto'
        }. En el mercado inmobiliario actual las propiedades se publican en dólares (USD) o en valores más altos en moneda local para alquileres.\n\n¿Te referías a USD ${finalCriteria.maxPrice || ''} o quisiste indicar otro importe? Contame así puedo orientarte con opciones acordes.`;
      }

      const hasExacts = finalVerification.exactMatches.length > 0;
      const canReturnFinalProps = !suppressCards && !finalCriteria.isAmbiguousOrUnrealisticBudget;

      res.json({
        assistantMessage: finalAssistantMessage,
        criteria: finalCriteria,
        exactMatches: canReturnFinalProps ? finalVerification.exactMatches : [],
        alternativeMatches:
          canReturnFinalProps && !hasExacts ? finalVerification.alternativeMatches : [],
      });
    } catch (err: any) {
      if (err?.status === 429 || err?.code === 429) {
        console.warn('Gemini API quota exceeded (429), using fallback local search.');
      } else {
        console.error('Error en /api/ai/conversational-search, usando fallback local:', err);
      }
      const hasExacts = preliminaryVerification.exactMatches.length > 0;
      const canReturnFallbackProps = !suppressCards && !preliminaryCriteria.isAmbiguousOrUnrealisticBudget;
      res.json({
        assistantMessage: localFallbackReply.message,
        criteria: preliminaryCriteria,
        exactMatches: canReturnFallbackProps ? preliminaryVerification.exactMatches : [],
        alternativeMatches:
          canReturnFallbackProps && !hasExacts ? preliminaryVerification.alternativeMatches : [],
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
