import {
  PropertyItem,
  VisitItem,
  InquiryItem,
  OperationItem,
  ClaimItem,
  CategoryConfigItem,
  UserProfile,
  NotificationItem,
} from '../types';

export const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85';
const heroPenthouseImg = HERO_IMAGE;
const villaPoolImg =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85';
const nordicLoftImg =
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85';
const townhousePatioImg =
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1400&q=85';
const skylineSuiteImg =
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1400&q=85';

/**
 * Convierte rutas locales de desarrollo (/src/assets/images/... o /assets/...)
 * que hayan quedado guardadas en Firestore en URLs HTTPS permanentes que
 * funcionan tanto en local como en GitHub y Vercel.
 */
export function resolvePropertyImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return HERO_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return HERO_IMAGE;

  // Si es una imagen subida en base64 o una URL HTTPS externa válida, conservarla
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  // Si es una ruta local guardada en Firestore desde Vite (/src/assets/... o /assets/...)
  const lower = trimmed.toLowerCase();
  if (lower.includes('villa_pool')) return villaPoolImg;
  if (lower.includes('nordic_loft')) return nordicLoftImg;
  if (lower.includes('townhouse_patio')) return townhousePatioImg;
  if (lower.includes('skyline_studio')) return skylineSuiteImg;
  if (lower.includes('hero_penthouse')) return HERO_IMAGE;

  return HERO_IMAGE;
}

export function resolvePropertyImages(images: unknown, propertyId?: string): string[] {
  const fallbackByProp = propertyId
    ? INITIAL_PROPERTIES.find((p) => p.id === propertyId)?.images
    : undefined;

  if (!Array.isArray(images) || images.length === 0) {
    return fallbackByProp && fallbackByProp.length > 0 ? fallbackByProp : [HERO_IMAGE];
  }

  const valid = images
    .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
    .map((img) => resolvePropertyImageUrl(img));

  return valid.length > 0
    ? valid
    : fallbackByProp && fallbackByProp.length > 0
    ? fallbackByProp
    : [HERO_IMAGE];
}

export const INITIAL_CATEGORIES: CategoryConfigItem[] = [
  { id: 'cat_depto', name: 'Departamento', kind: 'tipo_inmueble', active: true },
  { id: 'cat_casa', name: 'Casa', kind: 'tipo_inmueble', active: true },
  { id: 'cat_ph', name: 'PH con Patio', kind: 'tipo_inmueble', active: true },
  { id: 'cat_loft', name: 'Loft / Dúplex', kind: 'tipo_inmueble', active: true },
  { id: 'cat_oficina', name: 'Estudio Profesional', kind: 'tipo_inmueble', active: true },
  { id: 'feat_balcon', name: 'Balcón terraza', kind: 'caracteristica', active: true },
  { id: 'feat_mascotas', name: 'Apto mascotas', kind: 'caracteristica', active: true },
  { id: 'feat_cochera', name: 'Cochera cubierta', kind: 'caracteristica', active: true },
  { id: 'feat_seguridad', name: 'Seguridad 24h', kind: 'caracteristica', active: true },
  { id: 'feat_piscina', name: 'Piscina climatizada', kind: 'caracteristica', active: true },
  { id: 'feat_jardin', name: 'Jardín privado', kind: 'caracteristica', active: true },
  { id: 'feat_parrilla', name: 'Parrilla propia', kind: 'caracteristica', active: true },
  { id: 'feat_luminoso', name: 'Orientación Norte / Luz natural', kind: 'caracteristica', active: true },
  { id: 'feat_losa', name: 'Losa radiante', kind: 'caracteristica', active: true },
];

