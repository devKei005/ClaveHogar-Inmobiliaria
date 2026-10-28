import { PropertyItem } from '../types';
import { INITIAL_PROPERTIES } from '../data/initialData';

export type CurrencyCode = 'USD' | 'ARS';

export interface ExtractedSearchCriteria {
  operationType?: 'venta' | 'alquiler' | null;
  propertyType?: string | null; // e.g. 'casa', 'departamento', 'ph', 'terreno', 'oficina'
  locations?: string[]; // e.g. ['Quilmes'], ['Palermo', 'Belgrano']
  isProximitySearch?: boolean;
  proximityTarget?: string | null; // e.g. 'CABA'
  maxPrice?: number | null;
  minPrice?: number | null;
  currency?: CurrencyCode | null;
  isAmbiguousOrUnrealisticBudget?: boolean;
  unrealisticBudgetReason?: string;
  minBedrooms?: number | null;
  minRooms?: number | null;
  minBathrooms?: number | null;
  requiredFeatures?: string[]; // e.g. ['patio', 'pileta', 'cochera', 'jardin', 'parrilla', 'balcon', 'apto mascotas']
  summary?: string;
  isGeneralInquiry?: boolean;
  requestedAddress?: string | null;
  isSearchBroadened?: boolean;
  isExploringOtherZones?: boolean;
  resetTriggered?: boolean;
  locationNotFound?: boolean;
  mentionedOtherCurrency?: boolean;
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

/**
 * Interpreta números escritos en palabras o dígitos en español
 * Ej: "dos dormitorios" = 2, "2 habitaciones" = 2
 */
export function parseSpanishNumber(text: string): number | null {
  const map: Record<string, number> = {
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  const cleaned = (text || '').toLowerCase().trim();
  if (/^\d+$/.test(cleaned)) return parseInt(cleaned, 10);
  if (map[cleaned] !== undefined) return map[cleaned];
  return null;
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
    'solano',
    'san francisco solano',
    'sf solano',
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
 * Determina con precisión si una propiedad está en CABA (Ciudad Autónoma de Buenos Aires)
 * Excluye rigurosamente cualquier localidad de GBA (Quilmes, San Isidro, etc.)
 */
export function isCabaProperty(prop: PropertyItem): boolean {
  const propText = normalizeText(`${prop.location} ${prop.address}`);
  if (
    propText.includes('zona sur') ||
    propText.includes('zona norte') ||
    propText.includes('zona oeste') ||
    propText.includes('gba') ||
    propText.includes('quilmes') ||
    propText.includes('bernal') ||
    propText.includes('san isidro') ||
    propText.includes('avellaneda') ||
    propText.includes('lanus') ||
    propText.includes('vicente lopez') ||
    propText.includes('tigre')
  ) {
    return false;
  }
  return (
    propText.includes('caba') ||
    propText.includes('capital federal') ||
    propText.includes('ciudad de buenos aires') ||
    propText.includes('ciudad autonoma') ||
    CABA_SUBURBS.some((sub) => propText.includes(sub))
  );
}

let lastKnownCatalogProperties: PropertyItem[] = [];

/**
 * Permite registrar o actualizar las propiedades conocidas en memoria (por ejemplo desde Firestore en tiempo real)
 */
export function setKnownCatalogProperties(properties: PropertyItem[]) {
  if (Array.isArray(properties) && properties.length > 0) {
    lastKnownCatalogProperties = properties;
  }
}

/**
 * Diccionario canónico de localidades con formato y tildes oficiales
 */
const CANONICAL_LOCALITY_NAMES: Record<string, string> = {
  // CABA
  palermo: 'Palermo',
  belgrano: 'Belgrano',
  recoleta: 'Recoleta',
  colegiales: 'Colegiales',
  nunez: 'Núñez',
  'puerto madero': 'Puerto Madero',
  caballito: 'Caballito',
  'villa urquiza': 'Villa Urquiza',
  'villa crespo': 'Villa Crespo',
  almagro: 'Almagro',
  flores: 'Flores',
  floresta: 'Floresta',
  devoto: 'Villa Devoto',
  'villa devoto': 'Villa Devoto',
  'san telmo': 'San Telmo',
  barracas: 'Barracas',
  retiro: 'Retiro',
  chacarita: 'Chacarita',
  balvanera: 'Balvanera',
  // Zona Sur
  quilmes: 'Quilmes',
  lanus: 'Lanús',
  'san francisco solano': 'San Francisco Solano',
  solano: 'San Francisco Solano',
  'sf solano': 'San Francisco Solano',
  bernal: 'Bernal',
  avellaneda: 'Avellaneda',
  berazategui: 'Berazategui',
  'lomas de zamora': 'Lomas de Zamora',
  banfield: 'Banfield',
  temperley: 'Temperley',
  adrogue: 'Adrogué',
  ezeiza: 'Ezeiza',
  'florencio varela': 'Florencio Varela',
  // Zona Norte
  'san isidro': 'San Isidro',
  'vicente lopez': 'Vicente López',
  olivos: 'Vicente López',
  martinez: 'Martínez',
  tigre: 'Tigre',
  nordelta: 'Tigre',
  'san fernando': 'San Fernando',
  pilar: 'Pilar',
  escobar: 'Escobar',
  acassuso: 'Acassuso',
  // Zona Oeste
  moron: 'Morón',
  'ramos mejia': 'Ramos Mejía',
  castelar: 'Castelar',
  haedo: 'Haedo',
  ituzaingo: 'Ituzaingó',
  moreno: 'Moreno',
  merlo: 'Merlo',
  'san justo': 'San Justo',
  hurlingham: 'Hurlingham',
};

/**
 * Extrae dinámicamente las zonas y barrios reales presentes en las propiedades de Firestore
 * y construye una lista legible, profesional y agrupada por región.
 */
export function extractAvailableLocationsSummary(properties?: PropertyItem[]): string {
  const source =
    properties && properties.length > 0
      ? properties
      : lastKnownCatalogProperties.length > 0
      ? lastKnownCatalogProperties
      : INITIAL_PROPERTIES;

  const activeProps = source.filter(
    (p) => p.publicationStatus !== 'rechazada' && p.publicationStatus !== 'suspendida'
  );
  const catalog = activeProps.length > 0 ? activeProps : source;

  const regionMap = new Map<string, string[]>();

  const addLocation = (region: string, locality?: string) => {
    const reg = region.trim();
    if (!reg) return;
    if (!regionMap.has(reg)) {
      regionMap.set(reg, []);
    }
    if (locality) {
      const cleanLoc = locality.trim();
      const list = regionMap.get(reg)!;
      if (cleanLoc && !list.some((existing) => normalizeText(existing) === normalizeText(cleanLoc))) {
        list.push(cleanLoc);
      }
    }
  };

  for (const prop of catalog) {
    const fullLoc = `${prop.location || ''} ${prop.address || ''}`.trim();
    const locNorm = normalizeText(fullLoc);

    // 1. CABA
    if (isCabaProperty(prop) || locNorm.includes('caba') || locNorm.includes('capital federal')) {
      let matchedBarrio: string | undefined;
      const knownBarrios = [
        'palermo',
        'belgrano',
        'recoleta',
        'colegiales',
        'nunez',
        'caballito',
        'puerto madero',
        'villa urquiza',
        'villa crespo',
        'almagro',
        'flores',
        'floresta',
        'devoto',
        'san telmo',
        'barracas',
        'retiro',
        'chacarita',
      ];
      for (const b of knownBarrios) {
        if (locNorm.includes(b)) {
          matchedBarrio = CANONICAL_LOCALITY_NAMES[b] || b;
          break;
        }
      }
      if (!matchedBarrio && prop.location) {
        const parts = prop.location.split(',');
        if (parts.length > 1 && !normalizeText(parts[0]).includes('caba')) {
          matchedBarrio = parts[0].trim();
        }
      }
      addLocation('CABA', matchedBarrio);
      continue;
    }

    // 2. Zona Sur
    if (
      locNorm.includes('zona sur') ||
      locNorm.includes('sur gba') ||
      locNorm.includes('gba sur') ||
      GBA_ZONES.sur.some((s) => locNorm.includes(s))
    ) {
      let matchedLoc: string | undefined;
      const knownSur = [
        'quilmes',
        'lanus',
        'san francisco solano',
        'bernal',
        'avellaneda',
        'berazategui',
        'lomas de zamora',
        'banfield',
        'temperley',
        'adrogue',
        'ezeiza',
        'florencio varela',
      ];
      for (const s of knownSur) {
        if (locNorm.includes(s)) {
          matchedLoc = CANONICAL_LOCALITY_NAMES[s] || s;
          break;
        }
      }
      if (!matchedLoc && prop.location) {
        const cleanPart = prop.location
          .replace(/zona sur/gi, '')
          .replace(/gba sur/gi, '')
          .replace(/residencial/gi, '')
          .replace(/,/g, '')
          .trim();
        if (cleanPart) matchedLoc = cleanPart;
      }
      addLocation('Zona Sur', matchedLoc);
      continue;
    }

    // 3. Zona Norte
    if (
      locNorm.includes('zona norte') ||
      locNorm.includes('norte gba') ||
      locNorm.includes('gba norte') ||
      GBA_ZONES.norte.some((s) => locNorm.includes(s))
    ) {
      let matchedLoc: string | undefined;
      const knownNorte = [
        'san isidro',
        'vicente lopez',
        'olivos',
        'martinez',
        'tigre',
        'nordelta',
        'san fernando',
        'pilar',
        'escobar',
        'acassuso',
      ];
      for (const n of knownNorte) {
        if (locNorm.includes(n)) {
          matchedLoc = CANONICAL_LOCALITY_NAMES[n] || n;
          break;
        }
      }
      if (!matchedLoc && prop.location) {
        const cleanPart = prop.location
          .replace(/zona norte/gi, '')
          .replace(/gba norte/gi, '')
          .replace(/las lomas de/gi, '')
          .replace(/,/g, '')
          .trim();
        if (cleanPart) matchedLoc = cleanPart;
      }
      addLocation('Zona Norte', matchedLoc);
      continue;
    }

    // 4. Zona Oeste
    if (
      locNorm.includes('zona oeste') ||
      locNorm.includes('oeste gba') ||
      locNorm.includes('gba oeste') ||
      GBA_ZONES.oeste.some((s) => locNorm.includes(s))
    ) {
      let matchedLoc: string | undefined;
      const knownOeste = [
        'moron',
        'ramos mejia',
        'castelar',
        'haedo',
        'ituzaingo',
        'moreno',
        'merlo',
        'san justo',
        'hurlingham',
      ];
      for (const o of knownOeste) {
        if (locNorm.includes(o)) {
          matchedLoc = CANONICAL_LOCALITY_NAMES[o] || o;
          break;
        }
      }
      if (!matchedLoc && prop.location) {
        const cleanPart = prop.location
          .replace(/zona oeste/gi, '')
          .replace(/gba oeste/gi, '')
          .replace(/,/g, '')
          .trim();
        if (cleanPart) matchedLoc = cleanPart;
      }
      addLocation('Zona Oeste', matchedLoc);
      continue;
    }

    // 5. Otras provincias o ciudades (ej. Córdoba, Rosario, Mar del Plata, Mendoza)
    if (prop.location) {
      const parts = prop.location.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        const region = parts[parts.length - 1];
        const locality = parts[0];
        addLocation(region, locality);
      } else {
        addLocation(parts[0]);
      }
    }
  }

  const preferredOrder = ['CABA', 'Zona Sur', 'Zona Norte', 'Zona Oeste'];
  const allRegions = Array.from(regionMap.keys()).sort((a, b) => {
    const idxA = preferredOrder.indexOf(a);
    const idxB = preferredOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const formattedSegments: string[] = [];
  for (const region of allRegions) {
    const localities = regionMap.get(region) || [];
    if (localities.length > 0) {
      formattedSegments.push(`${region} (${localities.join(', ')})`);
    } else {
      formattedSegments.push(region);
    }
  }

  if (formattedSegments.length === 0) {
    return 'CABA (Palermo, Belgrano, Recoleta, Colegiales, Núñez), Zona Sur (Quilmes, Lanús, San Francisco Solano) y Zona Norte (San Isidro)';
  }
  if (formattedSegments.length === 1) {
    return formattedSegments[0];
  }
  if (formattedSegments.length === 2) {
    return `${formattedSegments[0]} y ${formattedSegments[1]}`;
  }
  return `${formattedSegments.slice(0, -1).join(', ')} y ${formattedSegments[formattedSegments.length - 1]}`;
}


/**
 * Normaliza y verifica coincidencias de ubicación (1. Ubicación solicitada)
 * Soporta búsqueda de proximidad («cerca de CABA», «alrededores de CABA»)
 * pero si el cliente pide "en CABA" o una localidad específica, NUNCA recomienda lugares incompatibles.
 */
export function evaluateLocation(
  prop: PropertyItem,
  requestedLocations?: string[],
  isProximitySearch?: boolean,
  proximityTarget?: string | null
): {
  isExact: boolean;
  isNearby: boolean;
  isDistant: boolean;
  locationLabel: string;
} {
  const propText = normalizeText(`${prop.location} ${prop.address}`);
  const isCaba = isCabaProperty(prop);

  // Proximidad a CABA ÚNICAMENTE cuando el usuario pidió explícitamente «cerca de CABA» o «alrededores de CABA»
  const asksExplicitNearCaba =
    (isProximitySearch && proximityTarget === 'CABA') ||
    (requestedLocations || []).some((loc) => {
      const l = normalizeText(loc);
      return (
        l.includes('cerca de caba') ||
        l.includes('cerca de capital') ||
        l.includes('alrededor de caba') ||
        l.includes('alrededores de caba') ||
        l.includes('proximo a caba')
      );
    });

  if (asksExplicitNearCaba) {
    if (isCaba) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: `${prop.location} (CABA)` };
    }
    const isSurNear = GBA_ZONES.sur.some((s) => propText.includes(s));
    const isNorteNear = GBA_ZONES.norte.some((s) => propText.includes(s));
    const isOesteNear = GBA_ZONES.oeste.some((s) => propText.includes(s));
    if (isSurNear || isNorteNear || isOesteNear) {
      return {
        isExact: true,
        isNearby: false,
        isDistant: false,
        locationLabel: `${prop.location} (cercano a CABA)`,
      };
    }
  }

  if (!requestedLocations || requestedLocations.length === 0) {
    return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
  }

  for (const loc of requestedLocations) {
    const locNorm = normalizeText(loc);
    if (!locNorm) continue;

    // Búsqueda en CABA / Capital Federal: estrictamente CABA (NUNCA Quilmes ni San Isidro)
    if (
      locNorm === 'caba' ||
      locNorm === 'capital' ||
      locNorm === 'capital federal' ||
      locNorm === 'ciudad de buenos aires'
    ) {
      if (isCaba) {
        return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
      }
      // Fuera de CABA no es CABA: es distant, nunca exacto ni cercano
      return { isExact: false, isNearby: false, isDistant: true, locationLabel: prop.location };
    }

    // Coincidencia directa de la localidad o barrio
    if (propText.includes(locNorm)) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }

    // Zonas regionales de GBA
    if (locNorm.includes('zona sur') && GBA_ZONES.sur.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }
    if (locNorm.includes('zona norte') && GBA_ZONES.norte.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }
    if (locNorm.includes('zona oeste') && GBA_ZONES.oeste.some((s) => propText.includes(s))) {
      return { isExact: true, isNearby: false, isDistant: false, locationLabel: prop.location };
    }

    // Alternativas de cercanía (misma zona regional o barrio vecino)
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
    if (isRequestedInCaba && isCaba) {
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
 * Normaliza y verifica comodidades con equivalencias semánticas reales
 * «patio»: Patio, Patio Inglés, huerta, fondo libre, jardín privado propio.
 * IMPORTANTE: Balcón o balcón terraza NO es patio.
 */
export function checkFeature(prop: PropertyItem, feature: string): boolean {
  const featNorm = normalizeText(feature);
  const propText = normalizeText(
    `${prop.title} ${prop.description} ${(prop.features || []).join(' ')}`
  );

  // PATIO: Debe tener espacio abierto en suelo, jardín privado o patio inglés / interno
  if (featNorm.includes('patio') || featNorm.includes('huerta')) {
    const hasExplicitPatio =
      propText.includes('patio') ||
      propText.includes('patio ingles') ||
      propText.includes('patio interno') ||
      propText.includes('huerta');
    const hasPrivateGardenOrFondo =
      propText.includes('fondo libre') ||
      propText.includes('jardin privado') ||
      propText.includes('jardin parquizado') ||
      propText.includes('parque arbolado') ||
      propText.includes('jardin paisajistico');

    return hasExplicitPatio || hasPrivateGardenOrFondo;
  }

  // PILETA / PISCINA
  if (featNorm.includes('pileta') || featNorm.includes('piscina')) {
    return propText.includes('pileta') || propText.includes('piscina');
  }

  // COCHERA / GARAGE
  if (
    featNorm.includes('cochera') ||
    featNorm.includes('garage') ||
    featNorm.includes('estacionamiento') ||
    featNorm.includes('auto')
  ) {
    return (
      propText.includes('cochera') ||
      propText.includes('garage') ||
      propText.includes('estacionamiento') ||
      propText.includes('vehiculo')
    );
  }

  // JARDÍN / PARQUE / FONDO
  if (
    featNorm.includes('jardin') ||
    featNorm.includes('parque') ||
    featNorm.includes('fondo') ||
    featNorm.includes('verde')
  ) {
    return (
      propText.includes('jardin') ||
      propText.includes('parque') ||
      propText.includes('fondo') ||
      propText.includes('verde')
    );
  }

  // PARRILLA / QUINCHO
  if (featNorm.includes('parrilla') || featNorm.includes('quincho') || featNorm.includes('asador')) {
    return propText.includes('parrilla') || propText.includes('quincho') || propText.includes('asador');
  }

  // BALCÓN / TERRAZA (Estrictamente balcón o terraza aterrazada)
  if (featNorm.includes('balcon') || featNorm.includes('terraza')) {
    return propText.includes('balcon') || propText.includes('terraza');
  }

  // MASCOTAS
  if (featNorm.includes('mascota') || featNorm.includes('pet')) {
    return (
      propText.includes('mascota') ||
      propText.includes('pet friendly') ||
      propText.includes('perro') ||
      propText.includes('gato')
    );
  }

  // SEGURIDAD
  if (featNorm.includes('seguridad') || featNorm.includes('vigilancia')) {
    return propText.includes('seguridad') || propText.includes('vigilancia');
  }

  // CALEFACCIÓN / LOSA
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
    const wantsVenta = qNorm.includes('comprar') || qNorm.includes('venta') || qNorm.includes('compro');
    const wantsAlquiler = qNorm.includes('alquilar') || qNorm.includes('alquiler') || qNorm.includes('alquilo');

    if (currency === 'ARS') {
      if (maxPrice <= 50000) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `Un presupuesto de ${maxPrice} pesos no es realista para alquilar ni comprar una propiedad en el mercado actual.`;
      }
    } else if (wantsAlquiler) {
      if (maxPrice < 50) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `El monto de ${maxPrice} es demasiado bajo para un alquiler.`;
      }
    } else if (wantsVenta) {
      if (maxPrice < 5000) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `Un presupuesto de USD ${maxPrice} para compra es muy inferior al valor de una propiedad.`;
      }
    } else {
      if (maxPrice < 500 && !currency) {
        isAmbiguousOrUnrealistic = true;
        unrealisticReason = `El monto de ${maxPrice} es ambiguo sin especificar la moneda o el tipo de operación.`;
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
/**
 * SISTEMA DE PUNTUACIÓN FLEXIBLE PONDERADO Y RANKING DE PROPIEDADES
 * Prioriza en el orden estricto solicitado:
 * 1. Ubicación solicitada (mayor peso: 40 pts)
 * 2. Compra o alquiler (operación: 35 pts)
 * 3. Presupuesto y moneda (30 pts)
 * 4. Tipo de propiedad: casa, depto, PH, etc. (25 pts)
 * 5. Dormitorios y baños (25 pts total: 15 dorm / 10 baños)
 * 6. Características opcionales: patio, pileta, cochera, etc. (15 pts c/u)
 *
 * REGLA DE ORO DE EXACTAS VS ALTERNATIVAS:
 * Si el cliente pide patio (o pileta, cochera, o cantidad de dormitorios/baños),
 * NUNCA presentar una propiedad sin esa característica como coincidencia exacta.
 * Se ofrece como alternativa con explicación honesta y transparente.
 */
export function verifyPropertiesAgainstCriteria(
  properties: PropertyItem[],
  criteria: ExtractedSearchCriteria
): StrictVerificationResult {
  if (Array.isArray(properties) && properties.length > 0) {
    setKnownCatalogProperties(properties);
  }
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

  // Verificar si la ubicación o dirección solicitada existe en el catálogo
  const hasRequestedLocation = Boolean(
    (criteria.locations && criteria.locations.length > 0) || criteria.requestedAddress
  );

  let hasExactLocationInCatalog = true;
  if (hasRequestedLocation && !criteria.isProximitySearch) {
    hasExactLocationInCatalog = candidates.some((prop) => {
      const locEval = evaluateLocation(
        prop,
        criteria.locations,
        criteria.isProximitySearch,
        criteria.proximityTarget
      );
      return locEval.isExact;
    });
  }

  // CASO DE UBICACIÓN O DIRECCIÓN NO ENCONTRADA EN EL CATÁLOGO:
  // Si el cliente busca una dirección o localidad donde no tenemos propiedades,
  // generamos recomendaciones alternativas de propiedades reales del catálogo
  // que cumplan con la mayor cantidad de necesidades (tipo, operación, presupuesto, comodidades)
  if (hasRequestedLocation && !hasExactLocationInCatalog) {
    const requestedTarget =
      criteria.requestedAddress ||
      (criteria.locations && criteria.locations.length > 0 ? criteria.locations.join(', ') : 'esa dirección');

    const scoredAlts: PropertyMatchAlternative[] = [];

    for (const prop of candidates) {
      let score = 0;
      const matchedCriteria: string[] = [];
      const missingReasons: string[] = [
        `No disponemos de propiedades en ${requestedTarget} (ubicada en ${prop.location})`,
      ];

      const locEval = evaluateLocation(
        prop,
        criteria.locations,
        criteria.isProximitySearch,
        criteria.proximityTarget
      );

      // Bonificación si se encuentra en la misma región o cercanía (ej. Zona Sur para Lanús)
      if (locEval.isNearby) {
        score += 18;
        matchedCriteria.push(`Zona cercana (${locEval.locationLabel})`);
      }

      // Operación
      if (criteria.operationType) {
        if (prop.operationType.toLowerCase() === criteria.operationType.toLowerCase()) {
          score += 35;
          matchedCriteria.push(`Para ${prop.operationType}`);
        } else {
          score -= 10;
          missingReasons.push(`Es para ${prop.operationType} (solicitaste ${criteria.operationType})`);
        }
      } else {
        score += 20;
      }

      // Tipo de propiedad
      if (criteria.propertyType) {
        const pType = normalizeText(prop.propertyType);
        const cType = normalizeText(criteria.propertyType);
        if (pType === cType) {
          score += 30;
          matchedCriteria.push(`Tipo ${prop.propertyType}`);
        } else if (
          (pType.includes('depto') || pType.includes('departamento')) &&
          (cType.includes('ph') || cType.includes('departamento'))
        ) {
          score += 18;
          matchedCriteria.push(`Tipo compatible (${prop.propertyType})`);
        } else if (pType.includes('casa') && cType.includes('ph')) {
          score += 15;
          matchedCriteria.push(`Tipo compatible (${prop.propertyType})`);
        } else {
          score -= 10;
          missingReasons.push(`Tipo ${prop.propertyType} (buscás ${criteria.propertyType})`);
        }
      } else {
        score += 15;
      }

      // Presupuesto
      if (criteria.maxPrice && criteria.maxPrice > 0) {
        const isSameCurrency = !criteria.currency || prop.currency === criteria.currency;
        if (isSameCurrency) {
          if (prop.price <= criteria.maxPrice) {
            score += 25;
            matchedCriteria.push(`Dentro de tu presupuesto (${prop.currency} ${prop.price.toLocaleString()})`);
          } else if (prop.price <= criteria.maxPrice * 1.25) {
            score += 10;
            missingReasons.push(`Precio ${prop.currency} ${prop.price.toLocaleString()} (un poco superior a tu presupuesto)`);
          } else {
            score -= 15;
          }
        }
      }

      // Dormitorios
      if (typeof criteria.minBedrooms === 'number' && criteria.minBedrooms > 0) {
        if (prop.bedrooms >= criteria.minBedrooms) {
          score += 15;
          matchedCriteria.push(`${prop.bedrooms} dormitorios`);
        } else {
          missingReasons.push(`Cuenta con ${prop.bedrooms} dormitorios (buscás ${criteria.minBedrooms})`);
        }
      }

      // Comodidades / Características requeridas
      if (criteria.requiredFeatures && criteria.requiredFeatures.length > 0) {
        for (const feat of criteria.requiredFeatures) {
          if (checkFeature(prop, feat)) {
            score += 15;
            matchedCriteria.push(`Con ${feat}`);
          } else {
            missingReasons.push(`Sin ${feat}`);
          }
        }
      }

      const humanDifferenceNote = `En ${prop.location} · Diferente zona a la solicitada`;
      const whyRecommendNote = matchedCriteria.slice(0, 3).join(' · ');

      scoredAlts.push({
        property: prop,
        score,
        humanDifferenceNote,
        whyRecommendNote,
        missingReasons,
        matchedCriteria,
        explanation: `Ubicada en ${prop.location}. Cumple con ${matchedCriteria.slice(0, 2).join(' y ')}.`,
      });
    }

    scoredAlts.sort((a, b) => b.score - a.score);

    return {
      exactMatches: [],
      alternativeMatches: scoredAlts.slice(0, 3),
      criteria: {
        ...criteria,
        locationNotFound: true,
      },
    };
  }

  for (const prop of candidates) {
    let score = 0;
    const matchedCriteria: string[] = [];
    const missingReasons: string[] = [];

    // =========================================================================
    // PRIORIDAD 1: UBICACIÓN SOLICITADA (Peso: 40 pts)
    // =========================================================================
    const locEval = evaluateLocation(
      prop,
      criteria.locations,
      criteria.isProximitySearch,
      criteria.proximityTarget
    );

    if (locEval.isExact) {
      score += 40;
      matchedCriteria.push(`Ubicación: ${locEval.locationLabel}`);
    } else if (locEval.isNearby) {
      score += 18; // Alternativa admisible por cercanía
      missingReasons.push(`Ubicada en ${prop.location} (${locEval.locationLabel})`);
      matchedCriteria.push(`Zona cercana (${locEval.locationLabel})`);
    } else if (locEval.isDistant) {
      score -= 45; // Penalización severa para no recomendar propiedades en otras zonas lejanas
      missingReasons.push(`Ubicada en ${prop.location} (otra localidad)`);
    }

    // =========================================================================
    // PRIORIDAD 2: OPERACIÓN (comprar o alquilar - Peso: 35 pts)
    // =========================================================================
    let opMatches = true;
    if (criteria.operationType) {
      if (prop.operationType.toLowerCase() === criteria.operationType.toLowerCase()) {
        score += 35;
        matchedCriteria.push(`Operación: ${prop.operationType}`);
      } else {
        score -= 20; // Penalización moderada: difiere la operación pero sigue siendo una alternativa válida si coincide en zona
        opMatches = false;
        missingReasons.push(`Es para ${prop.operationType} (solicitaste ${criteria.operationType})`);
      }
    } else {
      score += 18; // Neutral
    }

    // =========================================================================
    // PRIORIDAD 3: PRESUPUESTO Y MONEDA (Peso: 30 pts)
    // =========================================================================
    const propCurrency = prop.currency || 'USD';
    const isCurrencyMismatch = criteria.currency === 'ARS' && propCurrency === 'USD';
    let priceIsWithin = true;

    if (isCurrencyMismatch) {
      score -= 60; // Monedas diferentes sin equivalencia
      priceIsWithin = false;
      missingReasons.push(`Publicada en USD (buscás en pesos)`);
    } else if (typeof criteria.maxPrice === 'number' && criteria.maxPrice > 0) {
      if (prop.price <= criteria.maxPrice) {
        score += 30;
        matchedCriteria.push(`Dentro de presupuesto (${propCurrency} ${prop.price.toLocaleString()})`);
      } else if (prop.price <= criteria.maxPrice * 1.3) {
        // Excede hasta un 30%: se acepta como alternativa de mayor presupuesto
        score += 10;
        priceIsWithin = false;
        matchedCriteria.push(`Presupuesto cercano`);
        missingReasons.push(
          `Supera el presupuesto (precio ${propCurrency} ${prop.price.toLocaleString()} vs. máx. ${propCurrency} ${criteria.maxPrice.toLocaleString()})`
        );
      } else {
        score -= 35; // Muy por encima del presupuesto
        priceIsWithin = false;
        missingReasons.push(
          `Precio muy superior (${propCurrency} ${prop.price.toLocaleString()} vs. máx. ${propCurrency} ${criteria.maxPrice.toLocaleString()})`
        );
      }
    } else {
      score += 15; // Neutral si no definió presupuesto
    }

    // =========================================================================
    // PRIORIDAD 4: TIPO DE PROPIEDAD (casa, depto, PH - Peso: 25 pts)
    // =========================================================================
    let typeMatchesExact = true;
    let typeMatchesCompatible = true;

    if (criteria.propertyType) {
      const typeEval = matchesPropertyType(prop.propertyType, criteria.propertyType);
      if (typeEval.isExact) {
        score += 25;
        matchedCriteria.push(`Tipo: ${prop.propertyType}`);
      } else if (typeEval.isCompatible) {
        score += 14; // Compatible afín como dúplex o PH con patio para casa
        typeMatchesExact = false;
        matchedCriteria.push(`Tipo afín: ${prop.propertyType}`);
        missingReasons.push(`Es ${prop.propertyType} (buscás ${criteria.propertyType})`);
      } else {
        score -= 15; // Penalización moderada para admitir como alternativa
        typeMatchesExact = false;
        typeMatchesCompatible = false;
        missingReasons.push(`Es ${prop.propertyType} (buscás ${criteria.propertyType})`);
      }
    } else {
      score += 15; // Neutral
    }

    // =========================================================================
    // PRIORIDAD 5: DORMITORIOS Y BAÑOS (Peso: 25 pts total)
    // =========================================================================
    let bedroomsMatch = true;
    if (typeof criteria.minBedrooms === 'number' && criteria.minBedrooms > 0) {
      if (prop.bedrooms >= criteria.minBedrooms) {
        score += 15;
        matchedCriteria.push(`${prop.bedrooms} dormitorios`);
      } else {
        score -= 15;
        bedroomsMatch = false;
        missingReasons.push(`${prop.bedrooms} dorm. (solicitaste ${criteria.minBedrooms})`);
      }
    }

    let bathroomsMatch = true;
    if (typeof criteria.minBathrooms === 'number' && criteria.minBathrooms > 0) {
      if (prop.bathrooms >= criteria.minBathrooms) {
        score += 10;
        matchedCriteria.push(`${prop.bathrooms} baños`);
      } else {
        score -= 10;
        bathroomsMatch = false;
        missingReasons.push(`${prop.bathrooms} baños (solicitaste ${criteria.minBathrooms})`);
      }
    }

    // =========================================================================
    // PRIORIDAD 6: CARACTERÍSTICAS OPCIONALES / COMODIDADES (15 pts c/u)
    // =========================================================================
    let missingRequiredFeature: string | null = null;

    if (Array.isArray(criteria.requiredFeatures) && criteria.requiredFeatures.length > 0) {
      for (const feat of criteria.requiredFeatures) {
        const featHasIt = checkFeature(prop, feat);
        if (featHasIt) {
          if (feat.includes('patio')) {
            score += 15;
            matchedCriteria.push('Con patio / espacio verde propio');
          } else if (feat.includes('pileta') || feat.includes('piscina')) {
            score += 15;
            matchedCriteria.push('Con pileta / piscina');
          } else if (feat.includes('cochera')) {
            score += 12;
            matchedCriteria.push('Con cochera');
          } else if (feat.includes('jard')) {
            score += 12;
            matchedCriteria.push('Con jardín');
          } else if (feat.includes('parrilla')) {
            score += 10;
            matchedCriteria.push('Con parrilla');
          } else {
            score += 8;
            matchedCriteria.push(`Con ${feat}`);
          }
        } else {
          // Feature requerida ausente: descalifica de coincidencia exacta
          if (!missingRequiredFeature) {
            missingRequiredFeature = feat;
          }
          if (feat.includes('patio')) {
            missingReasons.push('No cuenta con patio (posee balcón o terraza)');
          } else if (feat.includes('pileta') || feat.includes('piscina')) {
            missingReasons.push('No cuenta con pileta');
          } else if (feat.includes('cochera')) {
            missingReasons.push('Sin cochera cubierta');
          } else if (feat.includes('jard')) {
            missingReasons.push('Sin jardín propio');
          } else {
            missingReasons.push(`Sin ${feat}`);
          }
        }
      }
    }

    // =========================================================================
    // CLASIFICACIÓN DE RESULTADOS: EXACTA VS ALTERNATIVA
    // =========================================================================
    const isDistant = locEval.isDistant;

    // REGLA FUNDAMENTAL DE UBICACIÓN:
    // Nunca incluir propiedades en zonas lejanas incompatibles (ej. no mezclar Quilmes con CABA)
    if (isDistant) {
      continue;
    }

    if (isCurrencyMismatch) {
      continue;
    }

    // Si la ubicación solicitada es exacta o cercana, la admitimos para evaluación
    if (!locEval.isExact && !locEval.isNearby && criteria.locations && criteria.locations.length > 0) {
      continue;
    }

    if (score < 15) {
      continue;
    }

    const allFeaturesSatisfied = missingRequiredFeature === null;

    // Coincidencia EXACTA: cumple ubicación exacta, operación, tipo exacto/compatible, presupuesto, dormitorios, baños y comodidades
    if (
      locEval.isExact &&
      opMatches &&
      (typeMatchesExact || typeMatchesCompatible) &&
      priceIsWithin &&
      bedroomsMatch &&
      bathroomsMatch &&
      allFeaturesSatisfied
    ) {
      exactMatches.push(prop);
    } else {
      // Alternativa Sugerida: cumple los criterios estructurales pero tiene alguna diferencia puntual
      let humanDifferenceNote = '';
      if (!opMatches) {
        humanDifferenceNote = `En ${prop.location} · Publicación para ${prop.operationType} (solicitaste ${criteria.operationType})`;
      } else if (!typeMatchesExact && !typeMatchesCompatible) {
        humanDifferenceNote = `En ${prop.location} · Tipo ${prop.propertyType} (buscás ${criteria.propertyType})`;
      } else if (!allFeaturesSatisfied) {
        if (missingRequiredFeature?.includes('patio')) {
          humanDifferenceNote = `En ${prop.location} y en precio · No cuenta con patio (tiene balcón terraza)`;
        } else if (missingRequiredFeature?.includes('pileta')) {
          humanDifferenceNote = `En ${prop.location} y en precio · No cuenta con pileta`;
        } else {
          humanDifferenceNote = `En ${prop.location} · No cuenta con ${missingRequiredFeature}`;
        }
      } else if (!priceIsWithin) {
        humanDifferenceNote = `En ${prop.location} · Valor ${prop.currency} ${prop.price.toLocaleString()} (un poco por encima de tu presupuesto)`;
      } else if (locEval.isNearby) {
        humanDifferenceNote = `Ubicada en ${prop.location} (${locEval.locationLabel})`;
      } else if (!bedroomsMatch) {
        humanDifferenceNote = `Cuenta con ${prop.bedrooms} dormitorios (buscás ${criteria.minBedrooms})`;
      } else if (!bathroomsMatch) {
        humanDifferenceNote = `Cuenta con ${prop.bathrooms} baños (buscás ${criteria.minBathrooms})`;
      } else if (!typeMatchesExact) {
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

  // Ordenar exactas por menor precio
  exactMatches.sort((a, b) => a.price - b.price);

  // REGLA CRUCIAL: Si coincide lo que pide con el cliente, SOLAMENTE mandarle las que quiere
  // SIN recomendar otras que no coinciden!
  if (exactMatches.length > 0) {
    return {
      exactMatches,
      alternativeMatches: [], // Estrictamente vacías cuando hay coincidencias exactas
      criteria,
    };
  }

  // En el caso de que NO coincida al 100%, recién acá se recomiendan alternativas
  // Las alternativas deben respetar estrictamente la zona (si pidió CABA, jamás recomendar Quilmes)
  const isCabaRequested = (criteria.locations || []).some((l) => {
    const norm = normalizeText(l);
    return norm === 'caba' || norm === 'capital' || norm === 'capital federal' || CABA_SUBURBS.includes(norm);
  });
  const isQuilmesRequested = (criteria.locations || []).some((l) => normalizeText(l).includes('quilmes'));

  const filteredAlternatives = alternativeMatches.filter((alt) => {
    if (isCabaRequested) {
      return isCabaProperty(alt.property);
    }
    if (isQuilmesRequested) {
      const loc = normalizeText(`${alt.property.location} ${alt.property.address}`);
      return loc.includes('quilmes') || GBA_ZONES.sur.some((s) => loc.includes(s));
    }
    return true;
  });

  filteredAlternatives.sort((a, b) => b.score - a.score);

  return {
    exactMatches: [],
    alternativeMatches: filteredAlternatives.slice(0, 3),
    criteria,
  };
}

/**
 * Extractor semántico local que comprende lenguaje natural, dinero, números escritos en palabras,
 * sinónimos y búsqueda por cercanía
 */
export function extractCriteriaLocally(
  query: string,
  _prevCriteria?: ExtractedSearchCriteria
): ExtractedSearchCriteria {
  const qNorm = normalizeText(query);
  const updated: ExtractedSearchCriteria = {
    requiredFeatures: [],
    locations: [],
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
  } else if (qNorm.includes('duplex') || qNorm.includes('dúplex')) {
    updated.propertyType = 'duplex';
  } else if (qNorm.includes('ph')) {
    updated.propertyType = 'ph';
  } else if (qNorm.includes('terreno') || qNorm.includes('lote')) {
    updated.propertyType = 'terreno';
  } else if (qNorm.includes('oficina') || qNorm.includes('local')) {
    updated.propertyType = 'oficina';
  }

  // 3. Proximidad y Ubicaciones («cerca de CABA», «cerca de capital», «alrededores de CABA»)
  const asksNearCaba =
    /\bcerca de (?:caba|capital)\b/.test(qNorm) ||
    /\balrededor(?:es)? de (?:caba|capital)\b/.test(qNorm) ||
    /\bproxim[oa]s? a (?:caba|capital)\b/.test(qNorm) ||
    /\bcercanias de (?:caba|capital)\b/.test(qNorm);

  if (asksNearCaba) {
    updated.isProximitySearch = true;
    updated.proximityTarget = 'CABA';
    updated.locations = ['CABA'];
  } else {
    const isGeneralProximity =
      /\bcerca de\b/.test(qNorm) ||
      /\balrededor(?:es)? de\b/.test(qNorm) ||
      /\bproxim[oa]s? a\b/.test(qNorm) ||
      /\bcercanias de\b/.test(qNorm);
    if (isGeneralProximity) {
      updated.isProximitySearch = true;
    }

    const knownLocations = [
      ...Object.keys(CANONICAL_LOCALITY_NAMES),
      ...CABA_SUBURBS,
      ...GBA_ZONES.sur,
      ...GBA_ZONES.norte,
      ...GBA_ZONES.oeste,
      'caba',
      'capital federal',
      'capital',
      'zona sur',
      'zona norte',
      'zona oeste',
      'cordoba',
      'córdoba',
      'rosario',
      'mendoza',
      'la plata',
      'mar del plata',
      'salta',
      'santa fe',
      'neuquen',
      'neuquén',
      'bariloche',
      'tandil',
      'bahia blanca',
      'bahía blanca',
    ];

    const foundLocs: string[] = [];
    for (const loc of knownLocations) {
      const rx = loc.includes(' ') ? new RegExp(loc, 'i') : new RegExp(`\\b${loc}\\b`, 'i');
      if (rx.test(qNorm)) {
        if (loc === 'caba' || loc === 'capital federal' || loc === 'capital') {
          if (new RegExp(`\\b${loc}\\b`, 'i').test(qNorm)) {
            foundLocs.push('CABA');
          }
        } else if (loc === 'solano' || loc === 'sf solano' || loc === 'san francisco solano') {
          foundLocs.push('San Francisco Solano');
        } else if (CANONICAL_LOCALITY_NAMES[loc]) {
          foundLocs.push(CANONICAL_LOCALITY_NAMES[loc]);
        } else {
          foundLocs.push(loc.charAt(0).toUpperCase() + loc.slice(1));
        }
      }
    }

    // Detección de direcciones puntuales con calle / avenida y altura
    const streetAddressMatch = query.match(
      /\b(?:en\s+)?(?:av\.?|avenida|calle|pasaje|bv\.?|bulevar)\s+([A-Za-z0-9áéíóúñÁÉÍÓÚÑ\s\.]+?)(?=\s+(?:un|una|unos|unas|el|la|los|las|por|hasta|con|para|de|alquiler|venta|casa|depto|departamento|ph)|\s*$)/i
    );
    if (streetAddressMatch) {
      const cleanAddr = streetAddressMatch[0].replace(/^en\s+/i, '').trim();
      if (cleanAddr.length > 3) {
        updated.requestedAddress = cleanAddr;
        if (!foundLocs.some((l) => cleanAddr.toLowerCase().includes(l.toLowerCase()))) {
          foundLocs.push(cleanAddr);
        }
      }
    }

    // Detección genérica de "en [Lugar/Dirección]" cuando no se identificó por listas
    if (foundLocs.length === 0) {
      const genericEnMatch = query.match(
        /\ben\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s\.\,]+?)(?=\s+(?:un|una|unos|unas|el|la|los|las|por|hasta|con|para|de|alquiler|venta|casa|depto|departamento|sin|y|\?|\!|\.)|\s*$)/i
      );
      if (genericEnMatch) {
        const rawPlace = genericEnMatch[1].trim();
        const cleanPlaceNorm = normalizeText(rawPlace);
        const stopWords = [
          'alquiler',
          'venta',
          'cuotas',
          'dolares',
          'pesos',
          'efectivo',
          'general',
          'clavehogar',
          'esta zona',
          'este momento',
          'la zona',
          'el momento',
          'cuanto',
          'donde',
        ];
        if (!stopWords.includes(cleanPlaceNorm) && rawPlace.length >= 3 && rawPlace.length <= 40) {
          foundLocs.push(rawPlace.charAt(0).toUpperCase() + rawPlace.slice(1));
        }
      }
    }

    if (foundLocs.length > 0) {
      updated.locations = Array.from(new Set(foundLocs));
      if (!isGeneralProximity) {
        updated.isProximitySearch = false;
        updated.proximityTarget = null;
      }
    }
  }

  const ignoresBudget =
    qNorm.includes('presupuesto no me importa') ||
    qNorm.includes('sin presupuesto') ||
    qNorm.includes('no importa el presupuesto') ||
    qNorm.includes('sin limite') ||
    qNorm.includes('presupuesto libre') ||
    qNorm.includes('no importa el precio');

  if (ignoresBudget) {
    updated.maxPrice = null;
    updated.minPrice = null;
    updated.currency = null;
    updated.isAmbiguousOrUnrealisticBudget = false;
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

  // 5. Dormitorios y Ambientes con soporte de palabras y dígitos en español
  // Ej: "dos dormitorios" = 2, "2 habitaciones" = 2, "3 ambientes" = 2 dormitorios
  const numPattern = '(\\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)';
  const dormRegex = new RegExp(
    `(${numPattern})\\s*(?:dormitorios?|habitaciones|habitacion|dorm\\b|piezas?|cuartos?|hab\\b)`,
    'i'
  );
  const dormMatch = qNorm.match(dormRegex);
  if (dormMatch) {
    const parsed = parseSpanishNumber(dormMatch[1]);
    if (parsed && parsed > 0) {
      updated.minBedrooms = parsed;
    }
  }

  // Ambientes: 1 ambiente = monoambiente (0 dorm), 2 ambientes = 1 dorm, 3 ambientes = 2 dorm
  const ambRegex = new RegExp(`(${numPattern})\\s*(?:ambientes?|amb\\b)`, 'i');
  const ambMatch = qNorm.match(ambRegex);
  if (ambMatch) {
    const parsedAmb = parseSpanishNumber(ambMatch[1]);
    if (parsedAmb && parsedAmb > 0) {
      updated.minRooms = parsedAmb;
      if (!updated.minBedrooms) {
        updated.minBedrooms = Math.max(0, parsedAmb - 1);
      }
    }
  }

  // Baños: "dos baños" = 2, "2 baños" = 2, "un baño" = 1
  const bathRegex = new RegExp(
    `(${numPattern})\\s*(?:baños?|banos?|toilettes?)`,
    'i'
  );
  const bathMatch = qNorm.match(bathRegex);
  if (bathMatch) {
    const parsedBath = parseSpanishNumber(bathMatch[1]);
    if (parsedBath && parsedBath > 0) {
      updated.minBathrooms = parsedBath;
    }
  }

  // 6. Comodidades con equivalencias semánticas reales
  const featureKeywords: Record<string, string> = {
    patio: 'patio',
    'patio ingles': 'patio',
    'patio interno': 'patio',
    huerta: 'patio',
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
    perro: 'apto mascotas',
    gato: 'apto mascotas',
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
    Boolean(updated.maxPrice) ||
    Boolean(updated.minBedrooms) ||
    Boolean(updated.requiredFeatures && updated.requiredFeatures.length > 0);

  updated.isGeneralInquiry = isGreeting || !hasSpecifics;

  return updated;
}

/**
 * Detecta si el mensaje es un saludo cordial habitual (hola, buen día, etc.)
 */
export function isPureGreetingMessage(text: string): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  const cleaned = qNorm.replace(/[!¡?¿.,;:_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;

  const greetings = [
    'hola',
    'hello',
    'buen dia',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'buenas',
    'que tal',
    'como estas',
    'como te va',
    'como andas',
    'como va',
    'hey',
    'saludos',
    'hola clara',
    'hola buenas',
    'hola que tal',
    'hola como estas',
    'hola buen dia',
    'hola buenos dias',
    'hola buenas tardes',
    'hola buenas noches',
    'buenas como estas',
    'buenas que tal',
  ];

  return greetings.includes(cleaned);
}

/**
 * Detecta si el mensaje no tiene que ver con el sistema inmobiliario (off-topic).
 * Si el cliente pone cualquier tema ajeno (ej. recetas, clima, chistes, deportes, política,
 * matemáticas, filosofía, etc.), Clara debe responder indicándole que no sabe de qué
 * está hablando ya que solo se especializa en temas inmobiliarios y preguntarle si le interesa
 * buscar alguna propiedad para comprar o alquilar.
 */
export function isOffTopicQuery(text: string, currentCriteria?: ExtractedSearchCriteria): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  // 1. Saludos puros (se procesan como bienvenida cordial)
  if (isPureGreetingMessage(text)) {
    return false;
  }

  // 2. Continuación / Respuestas conversacionales dentro del flujo inmobiliario
  if (
    isDeclineOrGoodbyeMessage(text) ||
    isVisitSchedulingIntent(text) ||
    isExploreOtherOptionsIntent(text) ||
    isPropertyDetailOrProceduralInquiry(text)
  ) {
    return false;
  }

  const shortContinuations = [
    'si', 'dale', 'ok', 'bueno', 'listo', 'genial', 'joya', 'barbaro', 'perfecto',
    'gracias', 'muchas gracias', 'dale gracias', 'por favor', 'si por favor',
    'dale mostrame', 'si me interesa', 'me interesa', 'si quiero', 'bueno dale',
    'dale si', 'a ver', 'la primera', 'la segunda', 'la tercera', 'el primero',
    'el segundo', 'ninguna', 'ninguno', 'mostrame', 'probemos'
  ];
  if (
    shortContinuations.includes(qNorm) ||
    shortContinuations.some((c) => qNorm === `${c}!` || qNorm === `${c}.` || qNorm === `${c}?`)
  ) {
    return false;
  }

  // 3. Verificación de localidades o barrios conocidos de toda la Argentina
  const allKnownLocalities = [
    ...Object.keys(CANONICAL_LOCALITY_NAMES),
    ...CABA_SUBURBS,
    ...GBA_ZONES.sur,
    ...GBA_ZONES.norte,
    ...GBA_ZONES.oeste,
    'caba', 'capital', 'capital federal', 'zona sur', 'zona norte', 'zona oeste',
    'cordoba', 'córdoba', 'rosario', 'mendoza', 'la plata', 'mar del plata',
    'salta', 'santa fe', 'neuquen', 'neuquén', 'bariloche', 'tandil', 'bahia blanca'
  ];
  if (allKnownLocalities.some((loc) => {
    return loc.includes(' ') ? qNorm.includes(loc) : new RegExp(`\\b${loc}\\b`, 'i').test(qNorm);
  })) {
    return false;
  }

  // 4. Extracción previa de criterios inmobiliarios (direcciones, tipos, comodidades, operaciones)
  const localExt = extractCriteriaLocally(text, currentCriteria);
  if (
    (localExt.locations && localExt.locations.length > 0) ||
    localExt.requestedAddress ||
    localExt.propertyType ||
    localExt.operationType ||
    (localExt.requiredFeatures && localExt.requiredFeatures.length > 0) ||
    localExt.maxPrice ||
    localExt.minBedrooms
  ) {
    return false;
  }

  // 5. Frases habituales de consulta inmobiliaria sobre lugares o catálogo
  const propertyInquiryPatterns = [
    /\b(?:tenes|tienen|hay|tendra|tendran|habra|busco|buscamos|quisiera|me gustaria)\s+(?:algo|alguna?|opciones?|propiedades?|inmuebles?|casas?|deptos?|departamentos?|ph)\b/i,
    /\b(?:otra|otro|otras|otros)\s+(?:zona|barrio|lugar|ciudad|localidad|propiedad|inmueble|opcion)/i,
    /\b(?:en qué|en que|cuales|que)\s+zonas?\b/i,
    /\b(?:zona|barrio|ubicacion|direccion|calle|altura)\b/i,
  ];
  if (propertyInquiryPatterns.some((pattern) => pattern.test(qNorm))) {
    return false;
  }

  // 6. Términos inmobiliarios, barrios, localidades y características
  const realEstateKeywords = [
    'casa', 'chalet', 'villa', 'departamento', 'depto', 'dpto', 'piso', 'monoambiente', 'loft', 'ph',
    'duplex', 'dúplex', 'triplex', 'terreno', 'lote', 'oficina', 'local', 'comercial', 'propiedad',
    'propiedades', 'inmueble', 'inmuebles', 'vivienda', 'alquiler', 'alquilar', 'alquilo', 'renta',
    'venta', 'comprar', 'compra', 'compro', 'dormitorio', 'dormitorios', 'habitacion', 'habitaciones',
    'cuarto', 'cuartos', 'ambiente', 'ambientes', 'baño', 'baños', 'banos', 'toilette', 'precio',
    'precios', 'presupuesto', 'costo', 'valor', 'cuanto sale', 'cuanto cuesta', 'dolar', 'dolares',
    'usd', 'pesos', 'ars', 'caba', 'capital', 'capital federal', 'quilmes', 'bernal', 'solano',
    'san francisco solano', 'lanus', 'lanús', 'palermo', 'belgrano', 'recoleta', 'nunez', 'núñez',
    'colegiales', 'caballito', 'puerto madero', 'san isidro', 'vicente lopez', 'vicente lópez',
    'tigre', 'martinez', 'olivos', 'zona sur', 'zona norte', 'zona oeste', 'pileta', 'piscina', 'patio', 'jardin',
    'jardín', 'cochera', 'garage', 'parrilla', 'quincho', 'balcon', 'balcón', 'terraza', 'mascota',
    'mascotas', 'pet friendly', 'expensas', 'seguridad', 'visita', 'visitas', 'agendar', 'coordinar',
    'requisitos', 'garantia', 'garantía', 'caucion', 'caución', 'recibo', 'sueldo', 'mes', 'adelanto',
    'deposito', 'depósito', 'inmobiliaria', 'clavehogar', 'ficha', 'publicacion', 'publicaciones',
    'barrio', 'barrios', 'zona', 'zonas', 'localidad', 'localidades', 'direccion', 'dirección', 'calle',
    'avenida', 'av', 'metros', 'm2', 'superficie', 'orientacion', 'luminoso', 'luz'
  ];

  const hasRealEstateKeyword = realEstateKeywords.some((kw) => {
    if (kw.length <= 4) {
      return new RegExp(`\\b${kw}\\b`, 'i').test(qNorm);
    }
    return qNorm.includes(kw);
  });

  if (hasRealEstateKeyword) {
    return false;
  }

  // 7. Si el mensaje contiene números que podrían ser respuesta de ambientes o presupuesto en contexto
  const containsPriceOrNumber = /\b\d+[\d\.]*\b/.test(qNorm);
  if (containsPriceOrNumber && currentCriteria && (currentCriteria.locations?.length || currentCriteria.operationType)) {
    return false;
  }

  // Es ajeno al sistema inmobiliario (off-topic)
  return true;
}

/**
 * Detecta si un mensaje es un saludo cordial
 */
export function isGreetingOrNonPropertyMessage(text: string): boolean {
  return isPureGreetingMessage(text);
}

/**
 * Verifica si los criterios acumulados tienen los datos esenciales para buscar
 * (Operación: comprar o alquilar; y Ubicación: al menos una zona o barrio o CABA)
 */
export function hasSufficientCriteriaToSearch(criteria: ExtractedSearchCriteria): boolean {
  if (criteria.isGeneralInquiry || criteria.isAmbiguousOrUnrealisticBudget) {
    return false;
  }
  const hasOperation = Boolean(criteria.operationType);
  const hasLocation = Boolean(
    (criteria.locations && criteria.locations.length > 0) || criteria.isProximitySearch
  );
  return hasOperation && hasLocation;
}

/**
 * Genera la pregunta breve y natural para solicitar los datos esenciales faltantes,
 * sin repetir preguntas que el cliente ya haya respondido.
 */
export function getMissingCriteriaQuestion(criteria: ExtractedSearchCriteria): string | null {
  const hasOperation = Boolean(criteria.operationType);
  const hasLocation = Boolean(
    (criteria.locations && criteria.locations.length > 0) || criteria.isProximitySearch
  );

  if (!hasOperation && !hasLocation) {
    return '¿Tenés en mente comprar o preferís alquilar? ¿Y en qué localidad o barrio te gustaría que esté ubicada?';
  }
  if (!hasOperation) {
    const locName = criteria.locations?.[0] || 'esa zona';
    return `Para afinar la búsqueda en ${locName}: ¿buscás comprar o preferís alquilar?`;
  }
  if (!hasLocation) {
    const typeName = criteria.propertyType || 'la propiedad';
    return `¡Perfecto! Para buscarte opciones de ${typeName} para ${criteria.operationType}: ¿en qué localidad o barrio preferís que esté ubicada?`;
  }
  return null;
}

/**
 * Detecta si el cliente se despide o rechaza continuar buscando propiedades
 */
export function isDeclineOrGoodbyeMessage(text: string): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  const goodbyes = [
    'chau',
    'adios',
    'adiós',
    'hasta luego',
    'nos vemos',
    'hasta pronto',
    'muchas gracias chau',
    'gracias chau',
    'chau gracias',
    'gracias adios',
    'listo',
    'No quiero mas informacion'
  ];
  if (goodbyes.some((g) => qNorm.includes(g))) {
    return true;
  }

  const pureDeclines = [
    'no',
    'no gracias',
    'no por ahora',
    'por ahora no',
    'nada mas',
    'nada más',
    'ninguna',
    'no ninguna',
    'deja nomas',
    'dejalo asi',
    'no hace falta',
    'estoy bien',
    'no me interesa',
    'no quiero nada mas',
    'no por el momento',
    'por ahora nada',
    'ninguno',
    'no por favor',
    'paso',
    'no prefiero nada',
    'ningun otro',
    'ninguna otra',
  ];
  if (
    pureDeclines.includes(qNorm) ||
    pureDeclines.some((d) => qNorm === `${d}!` || qNorm === `${d}.` || qNorm === `${d}?`)
  ) {
    return true;
  }

  // Declines with prefix e.g. "no, gracias", "no, por ahora nada"
  if (
    qNorm.startsWith('no,') ||
    qNorm.startsWith('no gracias') ||
    qNorm.startsWith('por ahora no')
  ) {
    if (
      !qNorm.includes('caro') &&
      !qNorm.includes('mas de') &&
      !qNorm.includes('menos de') &&
      !qNorm.includes('pileta') &&
      !qNorm.includes('cochera')
    ) {
      return true;
    }
  }

  // Expresiones de agradecimiento y cierre (ej. "gracias", "muchas gracias", "te agradezco") sin intención de nueva búsqueda
  const gratitudeTerms = ['gracias','ok','bueno','adios','mil gracias', 'te agradezco', 'muy amable'];
  const hasGratitude = gratitudeTerms.some((t) => qNorm.includes(t));
  if (hasGratitude) {
    const hasSearchIntent =
      qNorm.includes('busco') ||
      qNorm.includes('quiero') ||
      qNorm.includes('tenes') ||
      qNorm.includes('tienen') ||
      qNorm.includes('hay') ||
      qNorm.includes('alquilar') ||
      qNorm.includes('comprar') ||
      qNorm.includes('departamento') ||
      qNorm.includes('casa') ||
      qNorm.includes('ph') ||
      qNorm.includes('zona') ||
      qNorm.includes('barrio') ||
      qNorm.includes('caba') ||
      qNorm.includes('quilmes') ||
      qNorm.includes('palermo') ||
      qNorm.includes('belgrano') ||
      qNorm.includes('recoleta');

    if (!hasSearchIntent) {
      return true;
    }
  }

  return false;
}

/**
 * Detecta si el usuario tiene intención de coordinar, pedir o consultar cómo agendar una visita.
 * Por ejemplo: «me interesa una visita», «cómo hacer la visita», «cómo agendo», «quiero ir a verla».
 */
export function isVisitSchedulingIntent(text: string): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  const visitKeywords = [
    'visita',
    'visitar',
    'visitarla',
    'visitarlo',
    'conocerla',
    'conocerlo',
    'ir a ver',
    'ir a verla',
    'ir a verlo',
    'ver en persona',
    'verla en persona',
    'verlo en persona',
    'agendar visita',
    'coordinar visita',
    'coordinar una visita',
    'como hacer la visita',
    'como hago la visita',
    'como hago para visitar',
    'como es la visita',
    'como se hace la visita',
    'como agendar una visita',
    'como agendo',
    'como coordino',
    'como saco turno',
    'turno para ver',
    'me interesa una visita',
    'me interesa la visita',
    'me interesa coordinar',
    'me gustaria una visita',
    'me gustaria visitarla',
    'me gustaria ir a ver',
    'quiero una visita',
    'quiero visitarla',
    'quiero agendar',
    'quiero coordinar',
    'quiero ir a ver',
  ];

  if (visitKeywords.some((k) => qNorm.includes(k))) {
    return true;
  }

  // Si responde "coordinar" sin especificar otra zona ni buscar otra cosa
  if (
    qNorm.includes('coordinar') &&
    !qNorm.includes('otra') &&
    !qNorm.includes('otro') &&
    !qNorm.includes('zona') &&
    !qNorm.includes('propiedad')
  ) {
    return true;
  }

  return false;
}

/**
 * Detecta si el usuario está consultando por dudas de detalles de las propiedades (expensas,
 * mascotas, cochera, requisitos, garantías o funcionamiento) en lugar de una búsqueda activa.
 */
export function isPropertyDetailOrProceduralInquiry(text: string): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  if (isVisitSchedulingIntent(text) || isDeclineOrGoodbyeMessage(text)) {
    return false;
  }

  // Si el usuario está solicitando explícitamente buscar en una nueva localidad, es búsqueda, no solo detalle
  const knownLocations = [
    'quilmes',
    'bernal',
    'solano',
    'lanus',
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
    'capital',
  ];
  const mentionsNewLocation = knownLocations.some((loc) =>
    new RegExp(`\\b${loc}\\b`, 'i').test(qNorm)
  );
  if (
    mentionsNewLocation &&
    (qNorm.includes('tenes') ||
      qNorm.includes('hay') ||
      qNorm.includes('busco') ||
      qNorm.includes('mostrame') ||
      qNorm.includes('encontras'))
  ) {
    return false;
  }

  // Expensas y costos de mantenimiento
  const expensesKeywords = [
    'expensa',
    'expensas',
    'gastos comunes',
    'cuanto paga de expensas',
    'mantenimiento',
    'cuanto son las expensas',
    'costo de expensas',
    'pagan expensas',
  ];
  if (expensesKeywords.some((k) => qNorm.includes(k))) return true;

  // Mascotas
  const petKeywords = [
    'mascota',
    'mascotas',
    'perro',
    'perros',
    'gato',
    'gatos',
    'pet friendly',
    'acepta mascota',
    'aceptan mascota',
    'permiten mascota',
  ];
  if (petKeywords.some((k) => qNorm.includes(k))) return true;

  // Cochera
  const parkingKeywords = [
    'tiene cochera',
    'hay cochera',
    'incluye cochera',
    'con cochera',
    'tiene garage',
    'tiene estacionamiento',
    'espacio para auto',
  ];
  if (parkingKeywords.some((k) => qNorm.includes(k))) return true;

  // Requisitos y garantías
  const reqKeywords = [
    'requisito',
    'requisitos',
    'garantia',
    'garantias',
    'caucion',
    'seguro de caucion',
    'recibo de sueldo',
    'condicion',
    'condiciones',
    'documentacion',
    'deposito',
    'mes de adelanto',
    'que piden para alquilar',
    'que se necesita para alquilar',
  ];
  if (reqKeywords.some((k) => qNorm.includes(k))) return true;

  // Amenities específicos como pregunta sobre la propiedad recomendada
  const amenityQuestions = [
    'tiene balcon',
    'tiene patio',
    'tiene terraza',
    'tiene jardin',
    'tiene pileta',
    'tiene piscina',
    'tiene ascensor',
    'que piso es',
    'cuantos metros',
    'esta disponible',
    'esta desocupada',
    'cuando se puede ingresar',
    'cuando se puede entrar',
  ];
  if (amenityQuestions.some((k) => qNorm.includes(k))) return true;

  // Preguntas sobre procedimiento de la plataforma
  const proceduralQuestions = [
    'como funciona',
    'como hago para',
    'como contacto',
    'como me comunico',
    'como reservar',
    'como se reserva',
    'como alquilo',
    'como compro',
  ];
  if (proceduralQuestions.some((k) => qNorm.includes(k))) return true;

  return false;
}

/**
 * Determina si se deben suprimir las tarjetas/publicaciones de propiedades.
 * REGLA: Sólo mostrar recomendaciones cuando el cliente busca propiedades activamente.
 * Si es una consulta de visita, duda de detalle o trámite, NO mostrar publicaciones.
 */
export function shouldSuppressPropertyCards(
  query: string,
  criteria?: ExtractedSearchCriteria
): boolean {
  if (isPureGreetingMessage(query)) return true;
  if (isOffTopicQuery(query, criteria)) return true;
  if (isDeclineOrGoodbyeMessage(query)) return true;
  if (isVisitSchedulingIntent(query)) return true;
  if (isPropertyDetailOrProceduralInquiry(query)) return true;
  return false;
}

/**
 * Detecta si el usuario desea explorar otras opciones, otras zonas, ver qué más hay,
 * o si responde afirmativamente a la propuesta de ver alternativas o ampliar la búsqueda.
 */
export function isExploreOtherOptionsIntent(text: string): boolean {
  const qNorm = normalizeText(text);
  if (!qNorm) return false;

  if (isDeclineOrGoodbyeMessage(text)) return false;
  if (isVisitSchedulingIntent(text)) return false;

  const explicitPhrases = [
    'otras zonas',
    'otra zona',
    'otras cosas',
    'otra cosa',
    'otro tipo',
    'que otras zonas',
    'que zonas tenes',
    'cuales zonas',
    'que zonas hay',
    'zonas disponibles',
    'que mas tenes',
    'que mas hay',
    'que otra cosa tenes',
    'a ver que mas tenes',
    'a ver que tenes',
    'mostrame que tenes',
    'mostrame otras',
    'mostrame otras opciones',
    'ver otras propiedades',
    'conocer otras propiedades',
    'otras propiedades',
    'otros inmuebles',
    'otra propiedad',
    'otro inmueble',
    'si me interesa saber otras zonas',
    'si quiero saber otras zonas',
    'quiero saber otras zonas',
    'quiero ver otras zonas',
    'quiero conocer otras zonas',
    'ampliemos',
    'ampliar la busqueda',
    'ampliar busqueda',
    'ampliando',
    'cambiar de zona',
    'cambiar busqueda',
    'revisar otro tipo',
    'probar otra cosa',
    'probemos con otra cosa',
    'probemos otra cosa',
    'mostrame alternativas',
    'que opciones tenes',
    'que alternativas tenes',
    'a ver alternativas',
    'me interesa saber otras',
    'quiero saber otras',
    'si me interesa',
    'me interesa',
    'si quiero',
    'si dale',
    'dale probemos',
    'si probemos',
    'dale mostrame',
    'si mostrame',
    'bueno dale',
    'dale si',
    'me gustaria ver',
    'me gustaria',
    'quiero ver',
    'quiero conocer otras',
    'a ver',
  ];

  if (explicitPhrases.some((p) => qNorm.includes(p))) {
    return true;
  }

  const shortAffirmations = ['si', 'dale', 'bueno', 'ok', 'joya', 'listo', 'dale!', 'si por favor', 'dale por favor'];
  if (shortAffirmations.includes(qNorm)) {
    return true;
  }

  return false;
}

/**
 * Verifica si existen propiedades en el catálogo para las ubicaciones solicitadas
 */
export function hasLocationMatchesInCatalog(
  properties?: PropertyItem[],
  requestedLocations?: string[]
): boolean {
  if (!requestedLocations || requestedLocations.length === 0) return true;
  const source =
    properties && properties.length > 0
      ? properties
      : lastKnownCatalogProperties.length > 0
      ? lastKnownCatalogProperties
      : INITIAL_PROPERTIES;
  return source.some((p) => {
    const ev = evaluateLocation(p, requestedLocations);
    return ev.isExact;
  });
}

/**
 * Construye el motivo personalizado, cálido y conciso de por qué se recomiendan
 * las alternativas cuando la dirección o localidad solicitada no existe en el catálogo.
 */
export function buildLocationNotFoundMotive(
  criteria: ExtractedSearchCriteria,
  alternatives: PropertyMatchAlternative[],
  includeZones: boolean = true
): string {
  const parts: string[] = [];

  if (criteria.propertyType) {
    const typePlural =
      criteria.propertyType === 'departamento'
        ? 'departamentos'
        : criteria.propertyType === 'casa'
        ? 'casas'
        : criteria.propertyType;
    parts.push(` ${typePlural}`);
  }

  if (criteria.operationType) {
    parts.push(`la modalidad para ${criteria.operationType === 'venta' ? 'compra' : 'alquiler'}`);
  }

  if (criteria.requiredFeatures && criteria.requiredFeatures.length > 0) {
    parts.push(`comodidades como ${criteria.requiredFeatures.join(' y ')}`);
  }

  if (criteria.maxPrice) {
    parts.push(`un rango de presupuesto acorde (${criteria.currency || 'USD'} ${criteria.maxPrice.toLocaleString()})`);
  } else if (criteria.minBedrooms) {
    parts.push(`contar con ${criteria.minBedrooms} o más dormitorios`);
  }

  if (!includeZones) {
    if (parts.length === 0) {
      return 'características afines a lo que estás buscando';
    }
    if (parts.length === 1) {
      return parts[0];
    }
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  }

  const altZones = Array.from(new Set(alternatives.map((a) => a.property.location))).slice(0, 2);
  const zonesText =
    altZones.length > 0 ? `disponibles en ${altZones.join(' y ')}` : 'disponibles en nuestro catálogo';

  if (parts.length === 0) {
    return `opciones destacadas de nuestro catálogo ${zonesText}`;
  }

  if (parts.length === 1) {
    return `${parts[0]}, ${zonesText}`;
  }

  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}, ${zonesText}`;
}

/**
 * Genera una conclusión breve, humana y natural de Clara sobre las alternativas encontradas,
 * sin copiar ni pegar los textos de las fichas o publicaciones.
 */
export function buildConciseAlternativeConclusion(
  _criteria: ExtractedSearchCriteria,
  alternatives: PropertyMatchAlternative[]
): string {
  if (!alternatives || alternatives.length === 0) {
    return 'Tienen características afines a lo que estás buscando.';
  }

  const firstAlt = alternatives[0];
  const missing = firstAlt.missingReasons || [];
  const whyRecommend = firstAlt.whyRecommendNote || '';

  if (missing.some((m) => m.toLowerCase().includes('venta') || m.toLowerCase().includes('alquiler') || m.toLowerCase().includes('operacion'))) {
    return 'Se encuentran en la localidad solicitada y cuentan con excelentes comodidades y espacios verdes, aunque la publicación disponible es para venta.';
  }

  if (missing.some((m) => m.toLowerCase().includes('dormitorio') || m.toLowerCase().includes('ambiente'))) {
    return 'Se adaptan a tu presupuesto y zona de interés, aunque cuentan con una distribución de ambientes diferente a la solicitada.';
  }

  if (missing.some((m) => m.toLowerCase().includes('ubicacion') || m.toLowerCase().includes('zona') || m.toLowerCase().includes('barrio'))) {
    return 'Comparten el tipo de propiedad y rango de valor que buscás, aunque están situadas en zonas o barrios cercanos.';
  }

  if (missing.some((m) => m.toLowerCase().includes('precio') || m.toLowerCase().includes('presupuesto'))) {
    return 'Cumplen con la zona y comodidades solicitadas, con una diferencia respecto al presupuesto inicial.';
  }

  if (missing.some((m) => m.toLowerCase().includes('pileta') || m.toLowerCase().includes('patio') || m.toLowerCase().includes('cochera'))) {
    return 'Tienen una excelente relación de ubicación y ambientes, aunque difieren en alguna comodidad puntual requerida.';
  }

  if (whyRecommend) {
    return `Son opciones muy convenientes porque coinciden en ${whyRecommend.toLowerCase()}, permitiéndote evaluar alternativas reales del catálogo.`;
  }

  return 'Son opciones destacadas del catálogo que se aproximan en gran medida a tus requerimientos principales.';
}

/**
 * MEMORIA CONVERSACIONAL DEL ASISTENTE:
 * Combina el nuevo mensaje con las preferencias expresadas anteriormente.
 * Conserva los requisitos que el cliente no cambió y actualiza solamente los que modifique.
 * Si el cliente elige o introduce una nueva ubicación (ej. ante la propuesta de Clara),
 * borra los filtros restrictivos anteriores y actualiza con la nueva ubicación.
 */
export function mergeConversationalCriteria(
  previousCriteria: ExtractedSearchCriteria | undefined,
  latestMessage: string,
  newExtraction: ExtractedSearchCriteria
): ExtractedSearchCriteria {
  const prev = previousCriteria || {};
  const qNorm = normalizeText(latestMessage);

  // 0. Saludo cordial puro -> Reset total a nueva charla para cumplir reglas de saludo
  if (isPureGreetingMessage(latestMessage)) {
    return {
      isGeneralInquiry: true,
      resetTriggered: true,
    };
  }

  // 1. Despedida o rechazo -> Reset total a nueva charla
  if (isDeclineOrGoodbyeMessage(latestMessage)) {
    return {
      isGeneralInquiry: true,
      resetTriggered: true,
    };
  }

  // 2. Off-topic puro -> RESETEAR los criterios de búsqueda anteriores para no guardar filtros de antes
  if (isOffTopicQuery(latestMessage, previousCriteria)) {
    return {
      isGeneralInquiry: true,
      resetTriggered: true,
    };
  }

  const isPureGreeting = isPureGreetingMessage(latestMessage);
  const wantsOtherOptions = isExploreOtherOptionsIntent(latestMessage);

  const ignoresBudget =
    qNorm.includes('presupuesto no me importa') ||
    qNorm.includes('sin presupuesto') ||
    qNorm.includes('no importa el presupuesto') ||
    qNorm.includes('sin limite') ||
    qNorm.includes('presupuesto libre') ||
    qNorm.includes('no importa el precio');

  const hasNewLocation = Boolean(newExtraction.locations && newExtraction.locations.length > 0);
  const hasNewAddress = Boolean(newExtraction.requestedAddress);
  const hasNewPropertyType = Boolean(newExtraction.propertyType);
  const hasNewOperation = Boolean(newExtraction.operationType);

  const prevLocsStr = (prev.locations || []).map((l) => normalizeText(l)).sort().join(',');
  const newLocsStr = (newExtraction.locations || []).map((l) => normalizeText(l)).sort().join(',');
  const isDifferentLocation = (hasNewLocation || hasNewAddress) && Boolean(prev.locations?.length || prev.requestedAddress) && prevLocsStr !== newLocsStr;

  // Solo consideramos cambio de tipo si el anterior YA estaba definido y el nuevo es distinto
  const isDifferentPropertyType = Boolean(
    hasNewPropertyType && prev.propertyType && newExtraction.propertyType !== prev.propertyType
  );

  // Si el usuario quiere explorar otras opciones/zonas y NO aportó aún ubicación ni tipo específico
  if (wantsOtherOptions && !hasNewLocation && !hasNewPropertyType) {
    return {
      operationType: hasNewOperation ? newExtraction.operationType : prev.operationType || null,
      locations: [],
      propertyType: null,
      minBedrooms: null,
      minRooms: null,
      minBathrooms: null,
      maxPrice: null,
      minPrice: null,
      requiredFeatures: [],
      isExploringOtherZones: true,
      isGeneralInquiry: false,
    };
  }

  const merged: ExtractedSearchCriteria = {
    isGeneralInquiry: isPureGreeting && !prev.operationType && (!prev.locations || prev.locations.length === 0),
    isExploringOtherZones: false,
    locationNotFound: false,
  };

  // 1. Ubicaciones
  if (hasNewLocation) {
    merged.locations = newExtraction.locations;
    merged.requestedAddress = newExtraction.requestedAddress || null;
    merged.isProximitySearch = false;
    merged.proximityTarget = null;
  } else if (!prev.isExploringOtherZones && prev.locations && prev.locations.length > 0) {
    merged.locations = prev.locations;
    merged.requestedAddress = prev.requestedAddress;
    merged.isProximitySearch = prev.isProximitySearch;
    merged.proximityTarget = prev.proximityTarget;
  }

  // 2. Operación
  if (hasNewOperation) {
    merged.operationType = newExtraction.operationType;
  } else if (prev.operationType) {
    merged.operationType = prev.operationType;
  }

  // 3. Tipo de propiedad
  if (hasNewPropertyType) {
    merged.propertyType = newExtraction.propertyType;
  } else if (prev.propertyType) {
    merged.propertyType = prev.propertyType;
  }

  // 4. Presupuesto
  if (ignoresBudget) {
    merged.maxPrice = null;
    merged.minPrice = null;
    merged.currency = null;
    merged.isAmbiguousOrUnrealisticBudget = false;
  } else if (newExtraction.maxPrice !== null && newExtraction.maxPrice !== undefined) {
    merged.maxPrice = newExtraction.maxPrice;
    merged.minPrice = newExtraction.minPrice ?? null;
    merged.currency = newExtraction.currency || prev.currency || 'USD';
    merged.isAmbiguousOrUnrealisticBudget = Boolean(newExtraction.isAmbiguousOrUnrealisticBudget);
    merged.unrealisticBudgetReason = newExtraction.unrealisticBudgetReason;
  } else if (prev.maxPrice !== undefined) {
    merged.maxPrice = prev.maxPrice;
    merged.minPrice = prev.minPrice ?? null;
    merged.currency = prev.currency;
    merged.isAmbiguousOrUnrealisticBudget = prev.isAmbiguousOrUnrealisticBudget;
    merged.unrealisticBudgetReason = prev.unrealisticBudgetReason;
  }

  // 5. Dormitorios y baños
  if (typeof newExtraction.minBedrooms === 'number' && newExtraction.minBedrooms > 0) {
    merged.minBedrooms = newExtraction.minBedrooms;
  } else if (prev.minBedrooms && !isDifferentPropertyType) {
    merged.minBedrooms = prev.minBedrooms;
  }

  if (typeof newExtraction.minBathrooms === 'number' && newExtraction.minBathrooms > 0) {
    merged.minBathrooms = newExtraction.minBathrooms;
  } else if (prev.minBathrooms && !isDifferentPropertyType) {
    merged.minBathrooms = prev.minBathrooms;
  }

  if (typeof newExtraction.minRooms === 'number' && newExtraction.minRooms > 0) {
    merged.minRooms = newExtraction.minRooms;
  } else if (prev.minRooms && !isDifferentPropertyType) {
    merged.minRooms = prev.minRooms;
  }

  // 6. Comodidades
  if (newExtraction.requiredFeatures && newExtraction.requiredFeatures.length > 0) {
    merged.requiredFeatures = newExtraction.requiredFeatures;
  } else if (prev.requiredFeatures && !isDifferentPropertyType) {
    merged.requiredFeatures = prev.requiredFeatures;
  } else {
    merged.requiredFeatures = [];
  }

  return merged;
}

/**
 * Genera la respuesta conversacional humana, cálida y natural de Clara
 */
export function buildAgentConversationReply(
  userQuery: string,
  previousCriteria: ExtractedSearchCriteria | undefined,
  criteria: ExtractedSearchCriteria,
  result: StrictVerificationResult,
  availableProperties?: PropertyItem[]
): { message: string } {
  const { exactMatches, alternativeMatches } = result;
  const qNorm = normalizeText(userQuery);

  // 0. Off-topic (consulta ajena al mercado inmobiliario)
  if (isOffTopicQuery(userQuery, previousCriteria)) {
    return {
      message:
        'Disculpá, no sé de qué estás hablando ya que solo me especializo en temas inmobiliarios. ¿Te interesa buscar alguna propiedad para comprar o alquilar?',
    };
  }

  // 1. Saludo cordial puro
  if (isPureGreetingMessage(userQuery)) {
    return {
      message:
        '¡Hola! Soy Clara, asesora en ClaveHogar. ¿Te gustaría que te ayude a encontrar una propiedad? Contame qué buscás (operación, zona, presupuesto) y te busco opciones.',
    };
  }

  // 2. Despedida o rechazo
  if (isDeclineOrGoodbyeMessage(userQuery)) {
    return {
      message:
        '¡Muchas gracias por contactarte con ClaveHogar! Quedo a tu entera disposición para cuando quieras iniciar una nueva búsqueda o consultar sobre alguna propiedad. ¡Que tengas un excelente día!',
    };
  }

  // 2. Consulta de otras zonas o intención de explorar otras cosas sin ubicación definida
  if (
    criteria.isExploringOtherZones ||
    (isExploreOtherOptionsIntent(userQuery) && (!criteria.locations || criteria.locations.length === 0))
  ) {
    const locationsSummary = extractAvailableLocationsSummary(availableProperties);
    return {
      message:
        `¡Excelente! En ClaveHogar disponemos de propiedades en ${locationsSummary}. ¿En cuál de estas zonas te gustaría buscar y qué tipo de inmueble preferís?`,
    };
  }

  // Acknowledgment if previous requirement was just answered
  let acknowledgment = '';
  if (previousCriteria && !previousCriteria.operationType && criteria.operationType) {
    acknowledgment = `¡Perfecto! `;
  } else if (previousCriteria && (!previousCriteria.locations || previousCriteria.locations.length === 0) && criteria.locations && criteria.locations.length > 0) {
    acknowledgment = `¡Entendido! Buscando en ${criteria.locations.join(', ')}. `;
  } else if (
    previousCriteria &&
    previousCriteria.locations &&
    previousCriteria.locations.length > 0 &&
    criteria.locations &&
    criteria.locations.length > 0 &&
    previousCriteria.locations.join(',') !== criteria.locations.join(',')
  ) {
    acknowledgment = `¡Entendido! Buscando en ${criteria.locations.join(', ')}. `;
  }

  // 3. Intención de coordinar o consultar cómo hacer una visita presencial
  if (isVisitSchedulingIntent(userQuery)) {
    return {
      message: `¡Coordinar una visita es muy sencillo desde la plataforma!\n\nPara agendarla:\n1. Hacé clic en la publicación o botón «Ver Ficha Completa» de la propiedad que te interese.\n2. En la ficha, presioná el botón «Agendar visita».\n3. Seleccioná la fecha y el horario que te quede más cómodo, y si querés agregá una nota o consulta.\n4. Enviás la solicitud y el equipo se pondrá en contacto para confirmar el turno.`,
    };
  }

  // 4. Consultas de dudas sobre detalles de las propiedades (expensas, mascotas, cochera, requisitos)
  if (isPropertyDetailOrProceduralInquiry(userQuery)) {
    const isExpenses =
      qNorm.includes('expensa') || qNorm.includes('mantenimiento') || qNorm.includes('gastos');
    const isPets =
      qNorm.includes('mascota') || qNorm.includes('perro') || qNorm.includes('gato');
    const isParking =
      qNorm.includes('cochera') || qNorm.includes('garage') || qNorm.includes('estacionamiento');
    const isRequirements =
      qNorm.includes('requisito') ||
      qNorm.includes('garantia') ||
      qNorm.includes('caucion') ||
      qNorm.includes('documentacion') ||
      qNorm.includes('recibo de sueldo');

    if (isExpenses) {
      return {
        message: `El valor de las expensas y gastos comunes está especificado en la ficha de cada publicación. Podés ingresar a «Ver Ficha Completa» en la opción que te interese para conocer el importe informado. ¿Tenés alguna otra duda sobre las propiedades o te gustaría buscar en otra zona?`,
      };
    }

    if (isPets) {
      return {
        message: `En la ficha de cada propiedad, dentro de la sección de comodidades y características, se indica si el inmueble es apto para mascotas. Podés verificarlo abriendo la publicación de tu interés en «Ver Ficha Completa». ¿Te gustaría consultar sobre algún otro detalle o preferís explorar otra zona?`,
      };
    }

    if (isParking) {
      return {
        message: `En la ficha de cada propiedad podés verificar si cuenta con cochera propia o cubierta, así como el resto de sus comodidades y ambientes. ¿Te gustaría consultar sobre alguna de las opciones o buscar en otra localidad?`,
      };
    }

    if (isRequirements) {
      return {
        message: `Para alquilar habitualmente se solicita:\n1. Demostración de ingresos comprobables (recibo de sueldo o constancia impositiva).\n2. Garantía propietaria o Seguro de Caución.\n3. Mes de adelanto y depósito de garantía.\n\nLos requisitos específicos de cada propietario figuran también en la ficha de cada inmueble. ¿Te gustaría consultar sobre alguna de las opciones o preferís buscar en otra zona?`,
      };
    }

    return {
      message: `En ClaveHogar podés explorar el catálogo, abrir la ficha completa de cualquier propiedad para ver fotos y especificaciones, y solicitar una visita desde el botón «Agendar visita». ¿Te gustaría consultar sobre alguna propiedad en particular o buscar en otra zona?`,
    };
  }


  // Unrealistic budget
  if (criteria.isAmbiguousOrUnrealisticBudget) {
    return {
      message: `El presupuesto que mencionás (${criteria.maxPrice || 'ese valor'}) parece muy bajo para el mercado actual. ¿Te referías a USD o buscabas indicar otro importe?`,
    };
  }

  // Not enough data
  if (!hasSufficientCriteriaToSearch(criteria)) {
    const question = getMissingCriteriaQuestion(criteria);
    return {
      message: question || '¿Podrías indicarme la zona o barrio y si preferís comprar o alquilar?',
    };
  }

  // Found Exact Matches
  if (exactMatches.length > 0) {
    return {
      message: `${acknowledgment}¡Excelente! Encontré propiedades que coinciden con lo que buscás. Te las muestro aquí mismo.`,
    };
  }

  // Found Alternatives cuando no hay coincidencias exactas
  if (alternativeMatches.length > 0) {
    const requestedLoc =
      criteria.requestedAddress ||
      (criteria.locations && criteria.locations.length > 0 ? criteria.locations.join(', ') : '');

    const altZones = Array.from(new Set(alternativeMatches.map((a) => a.property.location)));
    const altZonesText =
      altZones.length === 1
        ? altZones[0]
        : altZones.length === 2
        ? `${altZones[0]} y ${altZones[1]}`
        : `${altZones.slice(0, -1).join(', ')} y ${altZones[altZones.length - 1]}`;

    // Verificamos si las alternativas están efectivamente en la localidad solicitada
    const hasRequestedInCatalog =
      Boolean(requestedLoc) && hasLocationMatchesInCatalog(availableProperties, criteria.locations);

    const allInRequestedLoc =
      Boolean(requestedLoc) &&
      hasRequestedInCatalog &&
      alternativeMatches.every((a) => {
        const ev = evaluateLocation(a.property, criteria.locations);
        return ev.isExact;
      });

    // Verificamos qué aspectos no coincidieron exactamente
    const locMismatch = criteria.locationNotFound || !hasRequestedInCatalog || !allInRequestedLoc;
    const budgetMismatch = Boolean(criteria.maxPrice) && alternativeMatches.some(a => a.missingReasons?.some(m => m.toLowerCase().includes('precio') || m.toLowerCase().includes('presupuesto') || m.toLowerCase().includes('valor')) || a.property.price > (criteria.maxPrice || 0));
    const featuresMismatch = Boolean(criteria.requiredFeatures && criteria.requiredFeatures.length > 0) && alternativeMatches.some(a => a.missingReasons && a.missingReasons.length > 0);

    const mismatchParts: string[] = [];
    if (locMismatch) {
      mismatchParts.push('en cuanto a la ubicación');
    }
    if (budgetMismatch) {
      mismatchParts.push('en cuanto al monto o presupuesto');
    }
    if (featuresMismatch) {
      mismatchParts.push('en cuanto a algunas de las características solicitadas');
    }

    let mismatchDesc = 'en cuanto a la ubicación';
    if (mismatchParts.length === 1) {
      mismatchDesc = mismatchParts[0];
    } else if (mismatchParts.length === 2) {
      mismatchDesc = `${mismatchParts[0]} y ${mismatchParts[1].replace('en cuanto a ', '')}`;
    } else if (mismatchParts.length >= 3) {
      mismatchDesc = `${mismatchParts.slice(0, -1).join(', ')} y ${mismatchParts[mismatchParts.length - 1].replace('en cuanto a ', '')}`;
    }

    // Caso 1: La localidad solicitada NO existe en el catálogo o no hay propiedades en esa ubicación
    if (criteria.locationNotFound || !hasRequestedInCatalog) {
      const motive = buildLocationNotFoundMotive(criteria, alternativeMatches, false);
      return {
        message: `${acknowledgment}Por el momento no disponemos de propiedades en esa dirección que buscás (${requestedLoc || 'esa zona'}) en nuestro catálogo.\n\nAunque no coincidió con los requisitos que querés ${mismatchDesc}, te puedo dar algunas opciones que cumplen con algunas de las necesidades que fuiste mencionando, como ${motive}, disponibles en ${altZonesText}.\n\nTe invito a revisar estas alternativas.`,
      };
    }

    // Caso 2: La localidad solicitada existe en el catálogo pero las alternativas están en zonas cercanas/diferentes
    if (!allInRequestedLoc) {
      const motive = buildLocationNotFoundMotive(criteria, alternativeMatches, false);
      const opText = criteria.operationType ? ` para ${criteria.operationType === 'venta' ? 'compra' : 'alquiler'}` : '';
      const typeText = criteria.propertyType ? ` de tipo ${criteria.propertyType}` : '';
      return {
        message: `${acknowledgment}En ${requestedLoc} no contamos actualmente con publicaciones${opText}${typeText} que coincidan con todos tus requisitos (${mismatchDesc}), pero seleccioné alternativas disponibles en zonas como ${altZonesText} que cumplen con ${motive}.\n\nTe invito a visitar estas opciones.`,
      };
    }

    // Caso 3: Las alternativas están en la misma localidad solicitada, pero difieren en precio, operación o comodidades
    const firstAlt = alternativeMatches[0];
    const missing = firstAlt.missingReasons || [];
    let differenceExplanation = 'se adaptan a tus requerimientos principales con algunas diferencias puntuales';

    if (missing.some((m) => m.toLowerCase().includes('venta') || m.toLowerCase().includes('alquiler') || m.toLowerCase().includes('operacion'))) {
      differenceExplanation = `se encuentran en ${requestedLoc} y cuentan con excelentes comodidades, aunque la publicación disponible es para ${firstAlt.property.operationType}`;
    } else if (missing.some((m) => m.toLowerCase().includes('precio') || m.toLowerCase().includes('presupuesto'))) {
      differenceExplanation = `cumplen con la zona y comodidades en ${requestedLoc}, sin embargo presentan una diferencia respecto al presupuesto inicial`;
    } else if (missing.some((m) => m.toLowerCase().includes('pileta') || m.toLowerCase().includes('patio') || m.toLowerCase().includes('cochera'))) {
      differenceExplanation = `están ubicadas en ${requestedLoc} y en precio, aunque difieren en alguna comodidad requerida`;
    } else if (missing.some((m) => m.toLowerCase().includes('dormitorio') || m.toLowerCase().includes('ambiente'))) {
      differenceExplanation = `se ubican en ${requestedLoc}, aunque con una distribución de ambientes diferente a la solicitada`;
    }

    return {
      message: `${acknowledgment}No encontré propiedades que coincidan al 100% con todos los requisitos en ${requestedLoc}, pero seleccioné alternativas disponibles en esta zona que te pueden servir:\n\n${differenceExplanation.charAt(0).toUpperCase() + differenceExplanation.slice(1)}.\n\nTe invito a revisar estas opciones.`,
    };
  }

  // No results
  const locationsSummary = extractAvailableLocationsSummary(availableProperties);
  if (criteria.locations && criteria.locations.length > 0) {
    const requestedLoc = criteria.locations.join(', ');
    return {
      message: `${acknowledgment}Por el momento no disponemos de propiedades en ${requestedLoc} en nuestro catálogo. Actualmente en ClaveHogar contamos con opciones en ${locationsSummary}. ¿Te gustaría que busquemos en alguna de estas zonas o preferís revisar otro tipo de inmueble?`,
    };
  }

  return {
    message: `${acknowledgment}Por el momento no encontré propiedades que coincidan con esos criterios en nuestro catálogo. Disponemos de opciones en ${locationsSummary}. ¿Te gustaría que probemos revisando otro tipo de inmueble o ampliando la búsqueda a zonas cercanas?`,
  };
}

export function analyzeOffTopicIntent(
  text: string,
  currentCriteria?: ExtractedSearchCriteria
): { isOffTopic: boolean; reply?: string } {
  if (isOffTopicQuery(text, currentCriteria)) {
    return {
      isOffTopic: true,
      reply:
        'Disculpá, no sé de qué estás hablando ya que solo me especializo en temas inmobiliarios. ¿Te interesa buscar alguna propiedad para comprar o alquilar?',
    };
  }
  return { isOffTopic: false };
}

