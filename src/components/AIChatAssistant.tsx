import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Info,
  Sparkles,
  Bot,
} from 'lucide-react';
import { PropertyItem, UserProfile } from '../types';
import { HERO_IMAGE } from '../data/initialData';
import {
  ExtractedSearchCriteria,
  ChatMessageItem,
  PropertyMatchAlternative,
  extractCriteriaLocally,
  verifyPropertiesAgainstCriteria,
  buildAgentConversationReply,
  hasSufficientCriteriaToSearch,
  mergeConversationalCriteria,
  isGreetingOrNonPropertyMessage,
  analyzeOffTopicIntent,
  shouldSuppressPropertyCards,
  setKnownCatalogProperties,
  asksForKnownSearchCriteria,
} from '../utils/aiConversationalAgent';

interface AIChatAssistantProps {
  properties: PropertyItem[];
  onSelectProperty: (property: PropertyItem) => void;
  onGoToCatalog: () => void;
  initialPrompt?: string;
  currentUser?: UserProfile | null;
}

const CLARA_AVATAR_URL = 'https://framerusercontent.com/images/EZuuEf9dxVrkBeIz7bQp6oHcyI.jpg?width=1024&height=1024';

const INITIAL_GREETING: ChatMessageItem = {
  id: 'msg_welcome',
  role: 'assistant',
  content:
    '¡Hola! Soy Clara, tu asesora inmobiliaria personal en ClaveHogar. Estoy para acompañarte como un agente de confianza.\n\nContame con tus propias palabras qué tipo de propiedad estás buscando (por ejemplo: si buscás comprar o alquilar, en qué localidad o barrio, qué presupuesto estimás y qué comodidades como pileta, jardín o cochera te interesan).',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  properties,
  onSelectProperty,
  onGoToCatalog,
  initialPrompt,
  currentUser,
}) => {
  const userKey = currentUser?.uid ? `user_${currentUser.uid}` : 'guest';
  const storageKeyHistory = `clavehogar_ai_chat_history_${userKey}`;
  const storageKeyCriteria = `clavehogar_ai_chat_criteria_${userKey}`;

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKeyHistory);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [INITIAL_GREETING];
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentCriteria, setCurrentCriteria] = useState<ExtractedSearchCriteria>(() => {
    try {
      const saved = localStorage.getItem(storageKeyCriteria);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  });
  const initialPromptRanRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al cambiar el usuario logueado o pasar a invitado, recargar su historial correspondiente
  const prevUserKeyRef = useRef(userKey);
  useEffect(() => {
    if (prevUserKeyRef.current !== userKey) {
      prevUserKeyRef.current = userKey;
      try {
        const savedHistory = localStorage.getItem(storageKeyHistory);
        if (savedHistory) {
          const parsed = JSON.parse(savedHistory);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else {
            setMessages([INITIAL_GREETING]);
          }
        } else {
          setMessages([INITIAL_GREETING]);
        }

        const savedCriteria = localStorage.getItem(storageKeyCriteria);
        if (savedCriteria) {
          const parsed = JSON.parse(savedCriteria);
          if (parsed && typeof parsed === 'object') {
            setCurrentCriteria(parsed);
          } else {
            setCurrentCriteria({});
          }
        } else {
          setCurrentCriteria({});
        }
      } catch {
        setMessages([INITIAL_GREETING]);
        setCurrentCriteria({});
      }
    }
  }, [userKey, storageKeyHistory, storageKeyCriteria]);

  // Persistir automáticamente el historial del usuario activo
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKeyHistory, JSON.stringify(messages));
      }
    } catch {}
  }, [messages, storageKeyHistory]);

  // Sincronizar catálogo real de Firestore en memoria para respuestas dinámicas de zonas
  useEffect(() => {
    if (Array.isArray(properties) && properties.length > 0) {
      setKnownCatalogProperties(properties);
    }
  }, [properties]);

  // Persistir criterios acumulados del usuario activo
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyCriteria, JSON.stringify(currentCriteria));
    } catch {}
  }, [currentCriteria, storageKeyCriteria]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && !initialPromptRanRef.current) {
      initialPromptRanRef.current = true;
      handleSendMessage(initialPrompt.trim());
    }
  }, [initialPrompt]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isLoading) return;

    setInputValue('');

    const userMessage: ChatMessageItem = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const payloadMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Timeout con AbortController de 20 segundos para permitir respuesta fluida de Gemini
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let serverResponseData: {
        assistantMessage: string;
        criteria: ExtractedSearchCriteria;
        exactMatches: PropertyItem[];
        alternativeMatches: PropertyMatchAlternative[];
      } | null = null;

      try {
        const response = await fetch('/api/ai/conversational-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            currentCriteria,
            properties,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const recognizedCriteria = mergeConversationalCriteria(
            currentCriteria, text, extractCriteriaLocally(text, currentCriteria)
          );
          // Si el servidor vuelve a pedir datos ya dados, usar la búsqueda
          // local sobre el mismo catálogo de Firestore en lugar de repetirlos.
          if (json && json.assistantMessage &&
              !asksForKnownSearchCriteria(json.assistantMessage, recognizedCriteria)) {
            serverResponseData = json;
          }
        }
      } catch {
        clearTimeout(timeoutId);
        // Fallback local instantáneo
      }

      // Si el servidor no respondió a tiempo o falló, procesar con el motor determinístico local
      if (!serverResponseData) {
        const offTopic = analyzeOffTopicIntent(text, currentCriteria);
        if (offTopic.isOffTopic) {
          serverResponseData = {
            assistantMessage:
              offTopic.reply ||
              'Disculpá, no sé de qué estás hablando ya que solo me especializo en temas inmobiliarios. ¿Te interesa buscar alguna propiedad para comprar o alquilar?',
            criteria: { resetTriggered: true },
            exactMatches: [],
            alternativeMatches: [],
          };
        } else {
          const isGreetingOrOffTopic = isGreetingOrNonPropertyMessage(text);
          const isPureGreeting = isGreetingOrOffTopic && !offTopic.isOffTopic;
          const localCriteria = extractCriteriaLocally(text, currentCriteria);
          const mergedCriteria = mergeConversationalCriteria(currentCriteria, text, localCriteria);
          const hasSufficient = hasSufficientCriteriaToSearch(mergedCriteria);

          const suppressCards = shouldSuppressPropertyCards(text, mergedCriteria);
          const canReturnProps =
            !isPureGreeting &&
            hasSufficient &&
            !suppressCards &&
            !mergedCriteria.isExploringOtherZones &&
            !mergedCriteria.resetTriggered;

          const verification =
            canReturnProps
              ? verifyPropertiesAgainstCriteria(properties, mergedCriteria)
              : { exactMatches: [], alternativeMatches: [], criteria: mergedCriteria };
          const reply = buildAgentConversationReply(text, currentCriteria, mergedCriteria, verification, properties);

          serverResponseData = {
            assistantMessage: reply.message,
            criteria: mergedCriteria.resetTriggered || isPureGreeting ? { resetTriggered: true } : mergedCriteria,
            exactMatches: canReturnProps ? verification.exactMatches : [],
            alternativeMatches:
              canReturnProps && verification.exactMatches.length === 0
                ? verification.alternativeMatches
                : [],
          };
        }
      }

      if (serverResponseData.criteria?.resetTriggered || !serverResponseData.criteria || Object.keys(serverResponseData.criteria).length === 0) {
        setCurrentCriteria({});
        try {
          localStorage.removeItem(storageKeyCriteria);
        } catch {}
      } else {
        setCurrentCriteria(serverResponseData.criteria);
        try {
          localStorage.setItem(storageKeyCriteria, JSON.stringify(serverResponseData.criteria));
        } catch {}
      }

      const assistantMessageItem: ChatMessageItem = {
        id: `msg_assistant_${Date.now()}`,
        role: 'assistant',
        content: serverResponseData.assistantMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        exactMatches: serverResponseData.exactMatches,
        alternativeMatches: serverResponseData.alternativeMatches,
        activeCriteria: serverResponseData.criteria,
      };

      setMessages((prev) => [...prev, assistantMessageItem]);
    } catch (err) {
      console.error('Error enviando mensaje al asistente:', err);
      // Mensaje de rescate cálido
      const fallbackMsg: ChatMessageItem = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content:
          'Tuve una pequeña dificultad técnica con la conexión, pero sigo acá con vos. ¿Podrías reiterarme qué tipo de propiedad o zona te interesa para verificar en el catálogo?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleResetConversation = () => {
    setCurrentCriteria({});
    setMessages([
      {
        ...INITIAL_GREETING,
        id: `msg_welcome_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputValue('');
    try {
      localStorage.removeItem(storageKeyHistory);
      localStorage.removeItem(storageKeyCriteria);
    } catch {}
  };

  const hasActiveCriteria =
    Boolean(currentCriteria.propertyType) ||
    Boolean(currentCriteria.locations && currentCriteria.locations.length > 0) ||
    Boolean(currentCriteria.maxPrice) ||
    Boolean(currentCriteria.requiredFeatures && currentCriteria.requiredFeatures.length > 0);

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F6F1] overflow-hidden">
      {/* 1. Header Superior Full-Width Diferenciado del Nav */}
      <header className="bg-[#173B43] text-[#F4EFE6] border-b border-[#D5BFA0]/50 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="relative">
           <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-[#F8F6F1] flex items-center justify-center shadow-sm shrink-0">
        <img 
          src={CLARA_AVATAR_URL} 
          alt="Clara Asesora" 
          className="w-full h-full object-cover" // <-- Estas clases ajustan la imagen
        />
      </div>
            <span
              className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#173B43] rounded-full"
              title="En línea · Asesoramiento en tiempo real"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-serif-display font-semibold text-[#F4EFE6]">
                Clara · Asesora Inmobiliaria
              </h1>
              <span className="text-[10px] bg-[#2B2B2B]/40 text-emerald-200 border border-emerald-500/50 px-2 py-0.5 rounded-full font-medium hidden sm:inline">
                En línea
              </span>
            </div>
            <p className="text-xs text-[#F4EFE6]/80 line-clamp-1">
              Asesoramiento personalizado en tiempo real · Consultá propiedades, zonas, requisitos y visitas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetConversation}
            className="px-3 py-2 text-xs uppercase tracking-wider font-semibold text-[#F4EFE6] bg-[#173B43] hover:bg-[#3d4538] border border-[#D5BFA0]/60 rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Reiniciar diálogo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nueva charla</span>
          </button>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-3.5 py-2 text-xs uppercase tracking-wider font-semibold text-[#173B43] bg-[#F8F6F1] hover:bg-[#D6CBB8] rounded-sm transition-colors cursor-pointer shadow-xs"
          >
            Catálogo
          </button>
        </div>
      </header>

      {/* 2. Barra de Preferencias Recordadas (Full-Width, compacta) */}
      {hasActiveCriteria && (
        <div className="bg-[#F8F6F1] border-b border-[#D5BFA0] px-4 sm:px-8 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 animate-fade-slide">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#173B43] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#C87955]" />
              Preferencias activas:
            </span>
            {currentCriteria.operationType && (
              <span className="bg-white border border-[#D5BFA0] px-2.5 py-0.5 rounded-full text-[#303638] capitalize font-medium">
                {currentCriteria.operationType}
              </span>
            )}
            {currentCriteria.propertyType && (
              <span className="bg-white border border-[#D5BFA0] px-2.5 py-0.5 rounded-full text-[#303638] capitalize font-medium">
                Tipo: {currentCriteria.propertyType}
              </span>
            )}
            {currentCriteria.locations && currentCriteria.locations.length > 0 && (
              <span className="bg-white border border-[#D5BFA0] px-2.5 py-0.5 rounded-full text-[#303638] font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#C87955]" />
                {currentCriteria.locations.join(', ')}
              </span>
            )}
            {currentCriteria.maxPrice && (
              <span className="bg-white border border-[#D5BFA0] px-2.5 py-0.5 rounded-full text-[#303638] font-medium font-tabular">
                Hasta USD {currentCriteria.maxPrice.toLocaleString()}
              </span>
            )}
            {currentCriteria.requiredFeatures && currentCriteria.requiredFeatures.length > 0 && (
              <span className="bg-white border border-[#D5BFA0] px-2.5 py-0.5 rounded-full text-[#303638] font-medium">
                Comodidades: {currentCriteria.requiredFeatures.join(', ')}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCurrentCriteria({})}
            className="text-[11px] text-[#C87955] hover:underline font-semibold cursor-pointer shrink-0"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* 3. Área Principal de Mensajes en Pantalla Completa (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 w-full">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-[#D5BFA0] shrink-0 shadow-xs mt-1 bg-[#173B43]">
                    <img
                      src={CLARA_AVATAR_URL}
                      alt="Clara Asesora"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div
                  className={`space-y-3 w-full max-w-[92%] sm:max-w-[85%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Globo de Texto */}
                  <div
                    className={`rounded-2xl p-4 sm:p-5 text-sm leading-relaxed transition-all ${
                      isUser
                        ? 'bg-[#173B43] text-white shadow-xs ml-auto'
                        : 'bg-white text-[#303638] border border-[#D5BFA0] shadow-2xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#D5BFA0]/50 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#173B43]">
                          Clara · Asesora Inmobiliaria
                        </span>
                        <span className="text-[10px] text-[#173B43]/60 font-tabular">
                          {msg.timestamp}
                        </span>
                      </div>
                    )}

                    <div className="whitespace-pre-line text-[14.5px]">
                      {msg.content}
                    </div>

                    {isUser && (
                      <div className="text-[10px] text-[#FCFBF7]/70 text-right font-tabular mt-1">
                        {msg.timestamp}
                      </div>
                    )}
                  </div>

                  {/* 1. SECCIÓN DE COINCIDENCIAS DESTACADAS */}
                  {!isUser && msg.exactMatches && msg.exactMatches.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] px-3.5 py-2 rounded-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Coincidencias encontradas ({msg.exactMatches.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {msg.exactMatches.map((prop) => (
                          <div
                            key={prop.id}
                            className="bg-[#FCFBF7] border-2 border-[#173B43] rounded-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                          >
                            <div>
                              <div className="relative aspect-[16/10] bg-[#F8F6F1]">
                                <img
                                  src={prop.images[0] || HERO_IMAGE}
                                  alt={prop.title}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    if (e.currentTarget.src !== HERO_IMAGE) {
                                      e.currentTarget.src = HERO_IMAGE;
                                    }
                                  }}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-[#173B43] text-[#FCFBF7] text-[11px] font-bold rounded-sm shadow-xs flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Coincidencia destacada
                                </div>
                                <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-[#1F241F]/80 backdrop-blur-xs text-[#FCFBF7] text-xs font-bold font-tabular rounded-sm">
                                  {prop.currency} {prop.price.toLocaleString()}
                                </div>
                              </div>

                              <div className="p-4 space-y-2">
                                <div className="text-[11px] uppercase tracking-wider font-semibold text-[#B86F52] flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{prop.location}</span>
                                </div>
                                <h3 className="text-base font-serif-display font-semibold text-[#1F241F] line-clamp-2 leading-snug">
                                  {prop.title}
                                </h3>
                                <p className="text-xs text-[#1F241F]/75 line-clamp-2 leading-relaxed">
                                  {prop.description}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-[#173B43] font-tabular">
                                  <span>{prop.bedrooms} dorm.</span>
                                  <span>·</span>
                                  <span>{prop.bathrooms} baños</span>
                                  <span>·</span>
                                  <span>{prop.surface} m²</span>
                                </div>

                                {prop.features && prop.features.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1.5">
                                    {prop.features.slice(0, 3).map((feat, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] bg-[#F8F6F1] border border-[#D5BFA0] text-[#173B43] px-2 py-0.5 rounded-sm"
                                      >
                                        {feat}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="p-4 pt-0">
                              <button
                                type="button"
                                onClick={() => onSelectProperty(prop)}
                                className="w-full py-2.5 px-3 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Ver Ficha Completa
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. SECCIÓN DE OPCIONES SUGERIDAS (Alternativas con nota humana) */}
                  {!isUser && msg.alternativeMatches && msg.alternativeMatches.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900 bg-amber-50 border border-amber-300 px-3.5 py-2 rounded-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Opciones sugeridas para tener en cuenta ({msg.alternativeMatches.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {msg.alternativeMatches.map((alt) => {
                          const prop = alt.property;
                          return (
                            <div
                              key={prop.id}
                              className="bg-[#FCFBF7] border border-amber-300 rounded-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                            >
                              <div>
                                <div className="relative aspect-[16/10] bg-[#F8F6F1]">
                                  <img
                                    src={prop.images[0] || HERO_IMAGE}
                                    alt={prop.title}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      if (e.currentTarget.src !== HERO_IMAGE) {
                                        e.currentTarget.src = HERO_IMAGE;
                                      }
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-amber-700 text-[#FCFBF7] text-[11px] font-bold rounded-sm shadow-xs flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Alternativa afín
                                  </div>
                                  <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-[#1F241F]/80 backdrop-blur-xs text-[#FCFBF7] text-xs font-bold font-tabular rounded-sm">
                                    {prop.currency} {prop.price.toLocaleString()}
                                  </div>
                                </div>

                                <div className="p-4 space-y-2">
                                  <div className="text-[11px] uppercase tracking-wider font-semibold text-[#B86F52] flex items-center gap-1">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{prop.location}</span>
                                  </div>

                                  <h3 className="text-base font-serif-display font-semibold text-[#1F241F] line-clamp-2 leading-snug">
                                    {prop.title}
                                  </h3>

                                  {/* Nota explicativa de Clara */}
                                  <div className="p-3 bg-amber-50/90 border-l-2 border-amber-500 rounded-r-sm space-y-1 text-xs">
                                    <div className="font-semibold text-amber-900 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                      <span>Nota de Clara:</span>
                                    </div>
                                    <p className="text-amber-950 text-xs font-medium leading-snug">
                                      {alt.humanDifferenceNote}
                                    </p>
                                    {alt.whyRecommendNote && (
                                      <p className="text-amber-800/90 text-[11px] pt-0.5">
                                        Puntos a favor: {alt.whyRecommendNote}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-[#173B43] font-tabular">
                                    <span>{prop.bedrooms} dorm.</span>
                                    <span>·</span>
                                    <span>{prop.bathrooms} baños</span>
                                    <span>·</span>
                                    <span>{prop.surface} m²</span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 pt-0">
                                <button
                                  type="button"
                                  onClick={() => onSelectProperty(prop)}
                                  className="w-full py-2.5 px-3 text-xs uppercase tracking-widest font-semibold text-[#173B43] bg-[#F8F6F1] hover:bg-[#173B43] hover:text-[#FCFBF7] border border-[#D5BFA0] rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  Ver Ficha Completa
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Indicador de respuesta de Clara */}
          {isLoading && (
            <div className="flex gap-3.5 justify-start items-center">
              <div className="w-9 h-9 rounded-full bg-[#173B43] text-[#FCFBF7] flex items-center justify-center shrink-0 font-serif-display font-bold text-sm shadow-xs">
                C
              </div>
              <div className="bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm px-4 py-3 flex items-center gap-2.5 text-xs text-[#173B43]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#173B43] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-[#173B43] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-[#173B43] animate-bounce" />
                </div>
                <span className="font-medium">Clara está analizando las opciones y redactando su respuesta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 4. Barra de Entrada Destacada con Fondo Elegante */}
      <footer className="w-full bg-gradient-to-t from-[#EAE2D5] via-[#F4EFE6] to-[#F4EFE6] border-t-2 border-[#D5BFA0] p-4 sm:p-5 shrink-0 sticky bottom-0 z-10 shadow-lg">
        <div className="max-w-4xl mx-auto space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="card-floating bg-white border-2 border-[#D5BFA0] hover:border-[#173B43]/60 focus-within:border-[#173B43] focus-within:ring-4 focus-within:ring-[#173B43]/15 rounded-2xl p-2 sm:p-2.5 shadow-md flex items-center gap-3 transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribile a Clara (ej: Busco casa en alquiler en Belgrano de aprox 2000 usd)..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm bg-transparent text-[#303638] focus:outline-none placeholder:text-[#303638]/50 font-medium disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-3 text-xs uppercase tracking-wider font-bold text-white bg-[#173B43] hover:bg-[#122e35] rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 shadow-xs"
            >
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-[#303638]/75 px-1.5 font-medium">
            <span>Presioná Enter para enviar. Consultale sobre características, barrios, visitas y presupuestos.</span>
            <span className="hidden sm:inline text-[#173B43] font-semibold">Curaduría ClaveHogar · Clara</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