export const INITIAL_USERS: UserProfile[] = [
  {
    uid: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    displayName: 'Martina Echeverría',
    email: 'cliente@clavehogar.com',
   // password: '123456',
    phone: '+54 9 11 4582-9100',
    address: 'Av. Coronel Díaz 2140, CABA',
    dni: '38.412.901',
    role: 'cliente',
    isAlsoOwner: false,
    active: true,
    agencyName: '',
    bio: 'Cliente interesada en propiedades con jardín, pileta o buena terraza.',
  },
  {
    uid: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    displayName: 'Alejandro Santamarina',
    email: 'propietario@clavehogar.com',
   // password: '123456',
    phone: '+54 9 11 5210-3348',
    address: 'Av. del Libertador 4820, Palermo',
    dni: '26.901.445',
    role: 'propietario',
    isAlsoOwner: true,
    active: true,
    agencyName: 'Inversiones Río de la Plata',
    bio: 'Propietario titular de unidades residenciales en Quilmes, Palermo, Belgrano y San Isidro.',
  },
  {
    uid: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    displayName: 'Valentina Alvear',
    email: 'agente@clavehogar.com',
   // password: '123456',
    phone: '+54 9 11 6092-1120',
    address: 'Montevideo 1680, Recoleta',
    dni: '33.190.822',
    role: 'agente',
    isAlsoOwner: false,
    active: true,
    agencyName: 'Estudio Alvear & Asociados CUCICBA 7412',
    bio: 'Corredora inmobiliaria matriculada especializada en gestión integral de ventas y alquileres.',
  },
  {
    uid: 'oBHK3FgaWdU2be5sfIR3aKZ96r43',
    displayName: 'Administrador General',
    email: 'admin@clavehogar.com',
   // password: '123456',
    phone: '+54 9 11 4000-8800',
    address: 'Av. Figueroa Alcorta 3400, CABA',
    dni: '30.554.129',
    role: 'administrador',
    isAlsoOwner: true,
    active: true,
    agencyName: 'ClaveHogar Plataforma Central',
    bio: 'Supervisión total de la plataforma, moderación de publicaciones y control de roles.',
  },
];

