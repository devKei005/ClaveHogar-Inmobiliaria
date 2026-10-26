export interface SmartSearchPropertyInput {
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

export interface SmartSearchResultPayload {
  interpretedPreferences: {
    summary: string;
    operationType: string;
    preferredLocations: string[];
    maxPrice: number;
    minRooms: number;
    minSurface: number;
    keyFeatures: string[];
  };
  recommendations: {
    propertyId: string;
    matchScore: number;
    explanation: string;
    matchedCriteria: string[];
  }[];
  assistantMessage?: string;
  isOffTopic?: boolean;
  needsClarification?: boolean;
}

export function normalizeSearchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const CABA_KEYWORDS = [
  'caba',
  'ciudad autonoma de buenos aires',
  'ciudad de buenos aires',
  'capital federal',
  'capital',
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
  'coghlans',
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

const GBA_SUR_KEYWORDS = [
  'zona sur',
  'gba sur',
  'quilmes',
  'bernal',
  'don bosco',
  'ezpeleta',
  'avellaneda',
  'wild',
  'wilde',
  'sarandi',
  'gerli',
  'lanus',
  'remedios de escalada',
  'valentín alsina',
  'valentin alsina',
  'lomas de zamora',
  'lomas',
  'banfield',
  'temperley',
  'adrogue',
  'burzaco',
  'berazategui',
  'hudson',
  'florencio varela',
  'monte grande',
  'ezeiza',
  'canning',
  'la plata',
  'city bell',
  'gonnet',
];

const GBA_NORTE_KEYWORDS = [
  'zona norte',
  'gba norte',
  'vicente lopez',
  'olivos',
  'la lucila',
  'martinez',
  'acassuso',
  'san isidro',
  'beccar',
  'boulogne',
  'munro',
  'florida',
  'san fernando',
  'tigre',
  'nordelta',
  'pacheco',
  'don torcuato',
  'pilar',
  'escobar',
  'maschwitz',
  'san martin',
  'villa ballester',
];

const GBA_OESTE_KEYWORDS = [
  'zona oeste',
  'gba oeste',
  'ramos mejia',
  'san justo',
  'haedo',
  'moron',
  'castelar',
  'ituzaingo',
  'padua',
  'merlo',
  'moreno',
  'hurlingham',
  'el palomar',
  'caseros',
  'ciudadela',
  'santos lugares',
  'tres de febrero',
];

function isPropertyInCaba(propNorm: string): boolean {
  return CABA_KEYWORDS.some((kw) => propNorm.includes(kw));
}

function isPropertyInGba(propNorm: string): boolean {
  return (
    GBA_SUR_KEYWORDS.some((kw) => propNorm.includes(kw)) ||
    GBA_NORTE_KEYWORDS.some((kw) => propNorm.includes(kw)) ||
    GBA_OESTE_KEYWORDS.some((kw) => propNorm.includes(kw)) ||
    propNorm.includes('buenos aires') ||
    propNorm.includes('gba') ||
    propNorm.includes('amba')
  );
}

function parseRawNumber(numStr: string): number {
  const cleaned = numStr.trim();
  if (!cleaned) return 0;
  // Si tiene punto o coma seguido de 3 dígitos exactos (ej: 15.000 o 200.000), es separador de miles
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/[.,]/g, ''));
  }
  // Si tiene decimal corto (ej: 1.5 millones)
  const normalized = cleaned.replace(',', '.');
  const val = Number(normalized);
  return Number.isNaN(val) ? 0 : val;
}

