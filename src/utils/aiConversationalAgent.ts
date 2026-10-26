import { PropertyItem } from '../types';

export type CurrencyCode = 'USD' | 'ARS';

export interface ExtractedSearchCriteria {
  operationType?: 'venta' | 'alquiler' | null;
  propertyType?: string | null; // e.g. 'casa', 'departamento', 'ph', 'terreno', 'oficina'
  locations?: string[]; // e.g. ['Quilmes'], ['Palermo', 'Belgrano']
  maxPrice?: number | null;
  minPrice?: number | null;
  currency?: CurrencyCode | null;
  isAmbiguousOrUnrealisticBudget?: boolean;
  unrealisticBudgetReason?: string;
  minBedrooms?: number | null;
  minRooms?: number | null;
  requiredFeatures?: string[]; // e.g. ['pileta', 'cochera', 'jardin', 'parrilla', 'balcon', 'mascotas']
  summary?: string;
  isGeneralInquiry?: boolean;
}

export interface PropertyMatchAlternative {
  property: PropertyItem;
  score: number;
  humanDifferenceNote: string;
  whyRecommendNote: string;
  missingReasons: string[];
  matchedCriteria: string[];
  explanation: string;
}

export interface StrictVerificationResult {
  exactMatches: PropertyItem[];
  alternativeMatches: PropertyMatchAlternative[];
  criteria: ExtractedSearchCriteria;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  exactMatches?: PropertyItem[];
  alternativeMatches?: PropertyMatchAlternative[];
  activeCriteria?: ExtractedSearchCriteria;
}

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const CABA_SUBURBS = [
  'palermo',
  'belgrano',
  'recoleta',
  'puerto madero',
  'nunez',
  'colegiales',
  'caballito',
  'villa urquiza',
  'villa crespo',
  'almagro',
  'flores',
  'floresta',
  'devoto',
  'villa devoto',
  'san telmo',
  'barracas',
  'la boca',
  'boca',
  'retiro',
  'microcentro',
  'centro',
  'monserrat',
  'san nicolas',
  'balvanera',
  'once',
  'abasto',
  'boedo',
  'san cristobal',
  'parque patricios',
  'chacarita',
  'paternal',
  'villa del parque',
  'saavedra',
  'coghlan',
  'villa ortuzar',
  'agronomia',
  'liniers',
  'mataderos',
  'villa lugano',
  'pompeya',
  'constitucion',
  'congreso',
];

export const GBA_ZONES: Record<string, string[]> = {
  sur: [
    'quilmes',
    'bernal',
    'avellaneda',
    'lanus',
    'lomas de zamora',
    'banfield',
    'temperley',
    'adrogue',
    'berazategui',
    'wilde',
    'don bosco',
    'ezpeleta',
  ],
  norte: [
    'san isidro',
    'vicente lopez',
    'olivos',
    'martinez',
    'tigre',
    'san fernando',
    'pilar',
    'escobar',
    'acassuso',
    'beccar',
  ],
  oeste: [
    'moron',
    'ramos mejia',
    'castelar',
    'ituzaingo',
    'haedo',
    'ciudadela',
    'hurlingham',
    'san justo',
  ],
};

/**
 * Normaliza y compara tipos de propiedades con flexibilidad ponderada
 */
export function matchesPropertyType(propType: string, requestedType?: string | null): {
  isExact: boolean;
  isCompatible: boolean;
} {
  if (!requestedType) return { isExact: true, isCompatible: true };
  const pNorm = normalizeText(propType);
  const rNorm = normalizeText(requestedType);

  if (rNorm.includes('casa') || rNorm.includes('chalet') || rNorm.includes('villa')) {
    if (pNorm.includes('casa') || pNorm.includes('chalet') || pNorm.includes('villa')) {
      return { isExact: true, isCompatible: true };
    }
    // Dúplex, triplex y PH en dos plantas ofrecen amplitud y habitabilidad tipo casa
    if (
      pNorm.includes('duplex') ||
      pNorm.includes('duplex') ||
      pNorm.includes('triplex') ||
      pNorm.includes('ph') ||
      pNorm.includes('loft')
    ) {
      return { isExact: false, isCompatible: true };
    }
    return { isExact: false, isCompatible: false };
  }

  if (
    rNorm.includes('departamento') ||
    rNorm.includes('depto') ||
    rNorm.includes('piso') ||
    rNorm.includes('monoambiente') ||
    rNorm.includes('loft') ||
    rNorm.includes('penthouse')
  ) {
    if (
      pNorm.includes('departamento') ||
      pNorm.includes('loft') ||
      pNorm.includes('suite') ||
      pNorm.includes('penthouse') ||
      pNorm.includes('piso') ||
      pNorm.includes('semipiso')
    ) {
      return { isExact: true, isCompatible: true };
    }
    if (pNorm.includes('ph') || pNorm.includes('duplex')) {
      return { isExact: false, isCompatible: true };
    }
    return { isExact: false, isCompatible: false };
  }

  if (rNorm.includes('duplex') || rNorm.includes('dúplex')) {
    if (pNorm.includes('duplex') || pNorm.includes('dúplex')) {
      return { isExact: true, isCompatible: true };
    }
    if (pNorm.includes('casa') || pNorm.includes('ph') || pNorm.includes('loft')) {
      return { isExact: false, isCompatible: true };
    }
    return { isExact: false, isCompatible: false };
  }

  if (rNorm.includes('ph')) {
    if (pNorm.includes('ph')) return { isExact: true, isCompatible: true };
    if (pNorm.includes('casa') || pNorm.includes('duplex')) return { isExact: false, isCompatible: true };
    return { isExact: false, isCompatible: false };
  }

  if (rNorm.includes('terreno') || rNorm.includes('lote')) {
    return {
      isExact: pNorm.includes('terreno') || pNorm.includes('lote'),
      isCompatible: pNorm.includes('terreno') || pNorm.includes('lote'),
    };
  }

  if (rNorm.includes('oficina') || rNorm.includes('local') || rNorm.includes('comercial')) {
    return {
      isExact: pNorm.includes('oficina') || pNorm.includes('local') || pNorm.includes('estudio'),
      isCompatible: pNorm.includes('oficina') || pNorm.includes('local') || pNorm.includes('estudio'),
    };
  }

  const exact = pNorm.includes(rNorm);
  return { isExact: exact, isCompatible: exact };
}