export const INITIAL_PROPERTIES: PropertyItem[] = [
  {
    id: 'prop_casa_quilmes_pileta',
    title: 'Casa Moderna de 3 Habitaciones con Pileta y Jardín en Quilmes',
    description:
      'Excelente casa desarrollada en dos plantas en barrio residencial de Quilmes, a minutos del centro y del Parque Cervecero. Cuenta con 3 habitaciones amplias (principal en suite), gran jardín parquizado con pileta climatizada, quincho con parrilla propia y cochera cubierta para dos vehículos.',
    location: 'Quilmes Residencial, Zona Sur GBA',
    address: 'Alvear 840, Quilmes',
    operationType: 'venta',
    propertyType: 'Casa',
    price: 185000,
    currency: 'USD',
    surface: 220,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 3,
    features: [
      'Piscina climatizada',
      'Jardín privado',
      'Parrilla propia',
      'Cochera cubierta',
      'Apto mascotas',
      'Orientación Norte / Luz natural',
    ],
    images: [villaPoolImg, townhousePatioImg, heroPenthouseImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-01T10:00:00Z',
  },
  {
    id: 'prop_chalet_quilmes_parque',
    title: 'Chalet Luminoso cerca de Parque Cervecero con Pileta en Quilmes',
    description:
      'Hermosa casa familiar de 3 dormitorios ubicada cerca de Parque Cervecero en Quilmes. Posee fondo libre con piscina de material, galería semicubierta con parrilla, cocina comedor renovada, calefacción central y portón automatizado.',
    location: 'Quilmes (Parque Cervecero), Zona Sur',
    address: 'Conesa 520, Quilmes',
    operationType: 'venta',
    propertyType: 'Casa',
    price: 196000,
    currency: 'USD',
    surface: 205,
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    features: [
      'Piscina climatizada',
      'Jardín privado',
      'Parrilla propia',
      'Cochera cubierta',
      'Seguridad 24h',
    ],
    images: [townhousePatioImg, villaPoolImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-02T14:20:00Z',
  },
  {
    id: 'prop_penthouse_libertador',
    title: 'Penthouse Botánico con Terraza Panorámica en Palermo Chico',
    description:
      'Residencia en piso alto sobre boulevard arbolado con ventanales de piso a techo, pisos de roble europeo entablonado, mesadas en travertino natural y gran balcón terraza aterrazado con orientación norte. Luz natural todo el día y seguridad permanente.',
    location: 'Palermo Chico, CABA',
    address: 'Av. del Libertador 3180, Piso 11',
    operationType: 'alquiler',
    propertyType: 'Departamento',
    price: 2400,
    currency: 'USD',
    surface: 168,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 3,
    features: [
      'Balcón terraza',
      'Orientación Norte / Luz natural',
      'Cochera cubierta',
      'Seguridad 24h',
      'Apto mascotas',
      'Losa radiante',
    ],
    images: [heroPenthouseImg, nordicLoftImg, skylineSuiteImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-09-28T14:20:00Z',
  },
  {
    id: 'prop_villa_san_isidro',
    title: 'Casa Minimalista de Hormigón Visto y Cedro con Piscina en San Isidro',
    description:
      'Propiedad de arquitectura contemporánea desarrollada en dos plantas sobre lote parquizado en las barrancas de San Isidro. Cuenta con piscina climatizada, galería con parrilla integrada, jardín privado diseñado por paisajista y triple cochera cubierta.',
    location: 'Las Lomas de San Isidro, GBA Norte',
    address: 'Roque Sáenz Peña 1420',
    operationType: 'venta',
    propertyType: 'Casa',
    price: 685000,
    currency: 'USD',
    surface: 340,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 4,
    features: [
      'Piscina climatizada',
      'Jardín privado',
      'Parrilla propia',
      'Cochera cubierta',
      'Apto mascotas',
      'Losa radiante',
    ],
    images: [villaPoolImg, heroPenthouseImg, townhousePatioImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-09-30T10:00:00Z',
  },
  {
    id: 'prop_loft_belgrano',
    title: 'Dúplex Escandinavo de Doble Altura en Belgrano R',
    description:
      'Luminoso loft en dúplex reciclado a nuevo en calle arbolada de Belgrano R. Doble altura real de 5.4 metros, isla central en piedra natural, carpinterías industriales de hierro y pisos de parquet de roble.',
    location: 'Belgrano R, CABA',
    address: 'Melián 2245, Unidad 4B',
    operationType: 'alquiler',
    propertyType: 'Loft / Dúplex',
    price: 1550,
    currency: 'USD',
    surface: 112,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    features: [
      'Orientación Norte / Luz natural',
      'Apto mascotas',
      'Balcón terraza',
      'Cochera cubierta',
      'Seguridad 24h',
    ],
    images: [nordicLoftImg, heroPenthouseImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-01T16:40:00Z',
  },
  {
    id: 'prop_ph_colegiales',
    title: 'PH Clásico Renovado con Patio Inglés y Huerta en Colegiales',
    description:
      'Encantador PH sin expensas altas con patio propio de ladrillo visto, cerramientos de hierro repartido negro, abundante vegetación y parrilla propia. Espacio silencioso ideal para vivir y trabajar desde casa.',
    location: 'Colegiales, CABA',
    address: 'Conde 1190, PB Fondo',
    operationType: 'venta',
    propertyType: 'PH con Patio',
    price: 295000,
    currency: 'USD',
    surface: 135,
    rooms: 4,
    bedrooms: 2,
    bathrooms: 2,
    features: [
      'Jardín privado',
      'Parrilla propia',
      'Apto mascotas',
      'Orientación Norte / Luz natural',
    ],
    images: [townhousePatioImg, nordicLoftImg],
    availability: 'disponible',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-02T11:15:00Z',
  },
  {
    id: 'prop_suite_recoleta',
    title: 'Residencia Ejecutiva con Vista Abierta en Recoleta',
    description:
      'Departamento de diseño con ebanistería a medida en nogal, iluminación arquitectónica cálida, amplio estar comedor apaisado y dormitorio en suite con vestidor. Edificio con seguridad 24h y cochera fija.',
    location: 'Recoleta, CABA',
    address: 'Quintana 450, Piso 8',
    operationType: 'alquiler',
    propertyType: 'Departamento',
    price: 1350,
    currency: 'USD',
    surface: 86,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 2,
    features: [
      'Seguridad 24h',
      'Cochera cubierta',
      'Losa radiante',
      'Balcón terraza',
    ],
    images: [skylineSuiteImg, heroPenthouseImg],
    availability: 'reservada',
    publicationStatus: 'aprobada',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-03T09:30:00Z',
  },
  {
    id: 'prop_pendiente_nunez',
    title: 'Semipiso a Estrenar con Terraza Propia en Núñez',
    description:
      'Unidad pasante de 3 ambientes recién entregada con terraza privada con parrilla, aberturas A40 con DVH, preinstalación de domótica y cochera cubierta en subsuelo. Pendiente de verificación administrativa.',
    location: 'Núñez, CABA',
    address: 'O’Higgins 3410, Piso 6',
    operationType: 'venta',
    propertyType: 'Departamento',
    price: 348000,
    currency: 'USD',
    surface: 118,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 2,
    features: [
      'Balcón terraza',
      'Parrilla propia',
      'Cochera cubierta',
      'Orientación Norte / Luz natural',
    ],
    images: [nordicLoftImg, skylineSuiteImg],
    availability: 'disponible',
    publicationStatus: 'pendiente',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    createdAtIso: '2026-10-04T18:00:00Z',
  },
];

export const INITIAL_VISITS: VisitItem[] = [
  {
    id: 'vis_demo_1',
    propertyId: 'prop_casa_quilmes_pileta',
    propertyTitle: 'Casa Moderna de 3 Habitaciones con Pileta y Jardín en Quilmes',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    date: '2026-10-12',
    timeSlot: '11:00 - 12:00 hs',
    status: 'confirmada',
    notes: 'Quisiera recorrer el parque, la pileta climatizada y verificar los planos.',
    createdAtIso: '2026-10-04T10:30:00Z',
  },
  {
    id: 'vis_demo_2',
    propertyId: 'prop_loft_belgrano',
    propertyTitle: 'Dúplex Escandinavo de Doble Altura en Belgrano R',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    date: '2026-10-14',
    timeSlot: '16:00 - 17:00 hs',
    status: 'pendiente',
    notes: 'Primera visita presencial con mi pareja.',
    createdAtIso: '2026-10-04T15:20:00Z',
  },
];

export const INITIAL_INQUIRIES: InquiryItem[] = [
  {
    id: 'inq_demo_1',
    propertyId: 'prop_casa_quilmes_pileta',
    propertyTitle: 'Casa Moderna de 3 Habitaciones con Pileta y Jardín en Quilmes',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    question: '¿La propiedad cuenta con escritura inmediata y la pileta tiene climatizador solar o a gas?',
    reply: 'Hola Martina, sí, tiene títulos perfectos listos para escriturar y climatizador a gas instalado hace un año.',
    messages: [
      {
        id: 'msg_1',
        senderId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
        senderName: 'Martina Echeverría',
        senderRole: 'cliente',
        text: 'Hola, ¿la propiedad en Quilmes cuenta con escritura inmediata y la pileta tiene climatizador solar o a gas?',
        timestamp: '2026-10-03 12:10',
      },
      {
        id: 'msg_2',
        senderId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
        senderName: 'Valentina Alvear',
        senderRole: 'agente',
        text: '¡Hola Martina! Sí, cuenta con títulos perfectos para escrituración inmediata y el climatizador de la piscina es a gas de alta eficiencia.',
        timestamp: '2026-10-03 14:25',
      },
      {
        id: 'msg_3',
        senderId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
        senderName: 'Martina Echeverría',
        senderRole: 'cliente',
        text: 'Excelente, muchas gracias. ¿Podríamos coordinar para verla este sábado por la mañana?',
        timestamp: '2026-10-03 15:02',
      },
    ],
    status: 'respondida',
    createdAtIso: '2026-10-03T12:10:00Z',
    updatedAtIso: '2026-10-03T15:02:00Z',
  },
  {
    id: 'inq_demo_2',
    propertyId: 'prop_penthouse_libertador',
    propertyTitle: 'Penthouse Botánico con Terraza Panorámica en Palermo Chico',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    ownerName: 'Alejandro Santamarina',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    agentName: 'Valentina Alvear',
    question: '¿Las expensas incluyen calefacción por losa radiante y seguridad 24h? ¿Aceptan seguro de caución?',
    reply: '',
    messages: [
      {
        id: 'msg_4',
        senderId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
        senderName: 'Martina Echeverría',
        senderRole: 'cliente',
        text: '¿Las expensas incluyen calefacción por losa radiante y seguridad 24h? ¿Aceptan seguro de caución?',
        timestamp: '2026-10-04 19:05',
      },
    ],
    status: 'pendiente',
    createdAtIso: '2026-10-04T19:05:00Z',
    updatedAtIso: '2026-10-04T19:05:00Z',
  },
];

export const INITIAL_OPERATIONS: OperationItem[] = [
  {
    id: 'op_demo_1',
    propertyId: 'prop_suite_recoleta',
    propertyTitle: 'Residencia Ejecutiva con Vista Abierta en Recoleta',
    operationType: 'alquiler',
    offeredAmount: 1350,
    currency: 'USD',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    status: 'aprobada',
    message: 'Presento reserva formal por contrato de 24 meses con garantía propietaria en CABA y demostración de ingresos.',
    contractCode: 'CH-2026-REC-084',
    contractTerms: 'Locación habitacional por 24 meses conforme Código Civil y Comercial. Depósito en garantía de 1 mes (USD 1.350). Entrega de unidad recién pintada con inventario firmado.',
    contractStartDate: '2026-11-01',
    contractEndDate: '2028-10-31',
    createdAtIso: '2026-10-03T17:00:00Z',
  },
  {
    id: 'op_demo_2',
    propertyId: 'prop_casa_quilmes_pileta',
    propertyTitle: 'Casa Moderna de 3 Habitaciones con Pileta y Jardín en Quilmes',
    operationType: 'venta',
    offeredAmount: 180000,
    currency: 'USD',
    clientId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    clientName: 'Martina Echeverría',
    ownerId: 'kKqp7VS3xhPYfy6RvCh0SWJIqi12',
    agentId: 'SysykUHU5FVubQzrSHOBi3JnhQs2',
    status: 'solicitada',
    message: 'Oferta de compra al contado libre de gastos con escrituración dentro de los 30 días.',
    createdAtIso: '2026-10-05T08:45:00Z',
  },
];

export const INITIAL_CLAIMS: ClaimItem[] = [
  {
    id: 'clm_demo_1',
    reporterId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    reporterName: 'Martina Echeverría',
    targetType: 'visita',
    targetReference: 'Visita en Recoleta #vis_09',
    subject: 'Demora en confirmación de horario de visita',
    description: 'Solicité cambio de horario hace 48 horas y aún figuraba pendiente en el calendario.',
    status: 'en_revision',
    adminResolution: 'Se notificó a la corredora asignada para priorizar la confirmación en menos de 12 horas.',
    createdAtIso: '2026-10-04T11:00:00Z',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_demo_1',
    userId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    title: 'Reserva confirmada — Quilmes Residencial',
    message: 'Valentina Alvear confirmó tu visita a la Casa con Pileta en Quilmes para el 12/10 a las 11:00 hs.',
    type: 'success',
    read: false,
    createdAtIso: '2026-10-04T12:00:00Z',
  },
  {
    id: 'notif_demo_2',
    userId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    title: 'Nueva respuesta en tu consulta',
    message: 'Valentina Alvear respondió en el chat sobre la Casa Moderna en Quilmes.',
    type: 'info',
    read: false,
    createdAtIso: '2026-10-04T14:30:00Z',
  },
  {
    id: 'notif_demo_3',
    userId: 'NNota96m2mSmoxRc9ENGXgqFMUs1',
    title: 'Solicitud aceptada — Recoleta',
    message: 'Tu solicitud de alquiler para Residencia Ejecutiva en Recoleta fue aprobada.',
    type: 'success',
    read: false,
    createdAtIso: '2026-10-04T16:10:00Z',
  },
];