export function extractPriceRangeFromQuery(queryNorm: string): {
  minPrice: number;
  maxPrice: number;
} {
  let minPrice = 0;
  let maxPrice = 0;

  // 1. Detectar rangos explícitos: "entre 10 a 15 mil dolares", "entre $10.000 y $15.000", "de 10 a 15 mil", "10 a 15 mil dolares"
  const rangeRegex =
    /(?:entre|de|desde)?\s*(?:usd|u\$s|\$|pesos|ars)?\s*(\d+(?:[.,]\d+)?)\s*(mil|miles|k|millon|millones)?\s*(?:dolares|dolar|usd|u\$s|pesos|ars|\$)?\s*(?:a|y|hasta|-|al)\s*(?:usd|u\$s|\$|pesos|ars)?\s*(\d+(?:[.,]\d+)?)\s*(mil|miles|k|millon|millones)?\s*(?:dolares|dolar|usd|u\$s|pesos|ars|\$)?/i;
  const rangeMatch = queryNorm.match(rangeRegex);

  if (rangeMatch) {
    let n1 = parseRawNumber(rangeMatch[1]);
    const unit1 = (rangeMatch[2] || '').toLowerCase();
    let n2 = parseRawNumber(rangeMatch[3]);
    const unit2 = (rangeMatch[4] || '').toLowerCase();

    const effectiveUnit2 = unit2.startsWith('millon')
      ? 1000000
      : unit2.startsWith('mil') || unit2 === 'k'
      ? 1000
      : 1;
    const effectiveUnit1 = unit1.startsWith('millon')
      ? 1000000
      : unit1.startsWith('mil') || unit1 === 'k'
      ? 1000
      : // Si dijo "entre 10 a 15 mil", el "mil" del segundo número aplica también al primero
      effectiveUnit2 > 1 && n1 < 1000
      ? effectiveUnit2
      : 1;

    n1 = n1 * effectiveUnit1;
    n2 = n2 * effectiveUnit2;

    if (n1 > 0 && n2 > 0 && (effectiveUnit2 > 1 || n1 >= 100 || n2 >= 100)) {
      minPrice = Math.min(n1, n2);
      maxPrice = Math.max(n1, n2);
      return { minPrice, maxPrice };
    }
  }

  // 2. Detectar monto con "mil", "miles", "k", "millones" (ej: "15 mil dolares", "hasta 200 mil", "presupuesto 15k")
  const unitPriceRegex =
    /(?:hasta|maximo|presupuesto|menos de|por|cerca de|alrededor de|unos|\$|usd|u\$s)?\s*(\d+(?:[.,]\d+)?)\s*(mil|miles|k|millon|millones)\b/i;
  const unitMatch = queryNorm.match(unitPriceRegex);
  if (unitMatch) {
    const raw = parseRawNumber(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    const mult = unit.startsWith('millon') ? 1000000 : 1000;
    if (raw > 0) {
      maxPrice = raw * mult;
      return { minPrice: 0, maxPrice };
    }
  }

  // 3. Detectar monto directo con palabra clave o moneda (ej: "hasta $200.000", "usd 15000", "15000 dolares", "presupuesto 180000")
  const directBeforeCurrency = queryNorm.match(
    /(\d[\d.,]{2,})\s*(?:dolares|dolar|usd|u\$s|pesos|ars)/i
  );
  if (directBeforeCurrency) {
    const val = parseRawNumber(directBeforeCurrency[1]);
    if (val > 0) {
      return { minPrice: 0, maxPrice: val };
    }
  }

  const directAfterKeyword = queryNorm.match(
    /(?:hasta|maximo|presupuesto|menos de|precio|valor|\$|usd|u\$s)\s*(?:de\s*)?(?:usd\s*|\$\s*)?(\d[\d.,]{2,})/i
  );
  if (directAfterKeyword) {
    const val = parseRawNumber(directAfterKeyword[1]);
    if (val > 0) {
      return { minPrice: 0, maxPrice: val };
    }
  }

  return { minPrice, maxPrice };
}

export function buildFlexibleSmartSearch(
  queryText: string,
  properties: SmartSearchPropertyInput[]
): SmartSearchResultPayload {
  const qNorm = normalizeSearchText(queryText);

  // REGLA 2 & EJEMPLO: Saludos
  const GREETINGS = [
    'hola',
    'buenas',
    'buen dia',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'que tal',
    'como estas',
    'hey',
    'saludos',
  ];
  const isJustGreeting =
    GREETINGS.includes(qNorm) ||
    GREETINGS.some((g) => qNorm === `${g}!` || qNorm === `${g}?` || qNorm === `${g}.`);
  if (isJustGreeting) {
    return {
      interpretedPreferences: {
        summary: 'Saludo inicial recibido.',
        operationType: 'ambos',
        preferredLocations: ['Todas las zonas'],
        maxPrice: 0,
        minRooms: 1,
        minSurface: 30,
        keyFeatures: ['Búsqueda asistida'],
      },
      recommendations: [],
      assistantMessage:
        '¡Hola! Puedo ayudarte a buscar inmuebles. ¿Qué tipo de propiedad y en qué zona te interesa?',
      isOffTopic: true,
    };
  }

  // REGLA 3 & EJEMPLO: Objetos ajenos que no existen en el catálogo inmobiliario (papa, helado, auto, comida, etc.)
  const NON_REAL_ESTATE_ITEMS = [
    'papa',
    'papas',
    'helado',
    'auto',
    'autos',
    'coche',
    'coches',
    'moto',
    'motos',
    'bicicleta',
    'comida',
    'pizza',
    'hamburguesa',
    'celular',
    'computadora',
    'televisor',
    'ropa',
    'chiste',
    'musica',
    'perro',
    'gato',
  ];
  const mentionsNonRealEstateItem = NON_REAL_ESTATE_ITEMS.some(
    (item) =>
      qNorm.split(/\s+/).includes(item) ||
      qNorm.includes(`una ${item}`) ||
      qNorm.includes(`un ${item}`) ||
      qNorm.includes(`quiero ${item}`)
  );
  // Verificar si a la vez NO está pidiendo una casa o departamento (ej: "casa que acepte perro" sí es válido)
  const isAskingRealEstateExplicitly =
    qNorm.includes('casa') ||
    qNorm.includes('departamento') ||
    qNorm.includes('depto') ||
    qNorm.includes('ph') ||
    qNorm.includes('terreno') ||
    qNorm.includes('lote') ||
    qNorm.includes('oficina') ||
    qNorm.includes('local') ||
    qNorm.includes('alquiler') ||
    qNorm.includes('venta') ||
    qNorm.includes('inmueble') ||
    qNorm.includes('propiedad');

  if (mentionsNonRealEstateItem && !isAskingRealEstateExplicitly) {
    return {
      interpretedPreferences: {
        summary: 'Elemento ajeno al catálogo inmobiliario.',
        operationType: 'ninguna',
        preferredLocations: [],
        maxPrice: 0,
        minRooms: 0,
        minSurface: 0,
        keyFeatures: [],
      },
      recommendations: [],
      assistantMessage:
        'Ese elemento no forma parte de nuestro catálogo de inmuebles. ¿Buscás una casa, departamento, terreno u otro tipo de propiedad?',
      isOffTopic: true,
    };
  }

  // REGLA 6 & EJEMPLO: Ubicaciones extraterrestres o inexistentes ("en Marte", "la luna", etc.)
  const IMPOSSIBLE_LOCATIONS = [
    'marte',
    'luna',
    'jupiter',
    'saturno',
    'espacio',
    'narnia',
    'atlantida',
    'sol',
  ];
  if (IMPOSSIBLE_LOCATIONS.some((loc) => qNorm.includes(loc))) {
    return {
      interpretedPreferences: {
        summary: 'Ubicación no cubierta por la plataforma.',
        operationType: 'ninguna',
        preferredLocations: [],
        maxPrice: 0,
        minRooms: 0,
        minSurface: 0,
        keyFeatures: [],
      },
      recommendations: [],
      assistantMessage:
        'No tenemos inmuebles en esa ubicación. ¿Querés buscar en otra zona?',
      isOffTopic: true,
    };
  }

  // REGLA 5 & EJEMPLO: Consultas ambiguas ("algo para vivir", "busco algo barato", "algo economico")
  const AMBIGUOUS_PHRASES = [
    'algo para vivir',
    'algo barato',
    'busco algo barato',
    'algo economico',
    'lo mas barato',
    'lo mas economico',
    'algo lindo',
    'algo bueno',
    'quiero vivir',
    'un lugar para vivir',
  ];
  const isAmbiguousOnly =
    AMBIGUOUS_PHRASES.includes(qNorm) ||
    (AMBIGUOUS_PHRASES.some((a) => qNorm.includes(a)) &&
      !qNorm.includes('palermo') &&
      !qNorm.includes('quilmes') &&
      !qNorm.includes('caba') &&
      !qNorm.includes('belgrano') &&
      !qNorm.includes('recoleta') &&
      !qNorm.includes('buenos aires') &&
      !/\d+/.test(qNorm));
  if (isAmbiguousOnly) {
    return {
      interpretedPreferences: {
        summary: 'Consulta ambigua, se requiere especificación de criterios.',
        operationType: 'ambos',
        preferredLocations: [],
        maxPrice: 0,
        minRooms: 1,
        minSurface: 30,
        keyFeatures: [],
      },
      recommendations: [],
      assistantMessage: qNorm.includes('vivir')
        ? '¿Preferís comprar o alquilar? ¿En qué zona y con cuántos ambientes?'
        : '¿Podés indicarme la zona y el tipo de propiedad que buscás?',
      needsClarification: true,
    };
  }

  // 1. Detectar operación (alquiler / venta / ambos)
  const isRent =
    qNorm.includes('alquil') || qNorm.includes('renta') || qNorm.includes('temporario');
  const isSale =
    qNorm.includes('compr') || qNorm.includes('venta') || qNorm.includes('invertir');
  const detectedOperation =
    isRent && !isSale ? 'alquiler' : isSale && !isRent ? 'venta' : 'ambos';

  // 2. Detectar si el usuario pide "cerca de" / "cera de" / "alrededores" / "próximo a"
  const isProximitySearch =
    qNorm.includes('cerca de') ||
    qNorm.includes('cera de') ||
    qNorm.includes('cercano') ||
    qNorm.includes('cercana') ||
    qNorm.includes('alrededores') ||
    qNorm.includes('proximo') ||
    qNorm.includes('proxima') ||
    qNorm.includes('zona');

  // 3. Detectar zonas mencionadas (incluyendo sinónimos como Ciudad de Buenos Aires = CABA)
  const mentionsBuenosAiresOrCaba =
    qNorm.includes('ciudad de buenos aires') ||
    qNorm.includes('caba') ||
    qNorm.includes('capital federal') ||
    qNorm.includes('buenos aires') ||
    qNorm.includes('capital');

  const mentionsZonaSur = qNorm.includes('zona sur') || qNorm.includes('gba sur');
  const mentionsZonaNorte = qNorm.includes('zona norte') || qNorm.includes('gba norte');
  const mentionsZonaOeste = qNorm.includes('zona oeste') || qNorm.includes('gba oeste');

  // Detectar barrios o ciudades específicas tanto de nuestra lista como dinámicamente del catálogo
  const dynamicCatalogLocations = Array.from(
    new Set(
      properties
        .flatMap((p) => [p.location, p.address])
        .map((loc) => (loc || '').trim())
        .filter((loc) => loc.length >= 3)
    )
  );

  const allKnownPlaces = Array.from(
    new Set([
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
      'Avellaneda',
      'Lanús',
      'Lomas de Zamora',
      'Banfield',
      'Temperley',
      'Adrogué',
      'Berazategui',
      'Olivos',
      'Martínez',
      'Pilar',
      'Morón',
      'Ramos Mejía',
      'Castelar',
      'Ituzaingó',
      'Villa Urquiza',
      'Villa Crespo',
      'Almagro',
      'Flores',
      'Devoto',
      'San Telmo',
      'Barracas',
      'Retiro',
      'Microcentro',
      ...dynamicCatalogLocations,
    ])
  );

  const specificMatchedPlaces = allKnownPlaces.filter((place) => {
    const placeNorm = normalizeSearchText(place);
    if (!placeNorm || placeNorm.length < 3) return false;
    // Evitar que "buenos aires" se tome como barrio estricto si ya lo manejamos como región
    if (placeNorm === 'buenos aires' || placeNorm === 'caba' || placeNorm === 'capital federal') {
      return false;
    }
    return qNorm.includes(placeNorm);
  });

  const preferredLocationsDisplay: string[] = [...specificMatchedPlaces];
  if (mentionsBuenosAiresOrCaba) {
    preferredLocationsDisplay.push(
      isProximitySearch ? 'CABA y Gran Buenos Aires (Cercanías)' : 'CABA / Ciudad de Buenos Aires'
    );
  }
  if (mentionsZonaSur) preferredLocationsDisplay.push('Zona Sur GBA');
  if (mentionsZonaNorte) preferredLocationsDisplay.push('Zona Norte GBA');
  if (mentionsZonaOeste) preferredLocationsDisplay.push('Zona Oeste GBA');

  // 4. Detectar dormitorios y ambientes
  let minBedrooms = 0;
  const bedMatch = qNorm.match(/(\d+)\s*(habitaciones|habitacion|dormitorios|dormitorio|dorm|cuartos|cuarto|hab)/);
  if (bedMatch) {
    minBedrooms = parseInt(bedMatch[1], 10);
  }

  let minRooms = 1;
  const roomsMatch = qNorm.match(/(\d+)\s*(ambientes|ambiente|amb)/);
  if (roomsMatch) {
    minRooms = parseInt(roomsMatch[1], 10);
  } else if (minBedrooms > 0) {
    minRooms = minBedrooms + 1;
  }

  // 5. Detectar precio / rango de presupuesto
  const { minPrice, maxPrice } = extractPriceRangeFromQuery(qNorm);

  // 6. Detectar tipo de propiedad ("inmueble" o "propiedad" es comodín general y acepta cualquier tipo)
  const wantsCasa =
    qNorm.includes('casa') || qNorm.includes('chalet') || qNorm.includes('villa') || qNorm.includes('quinta');
  const wantsDepto =
    qNorm.includes('departamento') ||
    qNorm.includes('depto') ||
    qNorm.includes('dpto') ||
    qNorm.includes('piso') ||
    qNorm.includes('monoambiente') ||
    qNorm.includes('loft') ||
    qNorm.includes('studio');
  const wantsPH = /\bph\b/.test(qNorm) || qNorm.includes('tipo casa');
  const wantsTerreno = qNorm.includes('terreno') || qNorm.includes('lote');
  const wantsLocalOrOficina =
    qNorm.includes('local') || qNorm.includes('oficina') || qNorm.includes('consultorio') || qNorm.includes('comercial');

  // 7. Detectar comodidades / features
  const featureKeywords = [
    { keys: ['pileta', 'piscina'], label: 'Piscina / Pileta' },
    { keys: ['mascota', 'perro', 'gato'], label: 'Apto mascotas' },
    { keys: ['balcon', 'terraza', 'patio'], label: 'Balcón / Terraza / Patio' },
    { keys: ['cochera', 'garage', 'estacionamiento', 'auto'], label: 'Cochera' },
    { keys: ['seguridad', 'vigilancia', 'porteria'], label: 'Seguridad 24h' },
    { keys: ['jardin', 'parque', 'verde', 'fondo'], label: 'Jardín / Parque' },
    { keys: ['luminoso', 'luz', 'sol', 'norte', 'abierta'], label: 'Luminoso / Vista abierta' },
    { keys: ['parrilla', 'quincho', 'asador', 'sum'], label: 'Parrilla / Quincho' },
  ];

  const keyFeatures = featureKeywords
    .filter((fk) => fk.keys.some((k) => qNorm.includes(k)))
    .map((fk) => fk.label);

  // REGLAS 1 & 2: Verificar si la consulta contiene al menos algún criterio inmobiliario válido
  const hasRealEstateCriteria =
    isRent ||
    isSale ||
    isAskingRealEstateExplicitly ||
    mentionsBuenosAiresOrCaba ||
    mentionsZonaSur ||
    mentionsZonaNorte ||
    mentionsZonaOeste ||
    specificMatchedPlaces.length > 0 ||
    minPrice > 0 ||
    maxPrice > 0 ||
    minBedrooms > 0 ||
    wantsCasa ||
    wantsDepto ||
    wantsPH ||
    wantsTerreno ||
    wantsLocalOrOficina ||
    keyFeatures.length > 0;

  if (!hasRealEstateCriteria) {
    return {
      interpretedPreferences: {
        summary: 'Consulta sin criterios inmobiliarios válidos.',
        operationType: 'ninguna',
        preferredLocations: [],
        maxPrice: 0,
        minRooms: 0,
        minSurface: 0,
        keyFeatures: [],
      },
      recommendations: [],
      assistantMessage:
        'No encontré inmuebles relacionados con tu consulta. Puedo ayudarte a buscar por zona, tipo de propiedad, presupuesto o cantidad de ambientes.',
      isOffTopic: true,
      needsClarification: false,
    };
  }

  // 8. Puntuar cada propiedad con criterios flexibles e inteligentes
  const scored = properties
    .map((p) => {
      let score = 62; // Base saludable para que consultas amplias ("inmueble en CABA entre 10 y 15 mil") califiquen
      const matchedCriteria: string[] = [];
      let hardMismatch = false;

      const propLocNorm = normalizeSearchText(`${p.location} ${p.address}`);
      const propFullNorm = normalizeSearchText(
        `${p.title} ${p.description} ${p.location} ${p.address} ${p.propertyType} ${(p.features || []).join(' ')}`
      );
      const propTypeNorm = normalizeSearchText(p.propertyType);

      // A) Operación
      if (detectedOperation !== 'ambos') {
        if (p.operationType === detectedOperation) {
          score += 25;
          matchedCriteria.push(`Operación: ${p.operationType}`);
        } else {
          score -= 40;
          hardMismatch = true;
        }
      }

      // B) Tipo de propiedad (si pidió uno específico; si dijo "inmueble" o "propiedad" aplica a todos)
      const requestedSpecificType =
        wantsCasa || wantsDepto || wantsPH || wantsTerreno || wantsLocalOrOficina;
      if (requestedSpecificType) {
        if (wantsCasa && (propTypeNorm.includes('casa') || propTypeNorm.includes('chalet') || propTypeNorm.includes('villa'))) {
          score += 20;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else if (
          wantsDepto &&
          (propTypeNorm.includes('departamento') ||
            propTypeNorm.includes('loft') ||
            propTypeNorm.includes('studio') ||
            propTypeNorm.includes('monoambiente'))
        ) {
          score += 20;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else if (wantsPH && propTypeNorm.includes('ph')) {
          score += 20;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else if (wantsTerreno && (propTypeNorm.includes('terreno') || propTypeNorm.includes('lote'))) {
          score += 20;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else if (
          wantsLocalOrOficina &&
          (propTypeNorm.includes('local') || propTypeNorm.includes('oficina'))
        ) {
          score += 20;
          matchedCriteria.push(`Tipo: ${p.propertyType}`);
        } else {
          score -= 25;
          // Si pidió casa y es un departamento u oficina, mismatch fuerte
          if (wantsCasa && (propTypeNorm.includes('departamento') || propTypeNorm.includes('oficina'))) {
            hardMismatch = true;
          }
        }
      } else {
        matchedCriteria.push(`Inmueble: ${p.propertyType}`);
      }

      // C) Ubicación y cercanía (CABA = Ciudad de Buenos Aires = Capital Federal + barrios CABA + cercanías GBA)
      const hasLocationCriteria =
        specificMatchedPlaces.length > 0 ||
        mentionsBuenosAiresOrCaba ||
        mentionsZonaSur ||
        mentionsZonaNorte ||
        mentionsZonaOeste;

      if (hasLocationCriteria) {
        let locMatched = false;

        // 1. Coincidencia exacta de barrio/localidad
        const exactPlace = specificMatchedPlaces.find((pl) =>
          propFullNorm.includes(normalizeSearchText(pl))
        );
        if (exactPlace) {
          score += 35;
          locMatched = true;
          matchedCriteria.push(`Ubicación: ${p.location}`);
        }

        // 2. Coincidencia con Ciudad de Buenos Aires / CABA / Cercanías
        if (!locMatched && mentionsBuenosAiresOrCaba) {
          const inCaba = isPropertyInCaba(propFullNorm);
          const inGba = isPropertyInGba(propFullNorm);
          if (inCaba) {
            score += 30;
            locMatched = true;
            matchedCriteria.push(`En Ciudad de Buenos Aires (CABA — ${p.location})`);
          } else if (isProximitySearch && inGba) {
            score += 18;
            locMatched = true;
            matchedCriteria.push(`Cerca de Ciudad de Buenos Aires (${p.location})`);
          } else if (qNorm.includes('buenos aires') && !qNorm.includes('ciudad') && inGba) {
            score += 20;
            locMatched = true;
            matchedCriteria.push(`En Buenos Aires (${p.location})`);
          }
        }

        // 3. Coincidencia por región (Zona Sur / Zona Norte / Zona Oeste) o "cerca de <localidad>"
        if (!locMatched) {
          const propInSur = GBA_SUR_KEYWORDS.some((kw) => propLocNorm.includes(kw));
          const propInNorte = GBA_NORTE_KEYWORDS.some((kw) => propLocNorm.includes(kw));
          const propInOeste = GBA_OESTE_KEYWORDS.some((kw) => propLocNorm.includes(kw));

          const askedSurPlace =
            mentionsZonaSur ||
            specificMatchedPlaces.some((pl) =>
              GBA_SUR_KEYWORDS.includes(normalizeSearchText(pl))
            );
          const askedNortePlace =
            mentionsZonaNorte ||
            specificMatchedPlaces.some((pl) =>
              GBA_NORTE_KEYWORDS.includes(normalizeSearchText(pl))
            );
          const askedOestePlace =
            mentionsZonaOeste ||
            specificMatchedPlaces.some((pl) =>
              GBA_OESTE_KEYWORDS.includes(normalizeSearchText(pl))
            );

          if (askedSurPlace && propInSur) {
            score += 18;
            locMatched = true;
            matchedCriteria.push(`Zona cercana (${p.location})`);
          } else if (askedNortePlace && propInNorte) {
            score += 18;
            locMatched = true;
            matchedCriteria.push(`Zona cercana (${p.location})`);
          } else if (askedOestePlace && propInOeste) {
            score += 18;
            locMatched = true;
            matchedCriteria.push(`Zona cercana (${p.location})`);
          }
        }

        if (!locMatched) {
          // Si pidió un lugar específico y no coincide en nada con la zona, descartar
          score -= 40;
          hardMismatch = true;
        }
      }

      // D) Precio / Rango de Presupuesto y Moneda
      const isAskingPesos = qNorm.includes('peso') || qNorm.includes('pesos') || qNorm.includes('ars');
      if (isAskingPesos && p.currency === 'USD') {
        // Mismatch directo de moneda
        score -= 50;
        hardMismatch = true;
      } else if (maxPrice > 0) {
        if (maxPrice <= 200 && isAskingPesos) {
          score -= 60;
          hardMismatch = true;
        } else if (minPrice > 0) {
          // Rango [minPrice, maxPrice]
          if (p.price >= minPrice && p.price <= maxPrice) {
            score += 28;
            matchedCriteria.push(
              `Precio exacto en tu rango (${p.currency} ${p.price.toLocaleString()})`
            );
          } else if (p.price >= minPrice * 0.75 && p.price <= maxPrice * 1.25) {
            score += 12;
            matchedCriteria.push(
              `Precio cercano a tu rango (${p.currency} ${p.price.toLocaleString()})`
            );
          } else {
            score -= 35;
            hardMismatch = true;
          }
        } else {
          // Tope máximo hasta maxPrice
          if (p.price <= maxPrice) {
            score += 25;
            matchedCriteria.push(
              `Dentro de presupuesto (${p.currency} ${p.price.toLocaleString()})`
            );
          } else if (p.price <= maxPrice * 1.25) {
            score += 10;
            matchedCriteria.push(
              `Cercano al presupuesto (${p.currency} ${p.price.toLocaleString()})`
            );
          } else {
            score -= 35;
            hardMismatch = true;
          }
        }
      }

      // E) Dormitorios / Ambientes
      if (minBedrooms > 0) {
        if (p.bedrooms >= minBedrooms) {
          score += 12;
          matchedCriteria.push(`${p.bedrooms} dormitorios (${p.rooms} amb.)`);
        } else if (p.rooms >= minBedrooms) {
          score += 6;
          matchedCriteria.push(`${p.rooms} ambientes`);
        } else {
          score -= 8;
        }
      } else if (minRooms > 1) {
        if (p.rooms >= minRooms) {
          score += 10;
          matchedCriteria.push(`${p.rooms} ambientes`);
        } else {
          score -= 8;
        }
      }

      // F) Comodidades / Features
      keyFeatures.forEach((feat) => {
        const keywords = feat.includes('Piscina')
          ? ['piscina', 'pileta']
          : feat.includes('Jardín')
          ? ['jardin', 'patio', 'parque', 'verde', 'fondo']
          : feat.includes('Balcón')
          ? ['balcon', 'terraza', 'patio']
          : feat.includes('Cochera')
          ? ['cochera', 'garage', 'estacionamiento']
          : [normalizeSearchText(feat.split(' ')[0])];
        if (keywords.some((kw) => propFullNorm.includes(kw))) {
          score += 12;
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
            : [
                `${p.propertyType} en ${p.location}`,
                `${p.currency} ${p.price.toLocaleString()}`,
                `${p.surface} m²`,
              ],
        explanation: `Ofrece ${
          matchedCriteria.length > 0
            ? matchedCriteria.join(', ')
            : `${p.propertyType} en ${p.location} por ${p.currency} ${p.price.toLocaleString()}`
        }.${
          p.features && p.features.length > 0
            ? ` Cuenta con ${p.features.slice(0, 3).join(', ')}.`
            : ''
        }`,
      };
    })
    .filter((item) => item.matchScore >= 50 && !item.hardMismatch)
    .sort((a, b) => b.matchScore - a.matchScore);

  const finalRecs = scored.map(({ hardMismatch, ...rest }) => rest);
  const assistantMessage =
    finalRecs.length > 0
      ? `Encontré ${finalRecs.length} ${
          finalRecs.length === 1 ? 'inmueble disponible' : 'inmuebles disponibles'
        } en el catálogo que coinciden con tu búsqueda.`
      : 'No hay inmuebles que coincidan con esos criterios. Probá ampliar la zona o el rango de precio.';

  return {
    interpretedPreferences: {
      summary:
        minPrice > 0 && maxPrice > 0
          ? `Búsqueda para "${queryText}" (Rango detectado: USD ${minPrice.toLocaleString()} a USD ${maxPrice.toLocaleString()})`
          : `Búsqueda interpretada para: "${queryText}"`,
      operationType: detectedOperation,
      preferredLocations:
        preferredLocationsDisplay.length > 0
          ? Array.from(new Set(preferredLocationsDisplay))
          : ['CABA y Gran Buenos Aires (Todas las zonas)'],
      maxPrice: maxPrice || 0,
      minRooms: minRooms || 1,
      minSurface: 30,
      keyFeatures: keyFeatures.length > 0 ? keyFeatures : ['Búsqueda flexible por ubicación y precio'],
    },
    recommendations: finalRecs,
    assistantMessage,
    isOffTopic: false,
    needsClarification: false,
  };
}