/**
 * Normaliza y verifica coincidencias de ubicación (1. Ubicación solicitada)
 */
export function evaluateLocation(
  prop: PropertyItem,
  requestedLocations?: string[]
): {
  isExact: boolean;
  isNearby: boolean;
  isDistant: boolean;
  locationLabel: string;
} {
  if (!requestedLocations || requestedLocations.length === 0) {
    return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
  }

  const propText = normalizeText(`${prop.location} ${prop.address}`);

  for (const loc of requestedLocations) {
    const locNorm = normalizeText(loc);
    if (!locNorm) continue;

    // Caso A: Coincidencia directa de la localidad o barrio
    if (propText.includes(locNorm)) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }

    // Caso B: Búsqueda general en CABA / Capital Federal
    if (
      locNorm === 'caba' ||
      locNorm === 'capital' ||
      locNorm === 'capital federal' ||
      locNorm === 'ciudad de buenos aires' ||
      locNorm === 'buenos aires'
    ) {
      const isCaba =
        propText.includes('caba') ||
        propText.includes('capital federal') ||
        CABA_SUBURBS.some((sub) => propText.includes(sub));
      if (isCaba) {
        return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
      }
    }

    // Caso C: Zonas regionales de GBA
    if (locNorm.includes('zona sur') && GBA_ZONES.sur.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }
    if (locNorm.includes('zona norte') && GBA_ZONES.norte.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }
    if (locNorm.includes('zona oeste') && GBA_ZONES.oeste.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }

    // Caso D: Alternativa de cercanía (misma zona regional o barrio vecino)
    const isRequestedInSur = GBA_ZONES.sur.includes(locNorm);
    const isPropInSur = GBA_ZONES.sur.some((s) => propText.includes(s));
    if (isRequestedInSur && isPropInSur) {
      return {
        isExact: false,
        isNearby: true,
        isDistant: false,
        locationLabel: `Zona Sur (cercana a ${loc})`,
      };
    }

    const isRequestedInNorte = GBA_ZONES.norte.includes(locNorm);
    const isPropInNorte = GBA_ZONES.norte.some((s) => propText.includes(s));
    if (isRequestedInNorte && isPropInNorte) {
      return {
        isExact: false,
        isNearby: true,
        isDistant: false,
        locationLabel: `Zona Norte (cercana a ${loc})`,
      };
    }

    const isRequestedInCaba = CABA_SUBURBS.includes(locNorm);
    const isPropInCaba = CABA_SUBURBS.some((s) => propText.includes(s));
    if (isRequestedInCaba && isPropInCaba) {
      return {
        isExact: false,
        isNearby: true,
        isDistant: false,
        locationLabel: `CABA (barrio cercano)`,
      };
    }
  }

  // Si no coincide y no es cercana, es una zona lejana/incompatible
  return { isExact: false, isNearby: false, isDistant: true, locationLabel: prop.location };
}

/**
 * Normaliza y verifica comodidades (pileta, cochera, parrilla, jardín, etc.)
 */
