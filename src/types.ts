export type UserRole = 'cliente' | 'propietario' | 'agente' | 'administrador';

export type OperationTypeChoice = 'alquiler' | 'venta';
export type AvailabilityStatus = 'disponible' | 'reservada' | 'alquilada' | 'vendida';
export type PublicationStatus = 'pendiente' | 'aprobada' | 'rechazada';
export type VisitStatus = 'pendiente' | 'confirmada' | 'reprogramada' | 'rechazada' | 'cancelada' | 'realizada';
export type InquiryStatus = 'pendiente' | 'respondida';
export type DealStatus = 'solicitada' | 'en_revision' | 'aprobada' | 'rechazada' | 'concretada';
export type ClaimTargetType = 'publicacion' | 'usuario' | 'visita' | 'operacion';
export type ClaimStatus = 'abierto' | 'en_revision' | 'resuelto' | 'desestimado';

export type PropertyManagementMode = 'directa' | 'con_agente';
export type AgentRequestType = 'ninguna' | 'elegir_agente' | 'asignacion_admin';
export type AgentAssignmentStatus =
  | 'sin_agente'
  | 'pendiente_agente'
  | 'pendiente_admin'
  | 'asignado'
  | 'rechazado';

export const DEMO_ROLE_EMAILS: Record<UserRole, string> = {
  cliente: 'cliente@clavehogar.com',
  propietario: 'propietario@clavehogar.com',
  agente: 'agente@clavehogar.com',
  administrador: 'admin@clavehogar.com',
};

export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  DISPLAY_NAME_MAX: 100,
  BIO_MAX: 500,
  AGENCY_MAX: 120,
  EMAIL_MAX: 150,
  PHONE_MAX: 40,
  ADDRESS_MAX: 200,
  DNI_MAX: 30,
  PROP_TITLE_MAX: 140,
  PROP_DESC_MAX: 2000,
  PROP_LOC_MAX: 120,
  PROP_ADDR_MAX: 160,
  PROP_FEATURES_MAX: 15,
  PROP_IMAGES_MAX: 8,
  REJECTION_MAX: 400,
  VISIT_NOTES_MAX: 500,
  INQUIRY_MAX: 1000,
  OP_MESSAGE_MAX: 800,
  CONTRACT_TERMS_MAX: 1500,
  CLAIM_SUBJECT_MAX: 140,
  CLAIM_DESC_MAX: 1000,
  CLAIM_RES_MAX: 800,
} as const;

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, SCHEMA_LIMITS.ID_MAX) || 'doc_1';
}

export function truncateText(val: string, max: number): string {
  return val.trim().slice(0, max);
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  dni: string;
  role: UserRole;
  /** Allows a Cliente to also act as Propietario without losing their Cliente capabilities */
  isAlsoOwner?: boolean;
  active: boolean;
  agencyName: string;
  bio: string;
  photoUrl?: string;
}

export interface PropertyItem {
  id: string;
  title: string;
  description: string;
  location: string;
  address: string;
  operationType: OperationTypeChoice;
  propertyType: string;
  price: number;
  currency: 'USD' | 'ARS';
  surface: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  features: string[];
  images: string[];
  availability: AvailabilityStatus;
  publicationStatus: PublicationStatus;
  rejectionReason?: string;
  ownerId: string;
  ownerName: string;
  /** Confirmado únicamente cuando la solicitud fue aceptada por el agente o confirmada por el admin */
  agentId?: string;
  agentName?: string;
  /** Modalidad elegida por el propietario: 'directa' (independiente) o 'con_agente' */
  managementMode?: PropertyManagementMode;
  /** Cómo solicitó el agente: 'ninguna' | 'elegir_agente' | 'asignacion_admin' */
  agentRequestType?: AgentRequestType;
  /** Estado de la solicitud de agente */
  agentAssignmentStatus?: AgentAssignmentStatus;
  /** Agente candidato elegido por el propietario mientras está pendiente */
  requestedAgentId?: string;
  requestedAgentName?: string;
  /** Motivo si el agente elegido rechazó o no está disponible */
  agentRejectionReason?: string;
  createdAtIso: string;
}

export interface VisitItem {
  id: string;
  propertyId: string;
  propertyTitle: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  agentId?: string;
  date: string;
  timeSlot: string;
  status: VisitStatus;
  notes: string;
  createdAtIso: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
}

export interface InquiryItem {
  id: string;
  propertyId: string;
  propertyTitle: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  ownerName?: string;
  agentId?: string;
  agentName?: string;
  question: string;
  reply: string;
  messages: ChatMessage[];
  status: InquiryStatus;
  createdAtIso: string;
  updatedAtIso?: string;
}

export interface OperationItem {
  id: string;
  propertyId: string;
  propertyTitle: string;
  operationType: OperationTypeChoice;
  offeredAmount: number;
  currency: 'USD' | 'ARS';
  clientId: string;
  clientName: string;
  ownerId: string;
  agentId?: string;
  status: DealStatus;
  message: string;
  contractCode?: string;
  contractTerms?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  createdAtIso: string;
}

export interface ClaimItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ClaimTargetType;
  targetReference: string;
  subject: string;
  description: string;
  status: ClaimStatus;
  adminResolution: string;
  createdAtIso: string;
}

export interface CategoryConfigItem {
  id: string;
  name: string;
  kind: 'tipo_inmueble' | 'caracteristica';
  active: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
  read: boolean;
  targetSubView?: string;
  targetPropertyId?: string;
  targetInquiryId?: string;
  createdAtIso: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  targetSubView?: string;
}

export interface AIInterpretedPreferences {
  summary: string;
  operationType: string;
  preferredLocations: string[];
  maxPrice: number;
  minRooms: number;
  minSurface: number;
  keyFeatures: string[];
}

export interface AIRecommendation {
  propertyId: string;
  matchScore: number;
  explanation: string;
  matchedCriteria: string[];
}

export interface AISmartSearchResponse {
  interpretedPreferences: AIInterpretedPreferences;
  recommendations: AIRecommendation[];
}