export function checkFeature(prop: PropertyItem, feature: string): boolean {
  const featNorm = normalizeText(feature);
  const propText = normalizeText(
    `${prop.title} ${prop.description} ${(prop.features || []).join(' ')}`
  );

  if (featNorm.includes('pileta') || featNorm.includes('piscina')) {
    return propText.includes('pileta') || propText.includes('piscina');
  }
  if (featNorm.includes('cochera') || featNorm.includes('garage') || featNorm.includes('estacionamiento')) {
    return propText.includes('cochera') || propText.includes('garage') || propText.includes('estacionamiento');
  }
  if (featNorm.includes('jardin') || featNorm.includes('parque') || featNorm.includes('fondo') || featNorm.includes('verde')) {
    return propText.includes('jardin') || propText.includes('parque') || propText.includes('fondo');
  }
  if (featNorm.includes('parrilla') || featNorm.includes('quincho')) {
    return propText.includes('parrilla') || propText.includes('quincho');
  }
  if (featNorm.includes('balcon') || featNorm.includes('terraza')) {
    return propText.includes('balcon') || propText.includes('terraza');
  }
  if (featNorm.includes('mascota')) {
    return propText.includes('mascota') || propText.includes('pet friendly');
  }
  if (featNorm.includes('seguridad')) {
    return propText.includes('seguridad') || propText.includes('vigilancia');
  }
  if (featNorm.includes('losa') || featNorm.includes('calefaccion')) {
    return propText.includes('losa') || propText.includes('calefaccion');
  }

  return propText.includes(featNorm);
}

/**
 * Analizador estricto de presupuesto, monedas y valores poco realistas
 */
export function parseBudgetAndCurrency(query: string): {
  minPrice: number | null;
  maxPrice: number | null;
  currency: CurrencyCode | null;
  isAmbiguousOrUnrealistic: boolean;
  unrealisticReason?: string;
} {
  const qNorm = normalizeText(query);

  let currency: CurrencyCode | null = null;
  const mentionsPesos =
    qNorm.includes('peso') ||
    qNorm.includes('pesos') ||
    qNorm.includes('ars') ||
    qNorm.includes('moneda nacional');
  const mentionsDolares =
    qNorm.includes('dolar') ||
    qNorm.includes('dolares') ||
    qNorm.includes('usd') ||
    qNorm.includes('u$s') ||
    qNorm.includes('us$') ||
    qNorm.includes('verdes');

  if (mentionsPesos && !mentionsDolares) {
    currency = 'ARS';
  } else if (mentionsDolares) {
    currency = 'USD';
  }

  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // 1. Detección de rangos: "entre 1000 a 2000", "entre 100 mil y 200 mil"
  const rangeMatch = qNorm.match(
    /(?:entre|de|desde)\s*(?:usd|\$|u\$s)?\s*(\d+[\d\.]*)\s*(mil|k|millon|millones)?\s*(?:a|y|hasta|-)\s*(?:usd|\$|u\$s)?\s*(\d+[\d\.]*)\s*(mil|k|millon|millones)?/i
  );
  if (rangeMatch) {
    const raw1 = parseFloat(rangeMatch[1].replace(/\./g, ''));
    const mult1 = rangeMatch[2]?.toLowerCase().startsWith('mil') || rangeMatch[2]?.toLowerCase() === 'k' ? 1000 : 1;
    const raw2 = parseFloat(rangeMatch[3].replace(/\./g, ''));
    const mult2 = rangeMatch[4]?.toLowerCase().startsWith('mil') || rangeMatch[4]?.toLowerCase() === 'k' ? 1000 : 1;

    let p1 = raw1 * mult1;
    let p2 = raw2 * mult2;
    // Si dijo "entre 10 a 15 mil"
    if (mult2 === 1000 && mult1 === 1 && p1 < 1000) {
      p1 = p1 * 1000;
    }
    if (!isNaN(p1) && !isNaN(p2)) {
      minPrice = Math.min(p1, p2);
      maxPrice = Math.max(p1, p2);
    }
  }

  // 2. Detección de precio máximo con palabras clave explícitas de precio o moneda
  if (!maxPrice) {
    const explicitPriceRegexes = [
      /(?:hasta|maximo|presupuesto(?: de)?|menos de|tope(?: de)?|valor(?: de)?|precio(?: de)?|aproximadamente|alrededor de|cerca de|unos)\s*(?:usd|\$|u\$s)?\s*(\d+[\d\.]*)\s*(mil|k|millon|millones)?\s*(?:dolares|dolar|usd|u\$s|pesos|ars|\$)?/i,
      /(?:usd|\$|u\$s)\s*(\d+[\d\.]*)\s*(mil|k|millon|millones)?/i,
      /(\d+[\d\.]*)\s*(mil|k|millon|millones)?\s*(?:dolares|dolar|usd|u\$s|pesos|ars)/i,
    ];

    for (const rx of explicitPriceRegexes) {
      const match = qNorm.match(rx);
      if (match && match[1]) {
        const rawNum = parseFloat(match[1].replace(/\./g, ''));
        const unit = match[2]?.toLowerCase();
        let val = rawNum;

        if (unit && (unit.startsWith('mil') || unit === 'k')) {
          val = val * 1000;
        } else if (unit && unit.startsWith('millon')) {
          val = val * 1000000;
        } else if (val < 1000 && (qNorm.includes(' mil') || qNorm.includes('k '))) {
          val = val * 1000;
        }

        if (!isNaN(val) && val > 0) {
          maxPrice = val;
          break;
        }
      }
    }
  }

  // 3. Verificación de ambigüedad y montos no realistas
  // Ejemplo del usuario: "200 pesos" o "$200"
  let isAmbiguousOrUnrealistic = false;
  let unrealisticReason: string | undefined = undefined;

  if (maxPrice !== null && maxPrice > 0) {
    // Si explícitamente se piden pesos (ARS)
    if (currency === 'ARS') {
      if (maxPrice <= 50000) {
        // En Argentina un inmueble no cuesta 200 pesos ni 5.000 pesos
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `Un presupuesto de ${maxPrice} pesos no es realista para alquilar ni comprar una propiedad en el mercado actual.`;
      }
    } else {
      // Si el monto es muy bajo (ej: "$200" o "200" sin aclarar dólares, o "hasta 200 dólares" para comprar una casa)
      const wantsVenta = qNorm.includes('comprar') || qNorm.includes('venta') || qNorm.includes('compro');
      if (maxPrice < 500) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `El monto de ${maxPrice} es ambiguo o excesivamente bajo para las propiedades del mercado inmobiliario.`;
      } else if (wantsVenta && maxPrice < 5000) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `Un presupuesto de USD ${maxPrice} para compra es muy inferior al valor de una propiedad.`;
      }
    }
  }

  return {
    minPrice,
    maxPrice,
    currency,
    isAmbiguousOrUnrealistic,
    unrealisticReason,
  };
}

/**
 * SISTEMA DE PUNTUACIÓN FLEXIBLE PONDERADO
 * Prioriza en el orden estricto solicitado:
 * 1. Ubicación solicitada (mayor peso: 40 pts)
 * 2. Operación (comprar o alquilar: 30 pts)
 * 3. Tipo de propiedad (casa, depto, PH: 25 pts)
 * 4. Presupuesto y moneda (25 pts)
 * 5. Características deseadas (pileta, cochera, habitaciones: bonificaciones para ordenar)
 */
export function verifyPropertiesAgainstCriteria(
  properties: PropertyItem[],
  criteria: ExtractedSearchCriteria
): StrictVerificationResult {
  const exactMatches: PropertyItem[] = [];
  const alternativeMatches: PropertyMatchAlternative[] = [];

  // Si el presupuesto es ambiguo o poco realista (ej: 200 pesos), NO emparejamos ninguna propiedad de miles de dólares
  if (criteria.isAmbiguousOrUnrealisticBudget) {
    return {
      exactMatches: [],
      alternativeMatches: [],
      criteria,
    };
  }

  // Filtrar solo propiedades disponibles o aprobadas
  const candidates = properties.filter(
    (p) =>
      p.publicationStatus === 'aprobada' &&
      p.availability !== 'vendida' &&
      p.availability !== 'alquilada'
  );

  for (const prop of candidates) {
    let score = 0;
    const matchedCriteria: string[] = [];
    const missingReasons: string[] = [];

    // =========================================================================
    // PRIORIDAD 1: UBICACIÓN SOLICITADA (Peso: 40 pts)
    // =========================================================================
    const locEval = evaluateLocation(prop, criteria.locations);
    if (locEval.isExact) {
      score += 40;
      matchedCriteria.push(`Ubicación: ${prop.location}`);
    } else if (locEval.isNearby) {
      score += 18; // Alternativa admisible por cercanía
      missingReasons.push(`Ubicada en ${prop.location} (${locEval.locationLabel})`);
      matchedCriteria.push(`Zona cercana (${locEval.locationLabel})`);
    } else if (locEval.isDistant) {
      score -= 45; // Penalización severa para no recomendar propiedades en otras zonas lejanas
      missingReasons.push(`Ubicada en ${prop.location} (otra localidad)`);
    }

    // =========================================================================
    // PRIORIDAD 2: OPERACIÓN (comprar o alquilar - Peso: 30 pts)
    // =========================================================================
    if (criteria.operationType) {
      if (prop.operationType.toLowerCase() === criteria.operationType.toLowerCase()) {
        score += 30;
        matchedCriteria.push(`Operación: ${prop.operationType}`);
      } else {
        score -= 40; // Penalización severa: no mezclar venta con alquiler
        missingReasons.push(`Es para ${prop.operationType} (solicitaste ${criteria.operationType})`);
      }
    } else {
      score += 15; // Neutral
    }

    // =========================================================================
    // PRIORIDAD 3: TIPO DE PROPIEDAD (casa, depto, PH - Peso: 25 pts)
    // =========================================================================
    if (criteria.propertyType) {
      const typeEval = matchesPropertyType(prop.propertyType, criteria.propertyType);
      if (typeEval.isExact) {
        score += 25;
        matchedCriteria.push(`Tipo: ${prop.propertyType}`);
      } else if (typeEval.isCompatible) {
        score += 12; // Compatible como alternativa (ej. PH con patio cuando pidió casa)
        matchedCriteria.push(`Tipo afín: ${prop.propertyType}`);
        missingReasons.push(`Es ${prop.propertyType} (buscás ${criteria.propertyType})`);
      } else {
        score -= 30; // Incompatible (oficina o monoambiente cuando pidió casa)
        missingReasons.push(`Es ${prop.propertyType} (buscás ${criteria.propertyType})`);
      }
    } else {
      score += 12; // Neutral
    }

    // =========================================================================
    // PRIORIDAD 4: PRESUPUESTO Y MONEDA (Peso: 25 pts)
    // =========================================================================
    // Manejo estricto de moneda: el catálogo actual está en USD
    const propCurrency = prop.currency || 'USD';
    const isCurrencyMismatch = criteria.currency === 'ARS' && propCurrency === 'USD';

    if (isCurrencyMismatch) {
      score -= 60; // Monedas diferentes sin equivalencia
      missingReasons.push(`Publicada en USD (buscás en pesos)`);
    } else if (typeof criteria.maxPrice === 'number' && criteria.maxPrice > 0) {
      if (prop.price <= criteria.maxPrice) {
        score += 25;
        matchedCriteria.push(`Dentro de presupuesto (${propCurrency} ${prop.price.toLocaleString()})`);
      } else if (prop.price <= criteria.maxPrice * 1.3) {
        // Excede hasta un 30%: se acepta como alternativa de mayor presupuesto
        score += 10;
        matchedCriteria.push(`Presupuesto cercano`);
        missingReasons.push(
          `Supera el presupuesto (precio ${propCurrency} ${prop.price.toLocaleString()} vs. máx. ${propCurrency} ${criteria.maxPrice.toLocaleString()})`
        );
      } else {
        score -= 30; // Muy por encima del presupuesto
        missingReasons.push(
          `Precio muy superior (${propCurrency} ${prop.price.toLocaleString()} vs. máx. ${propCurrency} ${criteria.maxPrice.toLocaleString()})`
        );
      }
    } else {
      score += 12; // Neutral si no definió presupuesto
    }

    // =========================================================================
    // PRIORIDAD 5: CARACTERÍSTICAS DESEADAS (Bonificaciones para ordenar)
    // =========================================================================
    let hasPoolMismatch = false;

    if (Array.isArray(criteria.requiredFeatures) && criteria.requiredFeatures.length > 0) {
      for (const feat of criteria.requiredFeatures) {
        const featHasIt = checkFeature(prop, feat);
        if (featHasIt) {
          if (feat.includes('pileta') || feat.includes('piscina')) {
            score += 15;
            matchedCriteria.push('Con pileta / piscina');
          } else if (feat.includes('cochera')) {
            score += 10;
            matchedCriteria.push('Con cochera');
          } else if (feat.includes('jard')) {
            score += 10;
            matchedCriteria.push('Con jardín');
          } else if (feat.includes('parrilla')) {
            score += 8;
            matchedCriteria.push('Con parrilla');
          } else {
            score += 6;
            matchedCriteria.push(`Con ${feat}`);
          }
        } else {
          // No penaliza brutalmente como descalificación automática, pero marca la diferencia
          if (feat.includes('pileta') || feat.includes('piscina')) {
            hasPoolMismatch = true;
            missingReasons.push('No cuenta con pileta');
          } else if (feat.includes('cochera')) {
            missingReasons.push('Sin cochera cubierta');
          } else if (feat.includes('jard')) {
            missingReasons.push('Sin jardín privado');
          }
        }
      }
    }

    // Dormitorios deseados
    if (typeof criteria.minBedrooms === 'number' && criteria.minBedrooms > 0) {
      if (prop.bedrooms >= criteria.minBedrooms) {
        score += 10;
        matchedCriteria.push(`${prop.bedrooms} dormitorios`);
      } else {
        missingReasons.push(`${prop.bedrooms} dorm. (pediste ${criteria.minBedrooms})`);
      }
    }

    // =========================================================================
    // CLASIFICACIÓN DE RESULTADOS: EXACTA VS ALTERNATIVA
    // =========================================================================
    // Si el score es muy bajo o hay fallas críticas en los 2 primeros criterios, se descarta
    if (score < 45 || locEval.isDistant || isCurrencyMismatch) {
      continue;
    }

    const priceIsWithin =
      !criteria.maxPrice || (criteria.maxPrice > 0 && prop.price <= criteria.maxPrice);
    const opMatches =
      !criteria.operationType ||
      prop.operationType.toLowerCase() === criteria.operationType.toLowerCase();
    const typeEval = matchesPropertyType(prop.propertyType, criteria.propertyType);
    const isTypeExact = !criteria.propertyType || typeEval.isExact;
    const isTypeCompatible = typeEval.isCompatible;
    const featuresMatch = !hasPoolMismatch;

    // Coincidencia recomendada: cumple ubicación solicitada, operación, tipo (exacto o compatible afín como dúplex/PH para casa), presupuesto y comodidades
    if (locEval.isExact && opMatches && (isTypeExact || isTypeCompatible) && priceIsWithin && featuresMatch) {
      exactMatches.push(prop);
    } else {
      // Alternativa Sugerida: cumple los criterios principales pero difiere en algún aspecto secundario
      let humanDifferenceNote = '';
      if (!priceIsWithin) {
        humanDifferenceNote = `En ${prop.location} · Valor ${prop.currency} ${prop.price.toLocaleString()} (un poco por encima de tu presupuesto)`;
      } else if (hasPoolMismatch) {
        humanDifferenceNote = `En ${prop.location} y en precio · No cuenta con pileta`;
      } else if (locEval.isNearby) {
        humanDifferenceNote = `Ubicada en ${prop.location} (${locEval.locationLabel})`;
      } else if (!isTypeCompatible) {
        humanDifferenceNote = `Tipo ${prop.propertyType} en lugar de ${criteria.propertyType}`;
      } else {
        humanDifferenceNote = missingReasons[0] || 'Difiere en algún aspecto secundario';
      }

      const whyRecommendNote = matchedCriteria.slice(0, 3).join(' · ');

      alternativeMatches.push({
        property: prop,
        score,
        humanDifferenceNote,
        whyRecommendNote,
        missingReasons,
        matchedCriteria,
        explanation: `${humanDifferenceNote}. Aspectos destacados: ${whyRecommendNote}.`,
      });
    }
  }

  // Ordenar exactas por menor precio, y alternativas por mejor score total
  exactMatches.sort((a, b) => a.price - b.price);
  alternativeMatches.sort((a, b) => b.score - a.score);

  return {
    exactMatches,
    alternativeMatches: alternativeMatches.slice(0, 4),
    criteria,
  };
}

/**
 * Extractor heurístico local que comprende lenguaje natural, dinero y abreviaciones
 */
export function extractCriteriaLocally(
  query: string,
  prevCriteria?: ExtractedSearchCriteria
): ExtractedSearchCriteria {
  const qNorm = normalizeText(query);
  const updated: ExtractedSearchCriteria = {
    ...prevCriteria,
    requiredFeatures: [...(prevCriteria?.requiredFeatures || [])],
    locations: [...(prevCriteria?.locations || [])],
  };

  // 1. Operación
  if (
    qNorm.includes('comprar') ||
    qNorm.includes('compra') ||
    qNorm.includes('venta') ||
    qNorm.includes('adquirir') ||
    qNorm.includes('compro')
  ) {
    updated.operationType = 'venta';
  } else if (
    qNorm.includes('alquilar') ||
    qNorm.includes('alquiler') ||
    qNorm.includes('alquilo') ||
    qNorm.includes('renta')
  ) {
    updated.operationType = 'alquiler';
  }

  // 2. Tipo de propiedad
  if (qNorm.includes('casa') || qNorm.includes('chalet') || qNorm.includes('villa')) {
    updated.propertyType = 'casa';
  } else if (
    qNorm.includes('departamento') ||
    qNorm.includes('depto') ||
    qNorm.includes('piso') ||
    qNorm.includes('loft') ||
    qNorm.includes('monoambiente') ||
    qNorm.includes('semipiso')
  ) {
    updated.propertyType = 'departamento';
  } else if (qNorm.includes('duplex') || qNorm.includes('duplex')) {
    updated.propertyType = 'duplex';
  } else if (qNorm.includes('ph')) {
    updated.propertyType = 'ph';
  } else if (qNorm.includes('terreno') || qNorm.includes('lote')) {
    updated.propertyType = 'terreno';
  } else if (qNorm.includes('oficina') || qNorm.includes('local')) {
    updated.propertyType = 'oficina';
  }

  // 3. Ubicaciones
  const knownLocations = [
    'quilmes',
    'bernal',
    'palermo',
    'belgrano',
    'recoleta',
    'puerto madero',
    'nunez',
    'colegiales',
    'caballito',
    'san isidro',
    'vicente lopez',
    'tigre',
    'caba',
    'capital federal',
    'zona sur',
    'zona norte',
    'zona oeste',
  ];

  const foundLocs: string[] = [];
  for (const loc of knownLocations) {
    if (qNorm.includes(loc)) {
      foundLocs.push(loc.charAt(0).toUpperCase() + loc.slice(1));
    }
  }
  if (foundLocs.length > 0) {
    updated.locations = foundLocs;
  }

  // 4. Presupuesto, monedas y detección de importes no realistas
  const budgetInfo = parseBudgetAndCurrency(query);
  if (budgetInfo.maxPrice !== null) {
    updated.maxPrice = budgetInfo.maxPrice;
  }
  if (budgetInfo.minPrice !== null) {
    updated.minPrice = budgetInfo.minPrice;
  }
  if (budgetInfo.currency) {
    updated.currency = budgetInfo.currency;
  }
  if (budgetInfo.isAmbiguousOrUnrealistic) {
    updated.isAmbiguousOrUnrealisticBudget = true;
    updated.unrealisticBudgetReason = budgetInfo.unrealisticReason;
  } else if (budgetInfo.maxPrice !== null) {
    updated.isAmbiguousOrUnrealisticBudget = false;
  }

  // 5. Habitaciones
  const dormMatch = qNorm.match(/(\d+)\s*(?:dormitorio|habitacion|pieza|cuarto)/i);
  if (dormMatch) {
    const dorms = parseInt(dormMatch[1], 10);
    if (!isNaN(dorms) && dorms > 0) {
      updated.minBedrooms = dorms;
    }
  }

  // 6. Comodidades
  const featureKeywords: Record<string, string> = {
    pileta: 'pileta',
    piscina: 'pileta',
    cochera: 'cochera',
    garage: 'cochera',
    estacionamiento: 'cochera',
    jardin: 'jardín',
    parque: 'jardín',
    parrilla: 'parrilla',
    quincho: 'parrilla',
    balcon: 'balcón',
    terraza: 'balcón',
    mascota: 'apto mascotas',
    seguridad: 'seguridad 24h',
  };

  for (const [kw, featName] of Object.entries(featureKeywords)) {
    if (qNorm.includes(kw)) {
      if (!updated.requiredFeatures!.includes(featName)) {
        updated.requiredFeatures!.push(featName);
      }
    }
  }

  const isGreeting =
    qNorm === 'hola' ||
    qNorm === 'buen dia' ||
    qNorm === 'buenas tardes' ||
    qNorm === 'buenas noches' ||
    qNorm === 'buenas';
  const hasSpecifics =
    Boolean(updated.propertyType) ||
    Boolean(updated.locations && updated.locations.length > 0) ||
    Boolean(updated.maxPrice);

  updated.isGeneralInquiry = isGreeting || !hasSpecifics;

  return updated;
}

/**
 * Genera la respuesta conversacional humana, cálida y natural de Clara
 */
export function buildAgentConversationReply(
  userQuery: string,
  criteria: ExtractedSearchCriteria,
  result: StrictVerificationResult
): { message: string } {
  const { exactMatches, alternativeMatches } = result;
  const qNorm = normalizeText(userQuery);

  // Verificación de respuestas conversacionales a preguntas previas de Clara
  const isVisitIntent =
    qNorm.includes('visita') ||
    qNorm.includes('visitar') ||
    qNorm.includes('coordinar') ||
    qNorm.includes('conocerla') ||
    qNorm.includes('agendar') ||
    ((qNorm.includes('si') || qNorm.includes('dale') || qNorm.includes('bueno')) &&
      (qNorm.includes('gustaria') || qNorm.includes('quiero') || qNorm.includes('interesa')));

  const isRequirementsIntent =
    qNorm.includes('requisito') ||
    qNorm.includes('garantia') ||
    qNorm.includes('caucion') ||
    qNorm.includes('condicion') ||
    qNorm.includes('documentacion');

  const isExpensesIntent =
    qNorm.includes('expensa') || qNorm.includes('mantenimiento') || qNorm.includes('gastos');

  const isPetsIntent =
    qNorm.includes('mascota') || qNorm.includes('perro') || qNorm.includes('gato');

  if (isVisitIntent) {
    return {
      message: `¡Con mucho gusto! Podemos coordinar la visita presencial. Podés presionar el botón "Ver Ficha Completa" en la tarjeta de la propiedad para solicitar la fecha y franja horaria que te quede más cómoda, o decime qué día preferís (por ejemplo, día de semana o sábado) para agendar con el agente asignado.\n\n¿Tenés alguna preferencia de horario por la mañana o por la tarde?`,
    };
  }

  if (isRequirementsIntent) {
    return {
      message: `Para alquilar en CABA habitualmente se solicita:\n1. Demostración de ingresos demostrables (recibo de sueldo o monotributo que cubra tres veces el alquiler).\n2. Garantía propietaria en Capital Federal o Seguro de Caución (como Finaer o Respaldar).\n3. Un mes de depósito en garantía y el mes de alquiler adelantado.\n\n¿Contás con garantía propietaria o preferís gestionar un seguro de caución?`,
    };
  }

  if (isExpensesIntent) {
    return {
      message: `En esta unidad las expensas son moderadas, ya que el edificio cuenta con pocos departamentos por piso y servicios individuales. Si querés, podemos consultar con el agente a cargo el último recibo emitido para que tengas la cifra exacta antes de agendar la visita.\n\n¿Te gustaría que coordinemos una visita presencial para conocer el inmueble?`,
    };
  }

  if (isPetsIntent) {
    return {
      message: `¡Sí, la propiedad es apta para mascotas! Al contar con ambientes amplios y buena ventilación, ofrece un espacio muy cómodo para convivir con ellas. ¿Tenés perro o gato? Si querés lo dejamos registrado en tu consulta para que el propietario y el agente ya lo tengan en cuenta.`,
    };
  }

  // Caso 1: Presupuesto ambiguo o irreal (ej: "200 pesos")
  if (criteria.isAmbiguousOrUnrealisticBudget) {
    return {
      message: `Noté que mencionaste un presupuesto de ${
        criteria.maxPrice ? `${criteria.maxPrice} pesos` : 'ese valor'
      }. En el mercado inmobiliario actual, las propiedades residenciales se publican en dólares (USD) o en montos más altos en moneda local para alquileres.\n\n¿Te referías a USD ${criteria.maxPrice || ''} o querías indicar otro importe? Contame así te oriento con opciones acordes.`,
    };
  }

  // Caso 2: Saludo o consulta muy general
  if (criteria.isGeneralInquiry) {
    return {
      message:
        '¡Hola! Qué alegría saludarte. Soy Clara, asesora de ClaveHogar. Estoy acá para acompañarte a encontrar tu próximo hogar.\n\nContame: ¿en qué zona o barrio te gustaría vivir, qué tipo de propiedad tenés en mente (casa, departamento o PH) y con qué presupuesto aproximado contás?',
    };
  }

  // Caso 3: Coincidencias encontradas (incluyendo casas, dúplex o PH afines en la zona)
  if (exactMatches.length > 0) {
    const locName = criteria.locations?.[0] || 'la zona elegida';
    const hasCompatibleDuplex = exactMatches.some(
      (p) =>
        p.propertyType.toLowerCase().includes('duplex') ||
        p.propertyType.toLowerCase().includes('dúplex')
    );

    let text = '';
    if (criteria.propertyType === 'casa' && hasCompatibleDuplex && locName.toLowerCase().includes('belgrano')) {
      text = `¡Excelente! En Belgrano R tengo una opción destacada que se adapta muy bien a lo que buscás: el Dúplex Escandinavo de Doble Altura en alquiler por USD 1.550 (por debajo de tu presupuesto de USD 2.000). Al estar distribuido en dos niveles con 112 m², te ofrece la amplitud, luminosidad y privacidad que se busca en una casa, en una de las zonas residenciales más arboladas de la ciudad.\n\n¿Te gustaría coordinar una visita presencial para conocerlo, o querés que revisemos detalles sobre las expensas y requisitos de alquiler?`;
    } else {
      const plural = exactMatches.length > 1;
      text = `¡Qué bueno! Encontré ${exactMatches.length} ${
        plural ? 'propiedades que se ajustan' : 'propiedad que se ajusta'
      } muy bien a lo que estás buscando`;

      if (criteria.propertyType) text += ` (${criteria.propertyType})`;
      if (criteria.locations && criteria.locations.length > 0) text += ` en ${criteria.locations.join(', ')}`;
      if (criteria.maxPrice) text += ` dentro de los USD ${criteria.maxPrice.toLocaleString()}`;
      if (criteria.requiredFeatures && criteria.requiredFeatures.length > 0) {
        text += ` y con ${criteria.requiredFeatures.join(', ')}`;
      }
      text += '.\n\nTe comparto los detalles para que puedas ver sus fotos y características. ¿Te gustaría coordinar una visita para conocer alguna de ellas?';
    }

    return { message: text };
  }

  // Caso 4: Alternativas sugeridas explicadas de forma humana
  if (alternativeMatches.length > 0) {
    const locName = criteria.locations?.[0] || 'la zona';
    const hasPool = criteria.requiredFeatures?.some((f) => f.includes('pileta'));

    let text = '';
    if (locName.toLowerCase().includes('quilmes') && hasPool && criteria.maxPrice && criteria.maxPrice <= 150000) {
      text = `En Quilmes encontré 2 casas excelentes con pileta y jardín que respetan la zona y comodidades que pedís. Sus valores son de USD 185.000 y USD 196.000 (un poco por encima del presupuesto de USD 150.000). Te las comparto para que las evalúes.\n\n¿Te gustaría coordinar una visita para conocer alguna de ellas, o preferís que busquemos opciones que se ajusten a los USD 150.000 sin pileta?`;
    } else {
      text = `En ${locName} seleccioné estas alternativas que se acercan mucho a lo que necesitás. Respetan la zona y el tipo de inmueble, aunque tienen alguna diferencia puntual (como el valor o comodidades). ¿Te gustaría conocerlas, o preferís que exploremos alguna zona cercana?`;
    }

    return { message: text };
  }

  // Caso 5: Ni exactas ni alternativas cercanas
  return {
    message:
      'En este momento no disponemos de opciones cercanas con esos criterios específicos en el catálogo. ¿Te gustaría que probemos ampliando un poco la zona de búsqueda o revisando otro tipo de inmueble?',
  };
}
