import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  Send,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  Check,
  X,
  User,
  Clock,
  AlertCircle,
  Camera,
  CheckCircle2,
  XCircle,
  Briefcase,
  MessageSquare,
  RotateCcw,
  History,
  FileText,
  Sparkles,
  MapPin,
  Calendar,
  Tag,
  Bookmark,
  Building2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  PropertyItem,
  VisitItem,
  VisitStatus,
  InquiryItem,
  OperationItem,
  CounterOfferItem,
  ContractItem,
  DealStatus,
  ClaimItem,
  ClaimTargetType,
  ClaimStatus,
  ClaimMessage,
  ClaimStatusHistoryItem,
  normalizeClaimStatus,
  CategoryConfigItem,
  AvailabilityStatus,
  PublicationStatus,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';
import { HERO_IMAGE, INITIAL_USERS, resolvePropertyImageUrl } from '../data/initialData';
import { CounterOfferModal } from './CounterOfferModal';
import { ContractRegistrationModal } from './ContractRegistrationModal';

export type WorkspaceSubView =
  | 'cliente_favoritos'
  | 'cliente_visitas'
  | 'cliente_operaciones'
  | 'cliente_consultas'
  | 'propietario_inmuebles'
  | 'propietario_visitas'
  | 'propietario_operaciones'
  | 'propietario_consultas'
  | 'agente_cartera'
  | 'agente_visitas'
  | 'agente_operaciones'
  | 'agente_consultas'
  | 'admin_dashboard'
  | 'admin_publicaciones'
  | 'admin_operaciones'
  | 'admin_usuarios'
  | 'admin_categorias'
  | 'admin_reclamos'
  | 'reclamos_usuario';

interface RoleWorkspaceViewProps {
  currentUser: UserProfile;
  activeSubView: WorkspaceSubView;
  onChangeSubView: (sub: WorkspaceSubView) => void;
  users: UserProfile[];
  allProperties: PropertyItem[];
  favoriteIds: string[];
  allVisits: VisitItem[];
  allInquiries: InquiryItem[];
  allOperations: OperationItem[];
  contracts?: ContractItem[];
  claims: ClaimItem[];
  categories: CategoryConfigItem[];
  onEnableOwnerRole: () => Promise<void>;
  onOpenProfileModal?: () => void;
  onOpenNewProperty: () => void;
  onOpenEditProperty: (property: PropertyItem) => void;
  onSelectProperty: (property: PropertyItem) => void;
  onDeleteProperty: (propertyId: string) => Promise<void>;
  onUpdateAvailability: (propertyId: string, availability: AvailabilityStatus) => Promise<void>;
  onOwnerRequestAgent: (
    propertyId: string,
    mode: 'directa' | 'elegir_agente' | 'asignacion_admin',
    chosenAgent?: UserProfile
  ) => Promise<void>;
  onAgentRespondAssignment: (
    propertyId: string,
    accept: boolean,
    reason?: string
  ) => Promise<void>;
  onAdminConfirmAgentAssignment: (
    propertyId: string,
    agentId: string,
    agentName: string
  ) => Promise<void>;
  onModerateProperty: (
    propertyId: string,
    status: PublicationStatus,
    rejectionReason?: string
  ) => Promise<void>;
  onToggleFavorite: (propertyId: string) => void;
  onUpdateVisit: (
    visitId: string,
    status: VisitStatus,
    newDate?: string,
    newSlot?: string,
    notes?: string
  ) => Promise<void>;
  onSendChatMessage: (
    property: PropertyItem,
    messageText: string,
    existingInquiryId?: string
  ) => Promise<void>;
  onUpdateOperation: (
    operationId: string,
    status: DealStatus,
    contractData?: {
      contractCode: string;
      contractTerms: string;
      contractStartDate: string;
      contractEndDate: string;
    }
  ) => Promise<void>;
  onCounterOffer?: (operationId: string, counterData: CounterOfferItem) => Promise<void>;
  onConfirmContract?: (
    operationId: string,
    contractData: Omit<ContractItem, 'id' | 'createdAtIso'>
  ) => Promise<void>;
  onNotify?: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  onCreateClaim: (
    targetType: ClaimTargetType,
    targetReference: string,
    subject: string,
    description: string
  ) => Promise<void>;
  onResolveClaim: (claimId: string, status: ClaimStatus, resolution: string) => Promise<void>;
  onUpdateClaimStatus?: (
    claimId: string,
    newStatus: ClaimStatus,
    note?: string,
    extraFields?: {
      solutionDescription?: string;
      dismissalReason?: string;
      reopenReason?: string;
    }
  ) => Promise<void>;
  onSendClaimMessage?: (claimId: string, text: string) => Promise<void>;
  selectedClaimId?: string | null;
  onSelectClaimId?: (claimId: string | null) => void;
  onUpdateUserAdmin: (uid: string, role: UserRole, active: boolean) => Promise<void>;
  onAddCategory: (name: string, kind: 'tipo_inmueble' | 'caracteristica') => Promise<void>;
  onToggleCategory: (categoryId: string, active: boolean) => Promise<void>;
}

export {
  isAgentConfirmedOnProperty,
  isUserOwnerOfProperty,
  isUserAssignedAgentOfProperty,
  canUserEditProperty,
  getMinVisitDate,
} from '../utils/propertyPermissions';
import {
  isAgentConfirmedOnProperty,
  isUserOwnerOfProperty,
  isUserAssignedAgentOfProperty,
  getMinVisitDate,
} from '../utils/propertyPermissions';

/**
 * Colores semánticos de alto contraste para diferenciar claramente los estados
 * (Rechazado, En revisión / Pendiente, Aprobado / Confirmado, Cancelado, etc.)
 * respecto del color crema/oliva normal de la página.
 */
function getPublicationStatusBadgeClass(status: PublicationStatus): string {
  switch (status) {
    case 'aprobada':
      return 'bg-[#D5BFA0]/30 text-[#173B43] border-[#173B43]';
    case 'pendiente':
      return 'bg-amber-100 text-amber-900 border-amber-400';
    case 'rechazada':
      return 'bg-red-100 text-red-800 border-red-400';
    case 'suspendida':
      return 'bg-red-200 text-red-950 border-red-600';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-400';
  }
}

function getVisitStatusBadgeClass(status: VisitStatus): string {
  switch (status) {
    case 'confirmada':
    case 'realizada':
      return 'bg-[#D5BFA0]/30 text-[#173B43] border-[#173B43]';
    case 'pendiente':
    case 'reprogramada':
      return 'bg-amber-100 text-amber-900 border-amber-400';
    case 'rechazada':
    case 'cancelada':
      return 'bg-red-100 text-red-800 border-red-400';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-400';
  }
}

export function normalizeDealCategory(status?: string): 'concretada' | 'aceptada' | 'proceso' | 'rechazada' {
  const s = (status || '').toString().toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['concretada', 'cerrada', 'finalizada', 'completada'].includes(s)) {
    return 'concretada';
  }
  if (['aceptada', 'aprobada', 'aprobado', 'aceptado'].includes(s)) {
    return 'aceptada';
  }
  if (['rechazada', 'rechazado', 'cancelada', 'cancelado'].includes(s)) {
    return 'rechazada';
  }
  // Todas las demás: 'solicitada', 'pendiente', 'en_negociacion', 'en_revision', 'en_proceso', 'proceso', o sin definir
  return 'proceso';
}

function getDealStatusBadgeClass(status?: DealStatus | string): string {
  const cat = normalizeDealCategory(status);
  switch (cat) {
    case 'concretada':
      return 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold';
    case 'aceptada':
      return 'bg-amber-100 text-amber-950 border-amber-400 font-bold';
    case 'proceso':
      return 'bg-blue-50 text-blue-900 border-blue-300';
    case 'rechazada':
      return 'bg-red-100 text-red-800 border-red-400';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-400';
  }
}

function getClaimStatusBadgeClass(status?: ClaimStatus | string): string {
  const norm = normalizeClaimStatus(status);
  switch (norm) {
    case 'solucionado':
      return 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold';
    case 'en_revision':
      return 'bg-blue-100 text-blue-950 border-blue-400 font-bold';
    case 'pendiente':
    default:
      return 'bg-amber-100 text-amber-950 border-amber-400 font-bold';
  }
}

function getClaimStatusLabel(status?: ClaimStatus | string): string {
  const norm = normalizeClaimStatus(status);
  switch (norm) {
    case 'solucionado':
      return 'SOLUCIONADO';
    case 'en_revision':
      return 'EN REVISIÓN';
    case 'pendiente':
    default:
      return 'PENDIENTE';
  }
}

function getClaimCategoryLabel(targetType?: string): string {
  const t = (targetType || '').toString().toLowerCase().trim();
  switch (t) {
    case 'publicacion':
      return 'Publicación de Inmueble';
    case 'visita':
      return 'Visita Programada';
    case 'operacion':
      return 'Oferta / Contrato';
    case 'usuario':
    case 'general':
      return 'Atención al Usuario / General';
    default:
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'General / Soporte';
  }
}

export const RoleWorkspaceView: React.FC<RoleWorkspaceViewProps> = ({
  currentUser,
  activeSubView,
  onChangeSubView,
  users,
  allProperties,
  favoriteIds,
  allVisits,
  allInquiries,
  allOperations,
  contracts = [],
  claims,
  categories,
  onEnableOwnerRole,
  onOpenProfileModal,
  onOpenNewProperty,
  onOpenEditProperty,
  onSelectProperty,
  onDeleteProperty,
  onUpdateAvailability,
  onOwnerRequestAgent,
  onAgentRespondAssignment,
  onAdminConfirmAgentAssignment,
  onModerateProperty,
  onToggleFavorite,
  onUpdateVisit,
  onSendChatMessage,
  onUpdateOperation,
  onCounterOffer,
  onConfirmContract,
  onNotify,
  onCreateClaim,
  onResolveClaim,
  onUpdateClaimStatus,
  onSendClaimMessage,
  selectedClaimId,
  onSelectClaimId,
  onUpdateUserAdmin,
  onAddCategory,
  onToggleCategory,
}) => {
  const [activeCounterModalOp, setActiveCounterModalOp] = useState<OperationItem | null>(null);
  const [activeContractModalOp, setActiveContractModalOp] = useState<OperationItem | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [rescheduleSlots, setRescheduleSlots] = useState<Record<string, string>>({});
  const [propertyToReject, setPropertyToReject] = useState<PropertyItem | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');
  const [contractDrafts, setContractDrafts] = useState<
    Record<string, { code: string; terms: string; start: string; end: string }>
  >({});

  // Filtro en Panel de Administrador: separar las solicitudes sin acción de las ya respondidas
  const [adminModerationFilter, setAdminModerationFilter] = useState<'pendientes' | 'respondidas'>(
    'pendientes'
  );
  const [adminClaimFilter, setAdminClaimFilter] = useState<'pendientes' | 'en_revision' | 'solucionados'>(
    'pendientes'
  );
  const [resolveClaimModal, setResolveClaimModal] = useState<ClaimItem | null>(null);
  const [resolveDescDraft, setResolveDescDraft] = useState('');
  const [reopenClaimModal, setReopenClaimModal] = useState<ClaimItem | null>(null);
  const [reopenReasonDraft, setReopenReasonDraft] = useState('');
  const [claimReplyDrafts, setClaimReplyDrafts] = useState<Record<string, string>>({});
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(selectedClaimId || null);
  const [opFilter, setOpFilter] = useState<'todos' | 'proceso' | 'aceptadas' | 'concretadas' | 'rechazadas'>('todos');
  const [adminOpFilter, setAdminOpFilter] = useState<'todos' | 'concretadas' | 'aceptadas' | 'negociacion' | 'rechazadas'>('todos');

  // Agent selector modal/drawer per property for Owner
  const [agentSelectorPropId, setAgentSelectorPropId] = useState<string | null>(null);
  const [agentRejectReasonDrafts, setAgentRejectReasonDrafts] = useState<Record<string, string>>({});
  const [adminSelectedAgentByProp, setAdminSelectedAgentByProp] = useState<Record<string, string>>({});

  const [claimTargetType, setClaimTargetType] = useState<ClaimTargetType>('publicacion');
  const [claimSubject, setClaimSubject] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimResolutionDrafts, setClaimResolutionDrafts] = useState<Record<string, string>>({});

  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'tipo_inmueble' | 'caracteristica'>('caracteristica');

  // Estados para gestión de visitas
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [visitToCancel, setVisitToCancel] = useState<VisitItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [visitFilter, setVisitFilter] = useState<'todas' | 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada'>('todas');

  const uniqueUsers = useMemo(() => {
    const seenEmails = new Set<string>();
    const seenUids = new Set<string>();
    const list: UserProfile[] = [];
    for (const u of [...users, ...INITIAL_USERS]) {
      const email = (u.email || '').trim().toLowerCase();
      const uid = (u.uid || '').trim();
      const isDemoProfile = INITIAL_USERS.some(
        (demoUser) => demoUser.email.trim().toLowerCase() === email
      );
      if (email && seenEmails.has(email)) continue;
      if (uid && seenUids.has(uid) && !isDemoProfile) continue;
      if (email) seenEmails.add(email);
      if (uid) seenUids.add(uid);
      list.push(u);
    }
    return list;
  }, [users]);

  const agentsList = uniqueUsers.filter((u) => u.role === 'agente' && u.active);
  const favoriteProperties = allProperties.filter((p) => favoriteIds.includes(p.id));
  const pendingProperties = allProperties.filter((p) => p.publicationStatus === 'pendiente');
  const pendingAgentRequestProperties = allProperties.filter(
    (p) =>
      p.agentAssignmentStatus === 'pendiente_admin' ||
      p.agentAssignmentStatus === 'pendiente_agente'
  );

  // Solicitudes donde el Administrador todavía NO tomó acción (publicación pendiente o solicitud de agente pendiente)
  const adminPendingActionProperties = allProperties.filter(
    (p) =>
      p.publicationStatus === 'pendiente' ||
      p.agentAssignmentStatus === 'pendiente_admin' ||
      p.agentAssignmentStatus === 'pendiente_agente'
  );

  // Publicaciones moderadas sin solicitudes de agente pendientes.
  const adminRespondedProperties = allProperties.filter(
    (p) =>
      (p.publicationStatus === 'aprobada' || p.publicationStatus === 'rechazada' || p.publicationStatus === 'suspendida') &&
      p.agentAssignmentStatus !== 'pendiente_admin' &&
      p.agentAssignmentStatus !== 'pendiente_agente'
  );

  // Reclamos separados por estados para el Administrador
  const adminPendingClaims = claims.filter(
    (c) => normalizeClaimStatus(c.status) === 'pendiente'
  );
  const adminRevisionClaims = claims.filter(
    (c) => normalizeClaimStatus(c.status) === 'en_revision'
  );
  const adminSolvedClaims = claims.filter(
    (c) => normalizeClaimStatus(c.status) === 'solucionado'
  );

  // Strictly scoped lists per role and subview:
  // 1. Propietario: Properties where current user is the owner (by UID, demo link, or ownerName match)
  const myOwnedProperties = allProperties.filter((p) =>
    isUserOwnerOfProperty(p, currentUser, users)
  );

  // 2. Agente: Properties where current user is the confirmed assigned agent
  const myAssignedProperties = allProperties.filter((p) =>
    isUserAssignedAgentOfProperty(p, currentUser, users)
  );

  // Solicitudes donde un propietario eligió a este agente y están pendientes de aceptación
  const myPendingAgentInvitations = allProperties.filter((p) => {
    const isTargetAgent =
      p.requestedAgentId === currentUser.uid ||
      (currentUser.email?.toLowerCase() === 'agente@clavehogar.com' &&
        p.requestedAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2') ||
      (currentUser.displayName &&
        p.requestedAgentName &&
        p.requestedAgentName.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase());
    return isTargetAgent && p.agentAssignmentStatus === 'pendiente_agente';
  });

  // Visitas, Consultas y Operaciones estrictamente separadas según la pestaña activa
  const clientVisits = allVisits.filter((v) => v.clientId === currentUser.uid);
  const ownerVisits = allVisits.filter((v) => v.ownerId === currentUser.uid);
  const agentVisits = allVisits.filter(
    (v) =>
      v.agentId === currentUser.uid &&
      myAssignedProperties.some((p) => p.id === v.propertyId)
  );

  const clientInquiries = allInquiries.filter((i) => i.clientId === currentUser.uid);
  const ownerInquiries = allInquiries.filter((i) => i.ownerId === currentUser.uid);
  const agentInquiries = allInquiries.filter(
    (i) =>
      i.agentId === currentUser.uid &&
      myAssignedProperties.some((p) => p.id === i.propertyId)
  );

  const clientOperations = allOperations.filter((o) => o.clientId === currentUser.uid);
  const ownerOperations = allOperations.filter((o) => o.ownerId === currentUser.uid);
  const agentOperations = allOperations.filter(
    (o) =>
      o.agentId === currentUser.uid &&
      myAssignedProperties.some((p) => p.id === o.propertyId)
  );

  const canActAsClient =
    currentUser.role !== 'administrador' &&
    (currentUser.role === 'cliente' || currentUser.role === 'propietario');
  const canActAsOwner =
    currentUser.role !== 'administrador' &&
    (currentUser.role === 'propietario' ||
      Boolean(currentUser.isAlsoOwner) ||
      myOwnedProperties.length > 0);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimSubject.trim() || !claimDesc.trim()) return;
    await onCreateClaim(
      claimTargetType,
      'General',
      truncateText(claimSubject, SCHEMA_LIMITS.CLAIM_SUBJECT_MAX),
      truncateText(claimDesc, SCHEMA_LIMITS.CLAIM_DESC_MAX)
    );
    setClaimSubject('');
    setClaimDesc('');
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onAddCategory(truncateText(newCatName, 80), newCatKind);
    setNewCatName('');
  };

  const totalSalesVolume = allOperations
    .filter((o) => o.status === 'concretada')
    .reduce((acc, o) => acc + o.offeredAmount, 0);

  // Role-specific navigation tabs
  const roleNavItems: { id: WorkspaceSubView; label: string; group?: string }[] = [];

  if (canActAsClient) {
    roleNavItems.push(
      { id: 'cliente_favoritos', label: 'Mis Favoritos', group: 'Cliente' },
      { id: 'cliente_visitas', label: 'Mis Visitas', group: 'Cliente' },
      { id: 'cliente_operaciones', label: 'Mis Solicitudes y Contratos', group: 'Cliente' },
      { id: 'cliente_consultas', label: 'Mis Consultas / Chat', group: 'Cliente' }
    );
  }

  if (canActAsOwner) {
    roleNavItems.push(
      { id: 'propietario_inmuebles', label: 'Mis propiedades', group: 'Propietario' },
      { id: 'propietario_visitas', label: 'Visitas Recibidas', group: 'Propietario' },
      { id: 'propietario_operaciones', label: 'Ofertas y Contratos', group: 'Propietario' },
      { id: 'propietario_consultas', label: 'Chat con Interesados', group: 'Propietario' }
    );
  }

  if (currentUser.role === 'agente') {
    roleNavItems.push(
      {
        id: 'agente_cartera',
        label:
          myPendingAgentInvitations.length > 0
            ? `Propiedades Asignadas (${myPendingAgentInvitations.length} solic.)`
            : 'Propiedades Asignadas',
      },
      { id: 'agente_visitas', label: 'Agenda de Visitas' },
      { id: 'agente_consultas', label: 'Chat con Clientes' },
      { id: 'agente_operaciones', label: 'Operaciones y Contratos' }
    );
  }

  if (currentUser.role === 'administrador') {
    const pendingModCount = adminPendingActionProperties.length;
    roleNavItems.push(
      { id: 'admin_dashboard', label: 'Reportes y Métricas' },
      {
        id: 'admin_publicaciones',
        label: `Solicitudes y Moderación (${pendingModCount} pend.)`,
      },
      {
        id: 'admin_operaciones',
        label: `Operaciones y Propuestas (${allOperations.length})`,
      },
      { id: 'admin_usuarios', label: 'Usuarios y Roles' },
      { id: 'admin_categorias', label: 'Categorías y Características' },
      {
        id: 'admin_reclamos',
        label: `Gestión de Reclamos (${adminPendingClaims.length} pend.)`,
      }
    );
  } else {
    roleNavItems.push({ id: 'reclamos_usuario', label: 'Mis Reclamos / Soporte' });
  }

  const renderChatSection = (threads: InquiryItem[], isManagerView: boolean) => {
    const activeInquiry = selectedChatId
      ? threads.find((t) => t.id === selectedChatId) || null
      : null;

    if (activeInquiry) {
      const prop = allProperties.find((p) => p.id === activeInquiry.propertyId);
      const counterpartName = isManagerView
        ? activeInquiry.clientName
        : (prop && isAgentConfirmedOnProperty(prop) ? prop.agentName : '') ||
          activeInquiry.ownerName ||
          prop?.ownerName ||
          'Responsable Inmobiliario';
      const counterpartRoleLabel = isManagerView
        ? 'Cliente interesado'
        : prop && isAgentConfirmedOnProperty(prop)
        ? 'Agente asignado / Propietario'
        : 'Propietario (Gestión directa)';

      const messagesList =
        activeInquiry.messages && activeInquiry.messages.length > 0
          ? activeInquiry.messages
          : [
              {
                id: 'm_1',
                senderId: activeInquiry.clientId,
                senderName: activeInquiry.clientName,
                senderRole: 'cliente' as const,
                text: activeInquiry.question,
                timestamp: activeInquiry.createdAtIso.slice(0, 16).replace('T', ' '),
              },
              ...(activeInquiry.reply
                ? [
                    {
                      id: 'm_2',
                      senderId: activeInquiry.agentId || activeInquiry.ownerId,
                      senderName:
                        activeInquiry.agentName || activeInquiry.ownerName || 'Responsable',
                      senderRole: 'agente' as const,
                      text: activeInquiry.reply,
                      timestamp: (activeInquiry.updatedAtIso || activeInquiry.createdAtIso)
                        .slice(0, 16)
                        .replace('T', ' '),
                    },
                  ]
                : []),
            ];

      return (
        <div
          className={
            isChatFullscreen
              ? 'fixed inset-0 z-50 bg-[#F8F6F1] p-4 sm:p-8 flex flex-col animate-fade-slide'
              : 'card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl overflow-hidden flex flex-col min-h-[580px] shadow-sm'
          }
        >
          <div className="px-6 py-4 bg-[#173B43] text-white flex flex-wrap items-center justify-between gap-4 shrink-0 rounded-t-xl">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedChatId(null);
                  setIsChatFullscreen(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a conversaciones
              </button>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#D6CBB8]">
                  {counterpartRoleLabel} · {activeInquiry.propertyTitle}
                </div>
                <h2 className="text-lg font-serif-display font-semibold text-white">
                  Conversación con {counterpartName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Fullscreen toggle button requested by user */}
              <button
                type="button"
                onClick={() => setIsChatFullscreen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors cursor-pointer"
                title={isChatFullscreen ? 'Volver a vista normal' : 'Hablar en pantalla completa'}
              >
                {isChatFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Volver a vista normal</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Pantalla completa</span>
                  </>
                )}
              </button>

              {prop && (
                <button
                  type="button"
                  onClick={() => onSelectProperty(prop)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#C87955] hover:bg-[#b56b49] text-white rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Ver Ficha de la Propiedad
                </button>
              )}
            </div>
          </div>

          <div
            className={`flex-1 p-6 space-y-4 overflow-y-auto bg-[#F8F6F1]/40 ${
              isChatFullscreen ? 'min-h-0' : 'max-h-[480px]'
            }`}
          >
            {messagesList.map((msg) => {
              const isMine = msg.senderId === currentUser.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-xl p-4 rounded-2xl text-sm space-y-1.5 shadow-2xs ${
                      isMine
                        ? 'bg-[#173B43] text-white'
                        : 'bg-white border-2 border-[#D5BFA0] text-[#303638]'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-6 text-[11px] ${
                        isMine ? 'text-[#D6CBB8]' : 'text-[#303638]/70'
                      }`}
                    >
                      <span className="font-semibold">
                        {msg.senderName} ({msg.senderRole})
                      </span>
                      <span className="font-tabular">{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const txt = (replyDrafts[activeInquiry.id] || '').trim();
              if (!txt) return;
              const targetProp =
                prop ||
                ({
                  id: activeInquiry.propertyId,
                  title: activeInquiry.propertyTitle,
                  ownerId: activeInquiry.ownerId,
                  ownerName: activeInquiry.ownerName || 'Propietario',
                  agentId: activeInquiry.agentId,
                  agentName: activeInquiry.agentName,
                } as PropertyItem);
              await onSendChatMessage(targetProp, txt, activeInquiry.id);
              setReplyDrafts((prev) => ({ ...prev, [activeInquiry.id]: '' }));
            }}
            className="p-4 bg-white border-t border-[#D5BFA0] flex gap-3 shrink-0"
          >
            <input
              type="text"
              value={replyDrafts[activeInquiry.id] || ''}
              onChange={(e) =>
                setReplyDrafts((prev) => ({ ...prev, [activeInquiry.id]: e.target.value }))
              }
              placeholder={`Escribir mensaje a ${counterpartName}...`}
              className="flex-1 px-4 py-2.5 text-sm bg-[#F8F6F1]/60 border border-[#D5BFA0] rounded-xl text-[#303638] focus:outline-none focus:border-[#173B43]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs uppercase tracking-wider font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D5BFA0] pb-4">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
              Bandeja de Mensajes
            </span>
            <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
              {isManagerView
                ? 'Clientes y Consultas Recibidas'
                : 'Mis Conversaciones con Propietarios y Agentes'}
            </h2>
            <p className="text-xs text-[#173B43]/75 mt-0.5">
              Seleccioná una persona o consulta de la lista para abrir la pantalla completa del chat.
            </p>
          </div>
          <span className="text-xs font-tabular text-[#173B43]/70">
            {threads.length} {threads.length === 1 ? 'conversación' : 'conversaciones'}
          </span>
        </div>

        {threads.length === 0 ? (
          <p className="text-sm text-[#173B43]/70 py-10 text-center">
            No tenés conversaciones activas en este momento.
          </p>
        ) : (
          <div className="divide-y divide-[#D5BFA0] border border-[#D5BFA0] rounded-sm bg-white">
            {threads.map((inq) => {
              const prop = allProperties.find((p) => p.id === inq.propertyId);
              const confirmedAgent = prop && isAgentConfirmedOnProperty(prop) ? prop.agentName : '';
              const personName = isManagerView
                ? inq.clientName
                : confirmedAgent ||
                  inq.ownerName ||
                  prop?.ownerName ||
                  'Responsable';
              const personUid = isManagerView
                ? inq.clientId
                : (confirmedAgent ? prop?.agentId : inq.ownerId) || '';
              const personProfile = users.find((u) => u.uid === personUid);
              const personRole = isManagerView
                ? 'Cliente'
                : confirmedAgent
                ? 'Agente Asignado'
                : 'Propietario';
              const messagesCount =
                inq.messages && inq.messages.length > 0
                  ? inq.messages.length
                  : inq.reply
                  ? 2
                  : 1;
              const lastMessage =
                inq.messages && inq.messages.length > 0
                  ? inq.messages[inq.messages.length - 1]
                  : {
                      text: inq.reply || inq.question,
                      timestamp: (inq.updatedAtIso || inq.createdAtIso)
                        .slice(0, 16)
                        .replace('T', ' '),
                    };

              return (
                <button
                  key={inq.id}
                  type="button"
                  onClick={() => setSelectedChatId(inq.id)}
                  className="w-full p-5 text-left hover:bg-[#F8F6F1] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-[#173B43] text-[#FCFBF7] flex items-center justify-center font-serif-display font-semibold text-lg shrink-0">
                      {personProfile?.photoUrl ? (
                        <img
                          src={personProfile.photoUrl}
                          alt={personName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        personName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-[#1F241F] group-hover:text-[#173B43]">
                          {personName}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 bg-[#F8F6F1] border border-[#D5BFA0] text-[#173B43] rounded-sm">
                          {personRole}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm border ${
                            inq.status === 'respondida'
                              ? 'bg-[#D5BFA0]/30 text-[#173B43] border-[#173B43]'
                              : 'bg-amber-100 text-amber-900 border-amber-400'
                          }`}
                        >
                          {inq.status === 'respondida' ? 'Respondida' : 'En revisión / Pendiente'}
                        </span>
                        <span className="text-xs text-[#B86F52] font-medium truncate">
                          · {inq.propertyTitle}
                        </span>
                      </div>
                      <p className="text-xs text-[#173B43]/80 line-clamp-1">
                        Último mensaje: “{lastMessage.text}”
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#D5BFA0]/40">
                    <div className="text-right">
                      <div className="text-[11px] font-tabular text-[#173B43]/70">
                        {lastMessage.timestamp}
                      </div>
                      <div className="text-[11px] font-semibold text-[#173B43]">
                        {messagesCount} {messagesCount === 1 ? 'mensaje' : 'mensajes'}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B86F52] group-hover:translate-x-0.5 transition-transform">
                      Abrir chat
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAdminOperationsView = (isFullPage: boolean = true) => {
    const adminConcretadas = allOperations.filter(
      (o) => normalizeDealCategory(o.status) === 'concretada'
    );
    const adminAceptadas = allOperations.filter(
      (o) => normalizeDealCategory(o.status) === 'aceptada'
    );
    const adminNegociacion = allOperations.filter(
      (o) => normalizeDealCategory(o.status) === 'proceso'
    );
    const adminRechazadas = allOperations.filter(
      (o) => normalizeDealCategory(o.status) === 'rechazada'
    );

    const filteredAdminOperations = allOperations.filter((op) => {
      const cat = normalizeDealCategory(op.status);
      if (adminOpFilter === 'concretadas') return cat === 'concretada';
      if (adminOpFilter === 'aceptadas') return cat === 'aceptada';
      if (adminOpFilter === 'negociacion') return cat === 'proceso';
      if (adminOpFilter === 'rechazadas') return cat === 'rechazada';
      return true;
    });

    return (
      <div
        className={`${
          isFullPage
            ? 'bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-6'
            : 'pt-6 border-t border-[#D5BFA0] space-y-6'
        }`}
      >
        <div className="flex flex-col gap-4 border-b border-[#D5BFA0] pb-4">
          <div className="w-full">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
              Supervisión de Transacciones
            </span>
            <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
              Propiedades por Estado de Operación
            </h2>
            <p className="text-xs text-[#173B43]/75 mt-0.5">
              Hacé clic en cualquiera de los botones para ver las propiedades según estén concretadas, con propuesta aceptada, en negociación o rechazadas.
            </p>
          </div>

          {/* Botones de filtro de propiedades por estado de operación ubicados debajo del texto */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
            <button
              type="button"
              onClick={() => setAdminOpFilter('todos')}
              className={`px-3 py-2.5 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                adminOpFilter === 'todos'
                  ? 'bg-[#173B43] text-[#FCFBF7] border-[#173B43] shadow-xs'
                  : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/40'
              }`}
            >
              <span className="truncate">Todas ({allOperations.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminOpFilter('concretadas')}
              className={`px-3 py-2.5 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                adminOpFilter === 'concretadas'
                  ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                  : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Concretadas ({adminConcretadas.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminOpFilter('aceptadas')}
              className={`px-3 py-2.5 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                adminOpFilter === 'aceptadas'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Propuesta Aceptada ({adminAceptadas.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminOpFilter('negociacion')}
              className={`px-3 py-2.5 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                adminOpFilter === 'negociacion'
                  ? 'bg-sky-700 text-white border-sky-800 shadow-xs'
                  : 'bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">En negociación ({adminNegociacion.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminOpFilter('rechazadas')}
              className={`px-3 py-2.5 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                adminOpFilter === 'rechazadas'
                  ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                  : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Rechazadas ({adminRechazadas.length})</span>
            </button>
          </div>
        </div>

        {filteredAdminOperations.length === 0 ? (
          <div className="p-8 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#173B43]">
              No hay propiedades u operaciones registradas con este estado.
            </p>
            <p className="text-xs text-[#173B43]/70">
              Podés seleccionar otro botón para explorar las demás operaciones de la plataforma.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAdminOperations.map((op) => {
              const prop = allProperties.find((p) => p.id === op.propertyId);
              const relatedContract = contracts.find((c) => c.operationId === op.id);
              const isRental = op.operationType === 'alquiler';
              const normCat = normalizeDealCategory(op.status);

              return (
                <div
                  key={op.id}
                  className="p-5 bg-white border border-[#D5BFA0] rounded-sm space-y-3.5 shadow-xs"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#D5BFA0]/60 pb-3">
                    <div className="flex items-start gap-3.5">
                      {prop && (
                        <img
                          src={resolvePropertyImageUrl(prop.images[0])}
                          alt={prop.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src !== HERO_IMAGE) {
                              e.currentTarget.src = HERO_IMAGE;
                            }
                          }}
                          className="w-20 h-16 rounded-sm object-cover bg-[#D5BFA0] shrink-0"
                        />
                      )}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-[#B86F52] uppercase tracking-wider">
                            Propuesta de {op.operationType}
                          </span>
                          <span
                            className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getDealStatusBadgeClass(
                              op.status
                            )}`}
                          >
                            Estado:{' '}
                            {normCat === 'concretada'
                              ? 'CONCRETADA'
                              : normCat === 'aceptada'
                              ? 'PROPUESTA ACEPTADA (PENDIENTE CONTRATO)'
                              : normCat === 'rechazada'
                              ? 'RECHAZADA'
                              : 'EN NEGOCIACIÓN / SOLICITADA'}
                          </span>
                        </div>
                        <h3 className="text-base font-serif-display font-semibold text-[#1F241F]">
                          {op.propertyTitle}
                        </h3>
                        <div className="text-xs text-[#173B43]/80">
                          {prop ? `${prop.location} · ${prop.propertyType} (${prop.surface} m²)` : 'Inmueble'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      <div className="text-right">
                        <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                          Monto Acordado / Propuesto
                        </span>
                        <span className="text-base font-bold font-tabular text-[#173B43]">
                          {op.counterOffer?.currency || op.currency}{' '}
                          {(op.counterOffer?.amount || op.offeredAmount).toLocaleString()}
                        </span>
                      </div>
                      {prop && (
                        <button
                          type="button"
                          onClick={() => onSelectProperty(prop)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] hover:bg-[#D5BFA0]/40 rounded-sm inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Ficha de la Propiedad
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Intervinientes y Partes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#F8F6F1]/70 p-3 rounded-sm border border-[#D5BFA0]/40">
                    <div>
                      <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                        Cliente Interesado
                      </span>
                      <strong className="text-[#1F241F]">{op.clientName}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                        Propietario Titular
                      </span>
                      <strong className="text-[#1F241F]">
                        {prop?.ownerName || op.ownerName || 'Propietario'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                        Agente Inmobiliario
                      </span>
                      <strong className="text-[#1F241F]">
                        {prop?.agentName || op.agentName || 'Gestión directa (Sin agente)'}
                      </strong>
                    </div>
                  </div>

                  {/* Condiciones y detalles de la propuesta */}
                  <div className="text-xs space-y-1">
                    <span className="font-semibold text-[#1F241F]">
                      Condiciones acordadas / registradas:
                    </span>
                    <p className="bg-[#FCFBF7] p-2.5 rounded-sm border border-[#D5BFA0]/60 text-[#173B43]/90 whitespace-pre-line leading-relaxed">
                      {op.counterOffer?.conditions ||
                        op.conditions ||
                        op.message ||
                        'Sin observaciones adicionales'}
                    </p>
                  </div>

                  {/* Contrato Registrado (Únicamente si la operación está CONCRETADA) */}
                  {normCat === 'concretada' && (op.contractCode || relatedContract) && (
                    <div className="p-3.5 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-xs space-y-1 text-[#173B43]">
                      <div className="font-bold font-tabular flex items-center justify-between">
                        <span>
                          Contrato Registrado: #{op.contractCode || relatedContract?.contractCode}
                        </span>
                        <span className="uppercase text-[10px] bg-[#D5BFA0]/55 text-[#173B43] px-2 py-0.5 rounded-sm font-semibold">
                          Concretada ({isRental ? 'Alquilada' : 'Vendida'})
                        </span>
                      </div>
                      <div className="font-tabular">
                        Monto final: {relatedContract?.finalCurrency || op.currency}{' '}
                        {(relatedContract?.finalPrice || op.offeredAmount).toLocaleString()} ·
                        Fecha de Cierre: {relatedContract?.closingDate || op.createdAtIso.slice(0, 10)}
                      </div>
                      {relatedContract?.signedContractDocRef && (
                        <div className="text-[11px] font-mono text-[#173B43]">
                          Documento: {relatedContract.signedContractDocRef}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Estado Propuesta Aceptada: sólo se acordó la propuesta, sin contrato definitivo aún */}
                  {normCat === 'aceptada' && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-sm text-xs space-y-1.5 text-amber-950">
                      <div className="font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-amber-900">
                          <Check className="w-3.5 h-3.5 text-amber-700" />
                          Propuesta Aceptada por las Partes
                        </span>
                        <span className="uppercase text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-sm font-semibold">
                          Pendiente de Formalizar Contrato
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900/90 leading-relaxed">
                        Las partes llegaron a un acuerdo en el valor y las condiciones. La operación pasará a estado <strong>Concretada</strong> únicamente cuando el responsable registre y formalice el contrato definitivo.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Role Header Banner ("Mi Espacio") matching Image 2 */}
      <div className="bg-[#173B43] rounded-2xl p-6 sm:p-8 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background graphic */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />

        <div className="flex items-start sm:items-center gap-5 relative z-10">
          <button
            type="button"
            onClick={onOpenProfileModal}
            title="Hacé clic para cambiar tu foto o editar tu perfil"
            className="group relative w-18 h-18 rounded-full overflow-hidden bg-[#173B43] text-white border-2 border-white/30 flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
          >
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D6CBB8]">
                Mi Espacio ·{' '}
                {currentUser.role === 'cliente' && canActAsOwner
                  ? 'Propietario y Cliente'
                  : currentUser.role.toUpperCase()}
              </span>
              {onOpenProfileModal && (
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  Editar perfil
                </button>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif-display font-semibold text-white">
              {currentUser.displayName}
            </h1>
            <p className="text-xs sm:text-sm text-[#F4EFE6]/80 max-w-2xl leading-relaxed">
              {currentUser.role === 'cliente' &&
                !canActAsOwner &&
                'Gestioná tus inmuebles favoritos, tus visitas programadas, tus solicitudes de alquiler o compra y tus conversaciones.'}
              {canActAsOwner &&
                'Administrá tanto tus búsquedas y reservas como Cliente, como la publicación y gestión de tus inmuebles desde "Mis propiedades" (de forma independiente o con agente inmobiliario).'}
              {currentUser.role === 'agente' &&
                'Gestioná exclusivamente las propiedades a tu cargo, aceptá o rechazá solicitudes de asignación, coordiná visitas y respondé consultas.'}
              {currentUser.role === 'administrador' &&
                'Supervisión general de ClaveHogar: aprobá publicaciones pendientes, asigná o confirmá agentes inmobiliarios, administrá usuarios y roles, categorías y reclamos.'}
            </p>
          </div>
        </div>

        <div className="relative z-10 shrink-0">
          {currentUser.role === 'cliente' && !canActAsOwner && (
            <div className="bg-white/10 border border-white/20 rounded-xl p-4 max-w-xs space-y-2.5">
              <div className="text-xs font-semibold text-[#D6CBB8]">
                ¿Querés vender o alquilar tu casa?
              </div>
              <p className="text-[11px] text-white/85 leading-relaxed">
                Convertite en <strong>Propietario</strong> desde tu misma cuenta sin perder tus funciones de Cliente.
              </p>
              <button
                type="button"
                onClick={onEnableOwnerRole}
                className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-[#C87955] hover:bg-[#b56b49] rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Convertirme en Propietario
              </button>
            </div>
          )}

          {canActAsOwner && (
            <button
              type="button"
              onClick={onOpenNewProperty}
              className="flex items-center gap-2 px-6 py-3.5 text-xs uppercase tracking-wider font-bold text-white bg-[#C87955] hover:bg-[#b56b49] rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar en Mis propiedades</span>
            </button>
          )}
        </div>
      </div>

      {/* Módulos de Gestión Diferenciados por Rol (Sin scroll horizontal) */}
      <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D5BFA0]/60 pb-3">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#C87955] font-bold block">
              Navegación de Operaciones
            </span>
            <h3 className="text-base font-serif-display font-semibold text-[#303638]">
              Módulos de Gestión
            </h3>
          </div>
          <span className="text-[11px] font-medium text-[#303638]/70 font-tabular bg-[#F8F6F1] px-3 py-1 rounded-full border border-[#D5BFA0] self-start sm:self-auto">
            {roleNavItems.length} secciones disponibles
          </span>
        </div>

        {/* Si el usuario es Administrador: Panel de Administración arriba justo debajo del título */}
        {currentUser.role === 'administrador' && (
          <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173B43]">
                <ShieldCheck className="w-4 h-4 text-[#173B43]" />
                <span>Supervisión y Administración General</span>
              </div>
              <span className="text-[10px] font-semibold text-[#173B43]/70 uppercase">
                Panel de Control ClaveHogar
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: 'admin_dashboard', label: 'Reportes y Métricas' },
                {
                  id: 'admin_publicaciones',
                  label: 'Solicitudes y Moderación',
                  count: adminPendingActionProperties.length,
                  badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
                },
                {
                  id: 'admin_operaciones',
                  label: 'Operaciones y Propuestas',
                  count: allOperations.length,
                },
                {
                  id: 'admin_usuarios',
                  label: 'Usuarios y Roles',
                  // count: uniqueUsers.length,
                },
                { id: 'admin_categorias', label: 'Categorías y Características' },
                {
                  id: 'admin_reclamos',
                  label: 'Gestión de Reclamos',
                  count: adminPendingClaims.length,
                  badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
                },
              ].map((item) => {
                const active = activeSubView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatId(null);
                      onChangeSubView(item.id as WorkspaceSubView);
                    }}
                    className={`px-4 py-2.5 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'bg-[#173B43] text-white font-semibold shadow-xs border border-[#173B43]'
                        : 'bg-white hover:bg-[#F8F6F1] text-[#303638] border-2 border-[#D5BFA0] font-medium shadow-2xs'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] font-tabular px-1.5 py-0.2 rounded-full border ${
                          active
                            ? 'bg-white/20 text-white border-white/30'
                            : item.badgeColor || 'bg-[#F8F6F1] text-[#173B43] font-bold border-[#D5BFA0]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Si el usuario es Agente: Gestión Inmobiliaria arriba justo debajo del título */}
        {currentUser.role === 'agente' && (
          <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173B43]">
                <Briefcase className="w-4 h-4 text-[#173B43]" />
                <span>Gestión Inmobiliaria</span>
              </div>
              <span className="text-[10px] font-semibold text-[#173B43]/70 uppercase">
                Cartera y Clientes a Mi Cargo
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                {
                  id: 'agente_cartera',
                  label: 'Cartera Asignada',
                  count: myPendingAgentInvitations.length > 0 ? myPendingAgentInvitations.length : myAssignedProperties.length,
                  badgeLabel: myPendingAgentInvitations.length > 0 ? `${myPendingAgentInvitations.length} solic.` : `${myAssignedProperties.length}`,
                  badgeColor: myPendingAgentInvitations.length > 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0]',
                },
                { id: 'agente_visitas', label: 'Agenda de Visitas', count: agentVisits.length },
                { id: 'agente_consultas', label: 'Chat con Clientes', count: agentInquiries.length },
                { id: 'agente_operaciones', label: 'Operaciones y Contratos', count: agentOperations.length },
              ].map((item) => {
                const active = activeSubView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatId(null);
                      onChangeSubView(item.id as WorkspaceSubView);
                    }}
                    className={`px-4 py-2.5 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'bg-[#173B43] text-white font-semibold shadow-xs border border-[#173B43]'
                        : 'bg-white hover:bg-[#F8F6F1] text-[#303638] border-2 border-[#D5BFA0] font-medium shadow-2xs'
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`text-[10px] font-tabular px-1.5 py-0.2 rounded-full border ${
                          active
                            ? 'bg-white/20 text-white border-white/30'
                            : item.badgeColor || 'bg-[#F8F6F1] text-[#173B43] font-bold border-[#D5BFA0]'
                        }`}
                      >
                        {item.badgeLabel || item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Funciones de Cliente y Propietario */}
        {(canActAsClient || canActAsOwner) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funciones de Cliente */}
            {canActAsClient && (
              <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#173B43]">
                    <User className="w-3.5 h-3.5 text-[#173B43]" />
                    <span>Funciones de Cliente</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#173B43]/70 uppercase">
                    Búsquedas y Solicitudes
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'cliente_favoritos', label: 'Mis Favoritos', count: favoriteProperties.length },
                    { id: 'cliente_visitas', label: 'Mis Visitas', count: clientVisits.length },
                    { id: 'cliente_operaciones', label: 'Mis Solicitudes y Contratos', count: clientOperations.length },
                    { id: 'cliente_consultas', label: 'Mis Consultas / Chat', count: clientInquiries.length },
                  ].map((item) => {
                    const active = activeSubView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedChatId(null);
                          onChangeSubView(item.id as WorkspaceSubView);
                        }}
                        className={`px-3.5 py-2 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'bg-[#173B43] text-white font-semibold shadow-xs border border-[#173B43]'
                            : 'bg-white hover:bg-[#F8F6F1] text-[#303638] border-2 border-[#D5BFA0] font-medium shadow-2xs'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.count > 0 && (
                          <span
                            className={`text-[10px] font-tabular px-1.5 py-0.2 rounded-full ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F8F6F1] text-[#173B43] font-bold border border-[#D5BFA0]'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Funciones de Propietario */}
            {canActAsOwner && (
              <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C87955]">
                    <Building2 className="w-3.5 h-3.5 text-[#C87955]" />
                    <span>Funciones de Propietario</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#C87955]/80 uppercase">
                    Inmuebles y Ofertas
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'propietario_inmuebles', label: 'Mis propiedades', count: myOwnedProperties.length },
                    { id: 'propietario_visitas', label: 'Visitas Recibidas', count: ownerVisits.length },
                    { id: 'propietario_operaciones', label: 'Ofertas y Contratos', count: ownerOperations.length },
                    { id: 'propietario_consultas', label: 'Chat con Interesados', count: ownerInquiries.length },
                  ].map((item) => {
                    const active = activeSubView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedChatId(null);
                          onChangeSubView(item.id as WorkspaceSubView);
                        }}
                        className={`px-3.5 py-2 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'bg-[#173B43] text-white font-semibold shadow-xs border border-[#173B43]'
                            : 'bg-white hover:bg-[#F8F6F1] text-[#303638] border-2 border-[#D5BFA0] font-medium shadow-2xs'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.count > 0 && (
                          <span
                            className={`text-[10px] font-tabular px-1.5 py-0.2 rounded-full ${
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F8F6F1] text-[#C87955] font-bold border border-[#D5BFA0]'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Soporte para usuarios no admin */}
        {currentUser.role !== 'administrador' && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#D5BFA0]/60 text-xs">
            <span className="text-[11px] uppercase tracking-wider text-[#303638]/70 font-semibold">
              Atención y Soporte:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedChatId(null);
                onChangeSubView('reclamos_usuario');
              }}
              className={`px-3.5 py-1.5 text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'reclamos_usuario'
                  ? 'bg-[#173B43] text-white font-semibold shadow-xs'
                  : 'bg-white text-[#303638] border-2 border-[#D5BFA0] font-medium shadow-2xs hover:bg-[#F8F6F1]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#C87955]" />
              <span>Mis Reclamos / Soporte</span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          CLIENTE SCREENS
         ===================================================================== */}
      {activeSubView === 'cliente_favoritos' && canActAsClient && (
        <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#D5BFA0]/60 pb-4">
            <h2 className="text-2xl font-serif-display font-semibold text-[#303638]">
              Mis Propiedades Favoritas
            </h2>
            <span className="text-xs text-[#303638]/70 font-tabular bg-[#F8F6F1] px-3 py-1 rounded-full border border-[#D5BFA0]">
              {favoriteProperties.length} guardadas
            </span>
          </div>
          {favoriteProperties.length === 0 ? (
            <p className="text-sm text-[#303638]/70 py-8 text-center">
              Aún no tenés propiedades guardadas en Favoritos.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {favoriteProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="card-floating border-2 border-[#D5BFA0] rounded-2xl overflow-hidden bg-white shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] bg-[#F8F6F1]">
                      <img
                        src={resolvePropertyImageUrl(prop.images[0])}
                        alt={prop.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== HERO_IMAGE) {
                            e.currentTarget.src = HERO_IMAGE;
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-[#B86F52] font-semibold">
                        {prop.propertyType} · {prop.location}
                      </div>
                      <div className="text-base font-serif-display font-semibold text-[#1F241F] line-clamp-1">
                        {prop.title}
                      </div>
                      <div className="text-base font-tabular font-semibold text-[#173B43]">
                        {prop.currency} {prop.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectProperty(prop)}
                      className="flex-1 py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] rounded-sm hover:bg-[#2c382d]"
                    >
                      Ver Ficha
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(prop.id)}
                      className="py-2 px-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubView === 'cliente_visitas' && canActAsClient && (
        <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#D5BFA0]/60 pb-4">
            <h2 className="text-2xl font-serif-display font-semibold text-[#303638]">
              Mis Solicitudes de Visita
            </h2>
            <span className="text-xs text-[#303638]/70 font-tabular bg-[#F8F6F1] px-3 py-1 rounded-full border border-[#D5BFA0]">
              {clientVisits.length} registradas
            </span>
          </div>
          {clientVisits.length === 0 ? (
            <p className="text-sm text-[#303638]/70 py-8 text-center">
              No tenés visitas solicitadas por el momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D5BFA0] text-xs uppercase tracking-wider text-[#173B43]/70">
                    <th className="py-3 pr-4">Propiedad</th>
                    <th className="py-3 px-4">Fecha y Horario</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Notas</th>
                    <th className="py-3 pl-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5BFA0]/60">
                  {clientVisits.map((v) => (
                    <tr key={v.id}>
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-[#1F241F]">{v.propertyTitle}</div>
                        {v.status === 'reprogramada' && (
                          <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-sm inline-block mt-1 border border-amber-300">
                            Propietario reprogramó fecha/horario. Por favor aceptá o rechazá.
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-tabular text-xs text-[#173B43]">
                        {v.date} · {v.timeSlot}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-sm border ${getVisitStatusBadgeClass(
                            v.status
                          )}`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#173B43]/75">{v.notes || '—'}</td>
                      <td className="py-3.5 pl-4 text-right">
                        {v.status === 'reprogramada' ? (
                          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateVisit(
                                  v.id,
                                  'confirmada',
                                  v.date,
                                  v.timeSlot,
                                  'Reprogramación aceptada por el cliente'
                                )
                              }
                              className="px-3 py-1.5 text-xs font-bold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Aceptar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateVisit(
                                  v.id,
                                  'rechazada',
                                  v.date,
                                  v.timeSlot,
                                  'Reprogramación rechazada por el cliente'
                                )
                              }
                              className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-sm cursor-pointer flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5 shrink-0" />
                              <span>Rechazar</span>
                            </button>
                          </div>
                        ) : v.status === 'cancelada' ? (
                          <span className="text-xs text-rose-700 font-semibold italic">Visita cancelada</span>
                        ) : v.status !== 'realizada' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setVisitToCancel(v);
                              setCancelReason('');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 cursor-pointer"
                          >
                            Cancelar Visita
                          </button>
                        ) : (
                          <span className="text-xs text-[#173B43]/60">Sin acciones</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de Confirmación de Cancelación de Visita por el Cliente */}
          {visitToCancel && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 max-w-md w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-[#D5BFA0] pb-3">
                  <h3 className="text-lg font-serif-display font-bold text-[#1F241F] flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    ¿Confirmar cancelación de visita?
                  </h3>
                  <button
                    type="button"
                    onClick={() => setVisitToCancel(null)}
                    className="text-[#173B43]/70 hover:text-[#1F241F] p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3.5 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-xs space-y-1">
                  <p className="font-semibold text-[#1F241F]">{visitToCancel.propertyTitle}</p>
                  <p className="text-[#173B43]">
                    Fecha y horario: <strong>{visitToCancel.date} · {visitToCancel.timeSlot}</strong>
                  </p>
                </div>

                <p className="text-xs text-[#173B43]/85 leading-relaxed">
                  ¿Estás seguro de que deseas cancelar esta solicitud de visita? Esta acción notificará al propietario o agente responsable y el estado pasará a cancelado definitivamente.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Motivo de la cancelación (opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ej: Inconveniente de agenda / Ya conseguí otra propiedad"
                    className="w-full text-xs p-2.5 bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D5BFA0]/60">
                  <button
                    type="button"
                    onClick={() => setVisitToCancel(null)}
                    className="px-4 py-2 text-xs font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm hover:bg-[#D5BFA0]/40 cursor-pointer"
                  >
                    Volver / Mantener Visita
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateVisit(
                        visitToCancel.id,
                        'cancelada',
                        visitToCancel.date,
                        visitToCancel.timeSlot,
                        cancelReason ? `Cancelada por el cliente: ${cancelReason}` : 'Cancelada por el cliente'
                      );
                      setVisitToCancel(null);
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-sm cursor-pointer shadow-xs"
                  >
                    Sí, Cancelar Visita
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubView === 'cliente_operaciones' && canActAsClient && (
        <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#D5BFA0]/60 pb-4">
            <h2 className="text-2xl font-serif-display font-semibold text-[#303638]">
              Mis Propuestas de Alquiler / Compra y Contratos
            </h2>
            <span className="text-xs text-[#303638]/70 font-tabular bg-[#F8F6F1] px-3 py-1 rounded-full border border-[#D5BFA0]">
              {clientOperations.length} propuestas
            </span>
          </div>
          {clientOperations.length === 0 ? (
            <p className="text-sm text-[#303638]/70 py-8 text-center">
              No hay propuestas de operación registradas.
            </p>
          ) : (
            <div className="space-y-4">
              {clientOperations.map((op) => {
                const isRental = op.operationType === 'alquiler';
                const relatedContract = contracts.find((c) => c.operationId === op.id);

                return (
                  <div
                    key={op.id}
                    className="card-floating p-5 sm:p-6 bg-[#F8F6F1]/60 border-2 border-[#D5BFA0] rounded-2xl space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5BFA0]/80 pb-3">
                      <div>
                        <span className="text-[11px] font-semibold text-[#C87955] uppercase tracking-wider">
                          Propuesta de {op.operationType}
                        </span>
                        <h3 className="text-lg font-serif-display font-semibold text-[#303638]">
                          {op.propertyTitle}
                        </h3>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-base font-semibold font-tabular text-[#173B43] block">
                          {op.counterOffer?.currency || op.currency} {(op.counterOffer?.amount || op.offeredAmount).toLocaleString()}
                        </span>
                        <span
                          className={`inline-block text-[11px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getDealStatusBadgeClass(
                            op.status
                          )}`}
                        >
                          Estado:{' '}
                          {normalizeDealCategory(op.status) === 'concretada'
                            ? 'CONCRETADA'
                            : normalizeDealCategory(op.status) === 'aceptada'
                            ? 'PROPUESTA ACEPTADA (PENDIENTE CONTRATO)'
                            : normalizeDealCategory(op.status) === 'rechazada'
                            ? 'RECHAZADA'
                            : 'EN NEGOCIACIÓN'}
                        </span>
                      </div>
                    </div>

                    {/* Detailed Read-Only Data Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-sm border border-[#D5BFA0]/60">
                      <div>
                        <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                          Monto Propuesto
                        </span>
                        <span className="font-semibold text-[#1F241F] font-tabular">
                          {op.counterOffer?.currency || op.currency} {(op.counterOffer?.amount || op.offeredAmount).toLocaleString()}
                        </span>
                      </div>
                      {isRental ? (
                        <>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Garantía Presentada
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.guaranteeType || 'No especificada'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Condiciones (Cliente)
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.conditions || 'Sin condiciones'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Forma de Pago
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.paymentMethod || 'Contado / Transferencia'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Condiciones
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.conditions || op.message || 'Sin observaciones'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Message / Observations */}
                    {op.message && (
                      <p className="text-xs text-[#173B43]/85 italic">
                        &ldquo;{op.message}&rdquo;
                      </p>
                    )}

                    {/* Counter Offer response for Client */}
                    {op.status === 'en_negociacion' && op.counterOffer && (
                      <div className="p-4 bg-amber-50 border border-amber-300 rounded-sm space-y-2 text-xs">
                        <div className="font-bold text-amber-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
                          <span>Contrapropuesta Recibida del Propietario / Agente:</span>
                          <span className="font-tabular">
                            {op.counterOffer.currency} {op.counterOffer.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-amber-950/90 font-medium">
                          {op.counterOffer.conditions}
                        </p>
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateOperation(op.id, 'aceptada')}
                            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm cursor-pointer"
                          >
                            Aceptar Contrapropuesta
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateOperation(op.id, 'rechazada')}
                            className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 rounded-sm cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Proposal Accepted Banner (Aún NO concretada / pendiente de contrato formal) */}
                    {normalizeDealCategory(op.status) === 'aceptada' && (
                      <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-sm text-xs space-y-1.5 text-amber-950">
                        <div className="flex items-center justify-between">
                          <span className="font-bold block text-amber-900 text-sm">¡Propuesta Aceptada!</span>
                          <span className="uppercase text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-sm font-semibold">
                            Pendiente de Formalización
                          </span>
                        </div>
                        <p className="text-amber-900/90 leading-relaxed">
                          Tu propuesta fue aceptada por el propietario o agente. Las condiciones preliminares están acordadas. El responsable procederá a redactar y registrar el contrato formal definitivo para concretar la operación.
                        </p>
                      </div>
                    )}

                    {/* Contract Details - Únicamente visible cuando la operación está CONCRETADA */}
                    {normalizeDealCategory(op.status) === 'concretada' && (op.contractCode || relatedContract) && (
                      <div className="p-4 bg-[#F8F6F1] border-2 border-[#173B43] rounded-sm text-xs space-y-1.5">
                        <div className="font-bold text-[#173B43] font-tabular text-sm flex items-center justify-between">
                          <span>Contrato Registrado: #{op.contractCode || relatedContract?.contractCode}</span>
                          <span className="uppercase text-[10px] bg-[#D5BFA0]/55 text-[#173B43] px-2 py-0.5 rounded-sm">
                            Concretada
                          </span>
                        </div>
                        <div className="text-[#173B43] font-medium font-tabular">
                          Monto final: {relatedContract?.finalCurrency || op.currency} {(relatedContract?.finalPrice || op.offeredAmount).toLocaleString()} · Fecha de Cierre: {relatedContract?.closingDate || op.createdAtIso.slice(0, 10)}
                        </div>
                        <p className="text-[#173B43]/80">
                          {relatedContract?.contractTerms || op.contractTerms || 'Contrato archivado correctamente.'}
                        </p>
                        {relatedContract?.signedContractDocRef && (
                          <div className="text-[11px] font-mono text-[#173B43] pt-1">
                            Documento: {relatedContract.signedContractDocRef}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubView === 'cliente_consultas' &&
        canActAsClient &&
        renderChatSection(clientInquiries, false)}

      {/* =====================================================================
          SECCIÓN "MIS PROPIEDADES" DEL PROPIETARIO
         ===================================================================== */}
      {activeSubView === 'propietario_inmuebles' && canActAsOwner && (
        <div className="card-floating bg-white border border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D5BFA0]/60 pb-5">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C87955]" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#C87955] font-semibold block">
                  Panel de Propietario
                </span>
              </div>
              <h2 className="text-3xl font-serif-display font-semibold text-[#303638]">
                Mis propiedades
              </h2>
              <p className="text-xs text-[#303638]/75 mt-1 max-w-2xl leading-relaxed">
                Publicá y administrá tus propiedades por tu cuenta o solicitá la asistencia de un agente inmobiliario. Las nuevas publicaciones quedan pendientes de revisión del administrador antes de aparecer públicamente.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewProperty}
              className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wider font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-xl transition-all shadow-xs whitespace-nowrap self-start cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publicar Propiedad</span>
            </button>
          </div>

          {/* 4 Métricas 100% Dinámicas calculadas a partir de datos reales (Cero hardcodeo) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-1 shadow-2xs">
              <span className="text-[11px] text-[#303638]/75 font-semibold block">
                Inmuebles Activos
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-tabular text-[#303638]">
                  {myOwnedProperties.filter((p) => p.publicationStatus === 'aprobada').length}
                </span>
                <span className="text-xs text-[#303638]/70 font-medium">
                  de {myOwnedProperties.length} en total
                </span>
              </div>
            </div>

            <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-1 shadow-2xs">
              <span className="text-[11px] text-[#303638]/75 font-semibold block">
                Visitas Recibidas
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-tabular text-[#303638]">
                  {ownerVisits.length}
                </span>
                {ownerVisits.length > 0 ? (
                  <span className="text-[10px] font-bold text-[#173B43] bg-[#D5BFA0]/30 border border-[#D5BFA0] px-2 py-0.5 rounded-full">
                    {ownerVisits.filter((v) => v.status === 'confirmada').length} confirmadas
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#303638]/60 bg-white/70 px-2 py-0.5 rounded-full border border-[#D5BFA0]">
                    Al día
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-1 shadow-2xs">
              <span className="text-[11px] text-[#303638]/75 font-semibold block">
                Consultas de Clientes
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-tabular text-[#303638]">
                  {ownerInquiries.length}
                </span>
                {ownerInquiries.filter((i) => !i.reply && !i.messages?.some((m) => m.senderId === currentUser.uid)).length > 0 ? (
                  <span className="text-[10px] font-bold text-[#C87955] bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full">
                    {ownerInquiries.filter((i) => !i.reply && !i.messages?.some((m) => m.senderId === currentUser.uid)).length} por responder
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#173B43] bg-[#D5BFA0]/30 border border-[#D5BFA0] px-2 py-0.5 rounded-full">
                    Respondidas
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#F8F6F1]/70 border-2 border-[#D5BFA0] rounded-xl p-4 space-y-1 shadow-2xs">
              <span className="text-[11px] text-[#303638]/75 font-semibold block">
                Operaciones y Ofertas
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-tabular text-[#303638]">
                  {ownerOperations.length}
                </span>
                <span className="text-[10px] font-bold text-[#173B43] bg-[#D5BFA0]/30 border border-[#D5BFA0] px-2 py-0.5 rounded-full">
                  {ownerOperations.filter((o) => o.status === 'concretada').length} concretadas
                </span>
              </div>
            </div>
          </div>

          {myOwnedProperties.length === 0 ? (
            <div className="p-10 bg-[#F8F6F1]/50 border-2 border-[#D5BFA0] rounded-2xl text-center space-y-3">
              <p className="text-base font-serif-display font-semibold text-[#303638]">
                Aún no tenés inmuebles publicados en &ldquo;Mis propiedades&rdquo;.
              </p>
              <p className="text-xs text-[#303638]/80 max-w-md mx-auto">
                Podés publicar una o varias propiedades en venta o alquiler y elegir si deseás administrarlas por tu cuenta o con un agente inmobiliario.
              </p>
              <button
                type="button"
                onClick={onOpenNewProperty}
                className="px-5 py-2.5 text-xs uppercase tracking-wider font-semibold text-white bg-[#C87955] hover:bg-[#b56b49] rounded-xl transition-all cursor-pointer shadow-xs"
              >
                + Publicar mi primera propiedad
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myOwnedProperties.map((prop) => {
                const status =
                  prop.agentAssignmentStatus ||
                  (prop.agentId?.trim() ? 'asignado' : 'sin_agente');
                const assignedAgentProfile = prop.agentId
                  ? users.find((u) => u.uid === prop.agentId)
                  : undefined;
                const requestedAgentProfile = prop.requestedAgentId
                  ? users.find((u) => u.uid === prop.requestedAgentId)
                  : undefined;
                const isChoosingAgentHere = agentSelectorPropId === prop.id;

                const propVisits = allVisits.filter((v) => v.propertyId === prop.id);
                const propScheduledVisits = propVisits.filter(
                  (v) => v.status === 'confirmada' || v.status === 'pendiente'
                ).length;
                const propInquiries = allInquiries.filter((i) => i.propertyId === prop.id).length;
                const isSavedInFavorites = favoriteIds.includes(prop.id);

                return (
                  <div
                    key={prop.id}
                    className="card-floating p-5 sm:p-6 bg-white border-2 border-[#D5BFA0] rounded-2xl space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Datos de la propiedad */}
                      <div className="flex items-start gap-4">
                        <div className="relative w-32 h-24 rounded-xl overflow-hidden bg-[#F8F6F1] border-2 border-[#D5BFA0] shrink-0">
                          <img
                            src={resolvePropertyImageUrl(prop.images[0])}
                            alt={prop.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (e.currentTarget.src !== HERO_IMAGE) {
                                e.currentTarget.src = HERO_IMAGE;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1.5">
                            <Camera className="w-3 h-3 text-white" />
                            <span>{prop.images.length || 1} fotos</span>
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${getPublicationStatusBadgeClass(
                                prop.publicationStatus
                              )}`}
                            >
                              {prop.publicationStatus === 'aprobada' && (
                                <CheckCircle2 className="w-3 h-3 text-[#173B43]" />
                              )}
                              {prop.publicationStatus === 'pendiente' && (
                                <Clock className="w-3 h-3 text-amber-700" />
                              )}
                              {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && (
                                <XCircle className="w-3 h-3 text-red-700" />
                              )}
                              {prop.publicationStatus === 'aprobada'
                                ? 'Publicada (Aprobada)'
                                : prop.publicationStatus === 'pendiente'
                                ? 'En revisión (Pendiente de aprobación)'
                                : 'Rechazada por administración'}
                            </span>
                            <span className="text-xs font-tabular font-semibold text-[#303638] bg-[#F8F6F1] border border-[#D5BFA0] px-2.5 py-0.5 rounded-full">
                              {prop.operationType.toUpperCase()} · {prop.currency}{' '}
                              {prop.price.toLocaleString()}
                            </span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-serif-display font-semibold text-[#303638]">
                            {prop.title}
                          </h3>
                          <div className="text-xs text-[#303638]/75 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#C87955]" />
                              <span>{prop.location}</span>
                            </span>
                            <span>·</span>
                            <span>{prop.address}</span>
                            <span>·</span>
                            <span className="font-tabular font-medium">{prop.surface} m²</span>
                          </div>



                          {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && prop.rejectionReason && (
                            <div className="p-2.5 bg-red-50 border-l-4 border-red-600 text-xs text-red-900 font-medium rounded-r-xl">
                              <strong>Motivo de rechazo:</strong> {prop.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Disponibilidad y Acciones del Propietario matching Image 2 */}
                      <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[#303638]/60 mb-1 font-semibold">
                            Disponibilidad
                          </label>
                          <select
                            value={prop.availability}
                            onChange={(e) =>
                              onUpdateAvailability(prop.id, e.target.value as AvailabilityStatus)
                            }
                            className="px-3 py-2 text-xs font-medium bg-[#F8F6F1]/60 border border-[#D5BFA0] rounded-xl text-[#303638] focus:outline-none focus:border-[#173B43] cursor-pointer"
                          >
                            <option value="disponible">Disponible</option>
                            <option value="reservada">Reservada</option>
                            <option value="alquilada">Alquilada</option>
                            <option value="vendida">Vendida</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-4">
                          <button
                            type="button"
                            onClick={() => onSelectProperty(prop)}
                            className="px-3.5 py-2 text-xs font-semibold text-[#303638] bg-[#F8F6F1] border border-[#D5BFA0] rounded-xl hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            title="Ver ficha"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditProperty(prop)}
                            className="px-3.5 py-2 text-xs font-semibold text-[#303638] bg-[#F8F6F1] border border-[#D5BFA0] rounded-xl hover:bg-white inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            title="Editar propiedad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProperty(prop.id)}
                            className="p-2 text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors cursor-pointer shadow-2xs"
                            title="Eliminar propiedad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Panel de Modalidad de Gestión y Estado de Solicitud de Agente */}
                    <div
                      className={`p-4 rounded-sm space-y-3 border ${
                        status === 'rechazado'
                          ? 'bg-red-50 border-red-300'
                          : status === 'pendiente_agente' || status === 'pendiente_admin'
                          ? 'bg-amber-50 border-amber-300'
                          : status === 'asignado'
                          ? 'bg-[#F8F6F1] border-[#D5BFA0]'
                          : 'bg-[#F8F6F1] border-[#D5BFA0]'
                      }`}
                    >
                      {status === 'sin_agente' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-[#173B43] flex items-center gap-1.5">
                              <span>
                                Modalidad actual: Propietario Independiente (Gestión por mi cuenta)
                              </span>
                            </div>
                            <p className="text-[11px] text-[#173B43]/80">
                              Recibís y respondés directamente las consultas, visitas y ofertas de esta propiedad.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAgentSelectorPropId(isChoosingAgentHere ? null : prop.id)
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors inline-flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Elegir un agente
                            </button>
                            <button
                              type="button"
                              onClick={() => onOwnerRequestAgent(prop.id, 'asignacion_admin')}
                              className="px-3 py-1.5 text-xs font-semibold text-[#173B43] bg-white border border-[#D5BFA0] hover:bg-[#FCFBF7] rounded-sm transition-colors inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-[#B86F52]" />
                              Que me asignen uno
                            </button>
                          </div>
                        </div>
                      )}

                      {(status === 'pendiente_agente' || status === 'pendiente_admin') && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-200/70 px-2.5 py-1 rounded-sm border border-amber-400">
                              <Clock className="w-3.5 h-3.5 text-amber-800" />
                              {status === 'pendiente_agente'
                                ? `En revisión: Esperando confirmación del agente (${
                                    prop.requestedAgentName ||
                                    requestedAgentProfile?.displayName ||
                                    'Agente seleccionado'
                                  })`
                                : 'En revisión: Esperando que el Administrador te asigne un agente'}
                            </div>
                            <p className="text-[11px] text-amber-950/90">
                              {status === 'pendiente_agente'
                                ? 'El agente elegido debe aceptar tu solicitud (o el administrador confirmarla) antes de quedar asignado. Mientras tanto, vos mantenés el control de la propiedad.'
                                : 'El administrador recibió tu pedido y te asignará un agente disponible a la brevedad.'}
                            </p>
                            {requestedAgentProfile && status === 'pendiente_agente' && (
                              <div className="text-[11px] text-amber-950 font-tabular">
                                Datos del agente solicitado:{' '}
                                <strong>{requestedAgentProfile.displayName}</strong> ·{' '}
                                {requestedAgentProfile.agencyName || 'Agente Inmobiliario'} ·{' '}
                                {requestedAgentProfile.email} · {requestedAgentProfile.phone}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setAgentSelectorPropId(isChoosingAgentHere ? null : prop.id)
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-400 rounded-sm hover:bg-amber-100"
                            >
                              Cambiar agente
                            </button>
                            <button
                              type="button"
                              onClick={() => onOwnerRequestAgent(prop.id, 'directa')}
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50"
                            >
                              Administrar por mi cuenta
                            </button>
                          </div>
                        </div>
                      )}

                      {status === 'rechazado' && (
                        <div className="space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 bg-red-100 px-2.5 py-1 rounded-sm border border-red-400">
                                <AlertCircle className="w-4 h-4 text-red-700" />
                                Solicitud Rechazada: El agente solicitado ({prop.requestedAgentName || 'Agente'}) no está disponible
                              </div>
                              {prop.agentRejectionReason && (
                                <p className="text-xs text-red-900 font-medium">
                                  Motivo informado: “{prop.agentRejectionReason}”
                                </p>
                              )}
                              <p className="text-[11px] text-red-950/80">
                                Podés elegir otro agente disponible de la lista, pedir que el administrador te asigne uno, o administrar la propiedad por tu cuenta.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setAgentSelectorPropId(isChoosingAgentHere ? null : prop.id)
                                }
                                className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] rounded-sm hover:bg-[#2c382d]"
                              >
                                Elegir otro agente
                              </button>
                              <button
                                type="button"
                                onClick={() => onOwnerRequestAgent(prop.id, 'asignacion_admin')}
                                className="px-3 py-1.5 text-xs font-semibold text-[#173B43] bg-white border border-[#D5BFA0] rounded-sm hover:bg-[#FCFBF7]"
                              >
                                Que el administrador me asigne uno
                              </button>
                              <button
                                type="button"
                                onClick={() => onOwnerRequestAgent(prop.id, 'directa')}
                                className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-100"
                              >
                                Administrar por mi cuenta
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {status === 'asignado' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#173B43] text-[#FCFBF7] flex items-center justify-center shrink-0">
                              {assignedAgentProfile?.photoUrl ? (
                                <img
                                  src={assignedAgentProfile.photoUrl}
                                  alt={prop.agentName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold text-[#173B43] flex flex-wrap items-center gap-2">
                                <span>Agente Inmobiliario Asignado: {prop.agentName}</span>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#D5BFA0]/30 text-[#173B43] border border-[#173B43] rounded-sm">
                                  Asignación Confirmada
                                </span>
                              </div>
                              <div className="text-xs text-[#173B43]">
                                {assignedAgentProfile?.agencyName || 'Corredor Inmobiliario Matriculado'}
                              </div>
                              <div className="text-[11px] font-tabular text-[#173B43]/80">
                                Correo: {assignedAgentProfile?.email || 'agente@clavehogar.com'} · Teléfono:{' '}
                                {assignedAgentProfile?.phone || '+54 9 11 6092-1120'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setAgentSelectorPropId(isChoosingAgentHere ? null : prop.id)
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-[#173B43] bg-white border border-[#D5BFA0] rounded-sm hover:bg-[#FCFBF7]"
                            >
                              Cambiar agente
                            </button>
                            <button
                              type="button"
                              onClick={() => onOwnerRequestAgent(prop.id, 'directa')}
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50"
                            >
                              Pasar a gestión por mi cuenta
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Desplegable de perfiles de agentes disponibles para elegir */}
                      {isChoosingAgentHere && (
                        <div className="pt-3 border-t border-[#D5BFA0] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#173B43]">
                              Seleccioná un perfil de Agente Inmobiliario disponible (la solicitud quedará pendiente de confirmación):
                            </span>
                            <button
                              type="button"
                              onClick={() => setAgentSelectorPropId(null)}
                              className="text-xs text-red-600 font-semibold hover:underline"
                            >
                              Cerrar perfiles
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {agentsList.map((ag) => (
                              <div
                                key={ag.uid}
                                className="p-3.5 bg-white border border-[#D5BFA0] rounded-sm flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#173B43] text-[#FCFBF7] flex items-center justify-center shrink-0">
                                    {ag.photoUrl ? (
                                      <img
                                        src={ag.photoUrl}
                                        alt={ag.displayName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <User className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="text-xs font-semibold text-[#1F241F]">
                                      {ag.displayName}
                                    </div>
                                    <div className="text-[11px] text-[#B86F52] font-medium">
                                      {ag.agencyName || 'Agente Inmobiliario'}
                                    </div>
                                    <div className="text-[11px] font-tabular text-[#173B43]/80">
                                      {ag.email} · {ag.phone}
                                    </div>
                                    {ag.bio && (
                                      <p className="text-[11px] text-[#173B43]/75 line-clamp-2">
                                        {ag.bio}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onOwnerRequestAgent(prop.id, 'elegir_agente', ag);
                                    setAgentSelectorPropId(null);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm shrink-0"
                                >
                                  Solicitar este agente
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}


        </div>
      )}

      {/* =====================================================================
          SECCIÓN CARTERA DEL AGENTE INMOBILIARIO (SOLO PROPIEDADES A SU CARGO)
         ===================================================================== */}
      {activeSubView === 'agente_cartera' && currentUser.role === 'agente' && (
        <div className="space-y-6">
          {/* Solicitudes pendientes enviadas a este agente */}
          {myPendingAgentInvitations.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-sm p-6 space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-900 font-bold bg-amber-200/80 px-2.5 py-0.5 rounded-sm border border-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  Solicitudes de Propietarios en Revisión
                </span>
                <h2 className="text-xl font-serif-display font-semibold text-amber-950 mt-2">
                  Propiedades que solicitaron tu gestión ({myPendingAgentInvitations.length})
                </h2>
                <p className="text-xs text-amber-900/90">
                  Aceptá la solicitud para confirmar la asignación y comenzar a gestionar la propiedad, o rechazala si no tenés disponibilidad.
                </p>
              </div>

              <div className="space-y-3">
                {myPendingAgentInvitations.map((prop) => (
                  <div
                    key={prop.id}
                    className="p-4 bg-white border border-amber-300 rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <img
                        src={resolvePropertyImageUrl(prop.images[0])}
                        alt={prop.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== HERO_IMAGE) {
                            e.currentTarget.src = HERO_IMAGE;
                          }
                        }}
                        className="w-16 h-12 rounded-sm object-cover bg-[#D5BFA0] shrink-0"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs text-amber-800 font-semibold">
                          Propietario solicitante: {prop.ownerName}
                        </div>
                        <div className="text-sm font-semibold text-[#1F241F]">{prop.title}</div>
                        <div className="text-xs font-tabular text-[#173B43]">
                          {prop.location} · {prop.operationType.toUpperCase()} {prop.currency}{' '}
                          {prop.price.toLocaleString()} ({prop.surface} m²)
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAgentRespondAssignment(prop.id, true)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm inline-flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aceptar y Gestionar
                      </button>
                      <input
                        type="text"
                        value={agentRejectReasonDrafts[prop.id] || ''}
                        onChange={(e) =>
                          setAgentRejectReasonDrafts((prev) => ({
                            ...prev,
                            [prop.id]: e.target.value,
                          }))
                        }
                        placeholder="Motivo si no estás disponible..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onAgentRespondAssignment(
                            prop.id,
                            false,
                            agentRejectReasonDrafts[prop.id] || 'Sin disponibilidad en la zona actualmente.'
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 rounded-sm inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Propiedades confirmadas a cargo de este agente */}
          <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-5">
            <div className="border-b border-[#D5BFA0] pb-4">
              <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
                Propiedades Confirmadas a Mi Cargo ({myAssignedProperties.length})
              </h2>
              <p className="text-xs text-[#173B43]/75 mt-0.5">
                Aquí aparecen únicamente los inmuebles donde estás asignado formalmente como agente responsable. No podés modificar publicaciones de otros agentes ni propiedades sin asignación confirmada.
              </p>
            </div>

            {myAssignedProperties.length === 0 ? (
              <p className="text-sm text-[#173B43]/70 py-8 text-center">
                Actualmente no tenés propiedades asignadas a tu cargo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#D5BFA0] text-xs uppercase tracking-wider text-[#173B43]/70">
                      <th className="py-3 pr-4">Inmueble</th>
                      <th className="py-3 px-3">Propietario</th>
                      <th className="py-3 px-3">Operación / Valor</th>
                      <th className="py-3 px-3">Publicación</th>
                      <th className="py-3 px-3">Disponibilidad</th>
                      <th className="py-3 pl-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5BFA0]/60">
                    {myAssignedProperties.map((prop) => (
                      <tr key={prop.id}>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolvePropertyImageUrl(prop.images[0])}
                              alt={prop.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== HERO_IMAGE) {
                                  e.currentTarget.src = HERO_IMAGE;
                                }
                              }}
                              className="w-14 h-10 rounded-sm object-cover bg-[#F8F6F1] shrink-0"
                            />
                            <div>
                              <div className="font-semibold text-[#1F241F]">{prop.title}</div>
                              <div className="text-xs text-[#173B43]/70">
                                {prop.location} · <span className="font-tabular">{prop.surface} m²</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-[#173B43]">
                          <strong className="text-[#1F241F]">{prop.ownerName}</strong>
                        </td>
                        <td className="py-3.5 px-3 font-tabular text-xs">
                          <span className="uppercase text-[#B86F52] font-semibold block">
                            {prop.operationType}
                          </span>
                          <span className="font-semibold text-[#173B43]">
                            {prop.currency} {prop.price.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-xs">
                          <span
                            className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border ${getPublicationStatusBadgeClass(
                              prop.publicationStatus
                            )}`}
                          >
                            {prop.publicationStatus === 'suspendida' ? 'rechazada' : prop.publicationStatus}
                          </span>
                          {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && prop.rejectionReason && (
                            <div className="mt-1 max-w-56 text-[11px] text-red-800">
                              Motivo: {prop.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <select
                            value={prop.availability}
                            onChange={(e) =>
                              onUpdateAvailability(prop.id, e.target.value as AvailabilityStatus)
                            }
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                          >
                            <option value="disponible">Disponible</option>
                            <option value="reservada">Reservada</option>
                            <option value="alquilada">Alquilada</option>
                            <option value="vendida">Vendida</option>
                          </select>
                        </td>
                        <td className="py-3.5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectProperty(prop)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-[#173B43] border border-[#D5BFA0] rounded-sm hover:bg-[#F8F6F1] inline-flex items-center gap-1"
                              title="Ver ficha"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEditProperty(prop)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm inline-flex items-center gap-1 transition-colors"
                              title="Editar datos de esta propiedad a mi cargo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar ficha
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {(activeSubView === 'propietario_visitas' || activeSubView === 'agente_visitas') && (() => {
        const baseVisits = activeSubView === 'propietario_visitas' ? ownerVisits : agentVisits;
        const filteredVisits = baseVisits.filter((v) => {
          if (visitFilter === 'todas') return true;
          if (visitFilter === 'pendiente') return v.status === 'pendiente' || v.status === 'reprogramada';
          if (visitFilter === 'confirmada') return v.status === 'confirmada' || v.status === 'realizada';
          if (visitFilter === 'rechazada') return v.status === 'rechazada';
          if (visitFilter === 'cancelada') return v.status === 'cancelada';
          return true;
        });

        return (
          <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#D5BFA0]/60 pb-4">
              <h2 className="text-2xl font-serif-display font-semibold text-[#303638]">
                {activeSubView === 'propietario_visitas'
                  ? 'Visitas Solicitadas a Mis Propiedades'
                  : 'Agenda de Visitas de Propiedades a Mi Cargo'}
              </h2>

              {/* Botones de filtros para visitas del propietario / agente */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setVisitFilter('todas')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    visitFilter === 'todas'
                      ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                      : 'bg-[#F8F6F1] text-[#303638] border-[#D5BFA0] hover:bg-white'
                  }`}
                >
                  <span className="truncate">Todas ({baseVisits.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisitFilter('pendiente')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    visitFilter === 'pendiente'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Pendientes ({baseVisits.filter((v) => v.status === 'pendiente' || v.status === 'reprogramada').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisitFilter('confirmada')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    visitFilter === 'confirmada'
                      ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                      : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Confirmadas ({baseVisits.filter((v) => v.status === 'confirmada' || v.status === 'realizada').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisitFilter('rechazada')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    visitFilter === 'rechazada'
                      ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                      : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Rechazadas ({baseVisits.filter((v) => v.status === 'rechazada').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisitFilter('cancelada')}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    visitFilter === 'cancelada'
                      ? 'bg-gray-700 text-white border-gray-800 shadow-xs'
                      : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Canceladas ({baseVisits.filter((v) => v.status === 'cancelada').length})</span>
                </button>
              </div>
            </div>

            {filteredVisits.length === 0 ? (
              <p className="text-sm text-[#303638]/70 py-8 text-center">
                {baseVisits.length === 0
                  ? 'No hay visitas registradas en esta sección.'
                  : 'No hay visitas registradas con este estado.'}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    className="card-floating p-5 bg-white border-2 border-[#D5BFA0] rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#173B43]/80">
                        <span>
                          Cliente interesado: <strong className="text-[#1F241F]">{v.clientName}</strong>
                        </span>
                        <span
                          className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getVisitStatusBadgeClass(
                            v.status
                          )}`}
                        >
                          Estado: {v.status}
                        </span>
                      </div>
                      <div className="text-base font-serif-display font-semibold text-[#1F241F]">
                        {v.propertyTitle}
                      </div>
                      <div className="text-xs font-tabular text-[#173B43]">
                        {v.status === 'reprogramada' ? (
                          <span>
                            Nueva fecha propuesta: <strong className="text-[#1F241F]">{v.date} · {v.timeSlot}</strong>
                          </span>
                        ) : v.status === 'confirmada' || v.status === 'realizada' ? (
                          <span>
                            Fecha confirmada: <strong className="text-[#173B43] font-bold">{v.date} · {v.timeSlot}</strong>
                          </span>
                        ) : (
                          <span>
                            Fecha solicitada: <strong className="text-[#1F241F]">{v.date} · {v.timeSlot}</strong>
                          </span>
                        )}
                      </div>
                      {v.notes && <div className="text-xs text-[#173B43]/75">Nota: {v.notes}</div>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {v.status === 'cancelada' ? (
                        <div className="px-3.5 py-2 bg-rose-100 text-rose-900 border border-rose-300 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs">
                          <XCircle className="w-4 h-4 text-rose-700 shrink-0" />
                          <span>CANCELADO POR EL CLIENTE</span>
                        </div>
                      ) : v.status !== 'pendiente' && editingVisitId !== v.id ? (
                        <button
                          type="button"
                          onClick={() => setEditingVisitId(v.id)}
                          className="px-3.5 py-2 text-xs font-bold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] hover:bg-[#D5BFA0]/40 rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#B86F52]" />
                          <span>Editar Acción</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateVisit(v.id, 'confirmada', v.date, v.timeSlot, v.notes);
                              setEditingVisitId(null);
                            }}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#173B43] rounded-sm hover:bg-[#122e35] cursor-pointer shadow-xs"
                          >
                            Confirmar Visita
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateVisit(v.id, 'rechazada', v.date, v.timeSlot, v.notes);
                              setEditingVisitId(null);
                            }}
                            className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 cursor-pointer"
                          >
                            Rechazar
                          </button>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="date"
                              min={getMinVisitDate()}
                              value={rescheduleDates[v.id] || v.date}
                              onChange={(e) =>
                                setRescheduleDates((prev) => ({ ...prev, [v.id]: e.target.value }))
                              }
                              className="px-2.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                            />
                            <input
                              type="text"
                              value={rescheduleSlots[v.id] || v.timeSlot}
                              onChange={(e) =>
                                setRescheduleSlots((prev) => ({ ...prev, [v.id]: e.target.value }))
                              }
                              placeholder="Nuevo horario"
                              className="w-28 px-2.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newDate = rescheduleDates[v.id] || v.date;
                                const newSlot = rescheduleSlots[v.id] || v.timeSlot;
                                onUpdateVisit(
                                  v.id,
                                  'reprogramada',
                                  newDate,
                                  newSlot,
                                  'Horario reprogramado por el responsable'
                                );
                                setRescheduleDates((prev) => {
                                  const c = { ...prev };
                                  delete c[v.id];
                                  return c;
                                });
                                setRescheduleSlots((prev) => {
                                  const c = { ...prev };
                                  delete c[v.id];
                                  return c;
                                });
                                setEditingVisitId(null);
                              }}
                              className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-400 rounded-sm hover:bg-amber-200 cursor-pointer"
                            >
                              Reprogramar
                            </button>
                          </div>
                          {editingVisitId === v.id && (
                            <button
                              type="button"
                              onClick={() => setEditingVisitId(null)}
                              className="px-3.5 py-2 text-xs font-bold text-[#173B43] bg-white border border-[#D5BFA0] hover:bg-[#F8F6F1] rounded-sm cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cancelar edición</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {activeSubView === 'propietario_consultas' &&
        canActAsOwner &&
        renderChatSection(ownerInquiries, true)}

      {activeSubView === 'agente_consultas' &&
        currentUser.role === 'agente' &&
        renderChatSection(agentInquiries, true)}

      {(activeSubView === 'propietario_operaciones' || activeSubView === 'agente_operaciones') && (
        <div className="card-floating bg-white border-2 border-[#D5BFA0] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#D5BFA0]/60 pb-4">
            <h2 className="text-2xl font-serif-display font-semibold text-[#303638]">
              {activeSubView === 'propietario_operaciones'
                ? 'Propuestas Recibidas y Contratos'
                : 'Operaciones y Contratos de Propiedades a Mi Cargo'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
              <button
                type="button"
                onClick={() => setOpFilter('todos')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  opFilter === 'todos'
                    ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                    : 'bg-[#F8F6F1] text-[#303638] border-[#D5BFA0] hover:bg-white'
                }`}
              >
                <span>Todas</span>
              </button>
              <button
                type="button"
                onClick={() => setOpFilter('proceso')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  opFilter === 'proceso'
                    ? 'bg-sky-700 text-white border-sky-800 shadow-xs'
                    : 'bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>En proceso</span>
              </button>
              <button
                type="button"
                onClick={() => setOpFilter('aceptadas')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  opFilter === 'aceptadas'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Aceptadas</span>
              </button>
              <button
                type="button"
                onClick={() => setOpFilter('concretadas')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  opFilter === 'concretadas'
                    ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                    : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/30'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Concretadas</span>
              </button>
              <button
                type="button"
                onClick={() => setOpFilter('rechazadas')}
                className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                  opFilter === 'rechazadas'
                    ? 'bg-rose-700 text-white border-rose-800 shadow-xs'
                    : 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Rechazadas</span>
              </button>
            </div>
          </div>
          {(activeSubView === 'propietario_operaciones' ? ownerOperations : agentOperations).filter((op) => {
            if (opFilter === 'todos') return true;
            const cat = normalizeDealCategory(op.status);
            if (opFilter === 'proceso') return cat === 'proceso';
            if (opFilter === 'aceptadas') return cat === 'aceptada';
            if (opFilter === 'concretadas') return cat === 'concretada';
            if (opFilter === 'rechazadas') return cat === 'rechazada';
            return true;
          }).length === 0 ? (
            <p className="text-sm text-[#303638]/70 py-8 text-center">
              No hay propuestas de operación registradas para estas propiedades con el filtro seleccionado.
            </p>
          ) : (
            <div className="space-y-4">
              {(activeSubView === 'propietario_operaciones' ? ownerOperations : agentOperations).filter((op) => {
                if (opFilter === 'todos') return true;
                const cat = normalizeDealCategory(op.status);
                if (opFilter === 'proceso') return cat === 'proceso';
                if (opFilter === 'aceptadas') return cat === 'aceptada';
                if (opFilter === 'concretadas') return cat === 'concretada';
                if (opFilter === 'rechazadas') return cat === 'rechazada';
                return true;
              }).map((op) => {
                const isRental = op.operationType === 'alquiler';
                const prop = allProperties.find((p) => p.id === op.propertyId);
                const relatedContract = contracts.find((c) => c.operationId === op.id);

                return (
                  <div
                    key={op.id}
                    className="card-floating p-5 sm:p-6 bg-[#F8F6F1]/60 border-2 border-[#D5BFA0] rounded-2xl space-y-4 shadow-2xs"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5BFA0]/70 pb-3">
                      <div>
                        <span className="text-xs font-semibold text-[#B86F52] uppercase tracking-wider">
                          {op.operationType} · Solicitante: {op.clientName}
                        </span>
                        <h3 className="text-lg font-serif-display font-semibold text-[#1F241F]">
                          {op.propertyTitle}
                        </h3>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-base font-semibold font-tabular text-[#173B43] block">
                          {op.currency} {op.offeredAmount.toLocaleString()}
                        </span>
                        <span
                          className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getDealStatusBadgeClass(
                            op.status
                          )}`}
                        >
                          Estado:{' '}
                          {normalizeDealCategory(op.status) === 'concretada'
                            ? 'CONCRETADA'
                            : normalizeDealCategory(op.status) === 'aceptada'
                            ? 'PROPUESTA ACEPTADA (PENDIENTE CONTRATO)'
                            : normalizeDealCategory(op.status) === 'rechazada'
                            ? 'RECHAZADA'
                            : 'EN NEGOCIACIÓN'}
                        </span>
                      </div>
                    </div>

                    {/* Proposal Details Read-Only Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-sm border border-[#D5BFA0]/60">
                      <div>
                        <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                          Monto Propuesto
                        </span>
                        <span className="font-semibold text-[#1F241F] font-tabular">
                          {op.counterOffer?.currency || op.currency} {(op.counterOffer?.amount || op.offeredAmount).toLocaleString()}
                        </span>
                      </div>

                      {isRental ? (
                        <>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Garantía Ofrecida
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.guaranteeType || 'No especificada'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Condiciones (Cliente)
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.conditions || 'Sin condiciones'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Forma de Pago
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.paymentMethod || 'Contado / Transferencia'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#173B43]/70 uppercase font-semibold block">
                              Condiciones
                            </span>
                            <span className="font-semibold text-[#1F241F]">
                              {op.conditions || op.message || 'Sin observaciones'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Observations / Message */}
                    {op.message && (
                      <p className="text-xs text-[#173B43]/85 italic">
                        &ldquo;{op.message}&rdquo;
                      </p>
                    )}

                    {/* Counter offer details if present */}
                    {op.counterOffer && (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-sm text-xs space-y-1">
                        <div className="font-bold text-amber-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
                          <span>Última Contrapropuestas ({op.counterOffer.proposedBy}):</span>
                          <span className="font-tabular">
                            {op.counterOffer.currency} {op.counterOffer.amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-amber-950 font-medium">
                          {op.counterOffer.conditions}
                        </p>
                      </div>
                    )}

                    {/* Status-specific Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#D5BFA0]/70">
                      {(op.status === 'pendiente' || op.status === 'solicitada' || op.status === 'en_negociacion') && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUpdateOperation(op.id, 'aceptada')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aceptar Propuesta
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveCounterModalOp(op)}
                            className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-400 hover:bg-amber-200 rounded-sm cursor-pointer inline-flex items-center gap-1.5"
                          >
                            Proponer Otros Términos
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateOperation(op.id, 'rechazada')}
                            className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 rounded-sm cursor-pointer inline-flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                        </>
                      )}

                      {op.status === 'aceptada' && (
                        <div className="flex flex-col gap-3 w-full">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#173B43] bg-[#D5BFA0]/30 px-3 py-1.5 rounded-sm border border-[#173B43]">
                              Propuesta Aceptada · Condiciones Acordadas
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveCounterModalOp(op)}
                                className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-400 hover:bg-amber-200 rounded-sm cursor-pointer inline-flex items-center gap-1.5"
                              >
                                Proponer Otros Términos
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateOperation(op.id, 'rechazada')}
                                className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 rounded-sm cursor-pointer inline-flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                Rechazar
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveContractModalOp(op)}
                                className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                Concretar Operación y Registrar Contrato →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {op.status === 'concretada' && (
                        <div className="w-full p-3.5 bg-[#F8F6F1] border-2 border-[#173B43] rounded-sm text-xs space-y-1">
                          <div className="font-bold text-[#173B43] font-tabular text-sm flex items-center justify-between">
                            <span>Operación Concretada · Contrato #{op.contractCode || relatedContract?.contractCode}</span>
                            <span className="uppercase text-[10px] bg-[#D5BFA0]/55 text-[#173B43] px-2 py-0.5 rounded-sm font-semibold">
                              {isRental ? 'Alquilada' : 'Vendida'}
                            </span>
                          </div>
                          <p className="text-[#173B43]">
                            {relatedContract?.contractTerms || op.contractTerms || 'Contrato registrado exitosamente.'}
                          </p>
                          {relatedContract?.signedContractDocRef && (
                            <div className="text-[11px] font-mono text-[#173B43] pt-0.5">
                              Documento: {relatedContract.signedContractDocRef}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ADMINISTRADOR SCREENS
         ===================================================================== */}
      {activeSubView === 'admin_dashboard' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#D5BFA0] pb-4">
            <div>
              <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
                Reportes y Métricas de la Plataforma
              </h2>
              <p className="text-xs text-[#173B43]/75 mt-0.5">
                Datos calculados en tiempo real directamente desde Firestore a partir de las publicaciones, usuarios y operaciones registradas.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#173B43]/10 text-[#173B43] rounded-sm self-start md:self-center">
              Supervisión Administrativa
            </span>
          </div>

          {/* Métricas Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Total de Inmuebles */}
            <div className="p-5 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#173B43]/75">
                Total Inmuebles
              </div>
              <div className="text-3xl font-bold font-tabular text-[#1F241F]">
                {allProperties.length}
              </div>
              <div className="text-xs text-[#173B43]/70 flex flex-wrap gap-1.5 pt-1">
                <span>Total registrados</span>
              </div>
            </div>

            {/* 2. Activas en Catálogo */}
            <div className="p-5 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#173B43]">
                Activas / Disponibles
              </div>
              <div className="text-3xl font-bold font-tabular text-[#173B43]">
                {allProperties.filter((p) => p.publicationStatus === 'aprobada' && p.availability !== 'alquilada' && p.availability !== 'vendida').length}
              </div>
              <div className="text-xs text-[#173B43]">
                Aprobadas y visibles para búsqueda.
              </div>
            </div>

            {/* 3. Concretadas / Finalizadas */}
            <div className="p-5 bg-blue-50 border border-blue-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-blue-900">
                Concretadas (Alquiladas / Vendidas)
              </div>
              <div className="text-3xl font-bold font-tabular text-blue-900">
                {allProperties.filter((p) => p.availability === 'alquilada' || p.availability === 'vendida').length}
              </div>
              <div className="text-xs text-blue-800">
                Operaciones cerradas y firmadas.
              </div>
            </div>

            {/* 4. Pendientes de Moderación */}
            <div className="p-5 bg-amber-50 border border-amber-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-amber-900">
                Pendientes
              </div>
              <div className="text-3xl font-bold font-tabular text-amber-900">
                {adminPendingActionProperties.length}
              </div>
              <div className="text-xs text-amber-800">
                En revisión o asignación requerida.
              </div>
            </div>

            {/* 5. Rechazadas */}
            <div className="p-5 bg-rose-50 border border-rose-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-rose-900">
                Rechazadas
              </div>
              <div className="text-3xl font-bold font-tabular text-rose-900">
                {allProperties.filter((p) => p.publicationStatus === 'rechazada').length}
              </div>
              <div className="text-xs text-rose-800">
                Devueltas para corrección.
              </div>
            </div>
          </div>

          {/* Segunda Fila: Usuarios, Transacciones y Reclamos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Usuarios y Roles */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#173B43]">
                  Usuarios Registrados
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {uniqueUsers.length}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#173B43]/85 border-t border-[#D5BFA0]/60 pt-2">
                <div className="flex justify-between">
                  <span>Clientes:</span>
                  <strong className="font-tabular">
                    {uniqueUsers.filter((u) => u.role === 'cliente').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Propietarios:</span>
                  <strong className="font-tabular">
                    {uniqueUsers.filter((u) => u.role === 'propietario').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Agentes Inmobiliarios:</span>
                  <strong className="font-tabular">
                    {uniqueUsers.filter((u) => u.role === 'agente').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Administradores:</span>
                  <strong className="font-tabular">
                    {uniqueUsers.filter((u) => u.role === 'administrador').length}
                  </strong>
                </div>
              </div>
            </div>

            {/* Operaciones y Contratos Reales */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#173B43]">
                  Operaciones y Contratos
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {allOperations.length}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#173B43]/85 border-t border-[#D5BFA0]/60 pt-2">
                <div className="flex justify-between">
                  <span>Concretadas / Cerradas:</span>
                  <strong className="font-tabular text-[#173B43]">
                    {allOperations.filter((o) => normalizeDealCategory(o.status) === 'concretada').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Aceptadas (pendientes de firma):</span>
                  <strong className="font-tabular text-amber-800">
                    {allOperations.filter((o) => normalizeDealCategory(o.status) === 'aceptada').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>En negociación / Solicitadas:</span>
                  <strong className="font-tabular text-blue-800">
                    {allOperations.filter((o) => normalizeDealCategory(o.status) === 'proceso').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Rechazadas:</span>
                  <strong className="font-tabular text-rose-800">
                    {allOperations.filter((o) => normalizeDealCategory(o.status) === 'rechazada').length}
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#D5BFA0]/40 text-[11px] text-[#173B43]">
                  <span>Monto transaccionado (cerradas):</span>
                  <strong className="font-tabular">
                    USD {allOperations.filter((o) => normalizeDealCategory(o.status) === 'concretada').reduce((acc, o) => acc + (Number(o.offeredAmount) || 0), 0).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Reclamos y Soporte */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#173B43]">
                  Centro de Reclamos
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {claims.length}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#173B43]/85 border-t border-[#D5BFA0]/60 pt-2">
                <div className="flex justify-between">
                  <span>Pendientes por responder:</span>
                  <strong className="font-tabular text-amber-800">
                    {adminPendingClaims.length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Reclamos resueltos:</span>
                  <strong className="font-tabular text-[#173B43]">
                    {claims.filter((c) => c.status === 'resuelto').length}
                  </strong>
                </div>

                <p className="text-[11px] text-[#173B43]/65 pt-2">
                  Podés resolver o dictaminar sobre reclamos desde la pestaña &quot;Gestión de Reclamos&quot;.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADMINISTRADOR: OPERACIONES Y CONTRATOS (VISTA DEDICADA)
         ===================================================================== */}
      {activeSubView === 'admin_operaciones' &&
        currentUser.role === 'administrador' &&
        renderAdminOperationsView(true)}

      {/* =====================================================================
          MODERACIÓN Y SOLICITUDES DEL ADMINISTRADOR CON FILTROS
          (Pendientes sin acción vs Ya Respondidas)
         ===================================================================== */}
      {activeSubView === 'admin_publicaciones' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-6">
          <div className="flex flex-col gap-4 border-b border-[#D5BFA0] pb-4">
            <div className="w-full">
              <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
                Moderación de Publicaciones y Solicitudes de Agente
              </h2>
              <p className="text-xs text-[#173B43]/75 mt-0.5">
                Las solicitudes que apruebes o rechaces pasan automáticamente a la pestaña de{' '}
                <strong>Ya Respondidas / Gestionadas</strong> para mantener limpio tu panel principal.
              </p>
            </div>

            {/* Filtro de solicitudes del Administrador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setAdminModerationFilter('pendientes')}
                className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-2 cursor-pointer text-center ${
                  adminModerationFilter === 'pendientes'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Pendientes de Acción ({adminPendingActionProperties.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminModerationFilter('respondidas')}
                className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-2 cursor-pointer text-center ${
                  adminModerationFilter === 'respondidas'
                    ? 'bg-[#173B43] text-[#FCFBF7] border-[#173B43] shadow-xs'
                    : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/40'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Ya Respondidas / Historial ({adminRespondedProperties.length})</span>
              </button>
            </div>
          </div>

          {adminModerationFilter === 'pendientes' ? (
            adminPendingActionProperties.length === 0 ? (
              <div className="p-10 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#173B43] mx-auto" />
                <div className="text-base font-serif-display font-semibold text-[#173B43]">
                  ¡Todo al día! No hay solicitudes pendientes por revisar
                </div>
                <p className="text-xs text-[#173B43]/80 max-w-md mx-auto">
                  Todas las publicaciones y solicitudes de asignación de agentes fueron respondidas. Podés consultarlas en la pestaña{' '}
                  <button
                    type="button"
                    onClick={() => setAdminModerationFilter('respondidas')}
                    className="underline font-bold"
                  >
                    Ya Respondidas / Historial ({adminRespondedProperties.length})
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {adminPendingActionProperties.map((prop) => {
                  const status =
                    prop.agentAssignmentStatus ||
                    (prop.agentId?.trim() ? 'asignado' : 'sin_agente');
                  const selectedAgentUid =
                    adminSelectedAgentByProp[prop.id] ??
                    prop.requestedAgentId ??
                    prop.agentId ??
                    agentsList[0]?.uid ??
                    '';
                  const isPubPending = prop.publicationStatus === 'pendiente';
                  const isAgentPending =
                    status === 'pendiente_admin' || status === 'pendiente_agente';

                  return (
                    <div
                      key={prop.id}
                      className="p-5 bg-amber-50/60 border-2 border-amber-300 rounded-sm space-y-4"
                    >
                      {/* Título de la casa en una línea independiente ocupando toda la tarjeta */}
                      <div className="w-full pb-2.5 border-b border-amber-200 flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getPublicationStatusBadgeClass(
                                prop.publicationStatus
                              )}`}
                            >
                              {prop.publicationStatus === 'pendiente'
                                ? 'Publicación: En Revisión (Pendiente)'
                                : prop.publicationStatus === 'aprobada'
                                ? 'Publicación: Ya Aprobada'
                                : 'Publicación: Rechazada'}
                            </span>
                            {isAgentPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border bg-amber-200 text-amber-950 border-amber-500">
                                <Clock className="w-3 h-3" />
                                Asignación de Agente Pendiente
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-tabular font-bold text-[#173B43]">
                            {prop.operationType.toUpperCase()} — {prop.currency}{' '}
                            {prop.price.toLocaleString()} ({prop.surface} m²)
                          </div>
                        </div>
                        <h3 className="text-base sm:text-lg font-serif-display font-bold text-[#173B43] w-full pt-1">
                          {prop.title}
                        </h3>
                      </div>

                      {/* Info principal e imagen */}
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <img
                          src={resolvePropertyImageUrl(prop.images[0])}
                          alt={prop.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src !== HERO_IMAGE) {
                              e.currentTarget.src = HERO_IMAGE;
                            }
                          }}
                          className="w-24 h-18 rounded-sm object-cover bg-[#D5BFA0] shrink-0 border border-[#D5BFA0]"
                        />
                        <div className="space-y-1.5 text-xs text-[#173B43]">
                          <div>
                            Titular de la propiedad: <strong>{prop.ownerName}</strong> · Ubicación: {prop.location} ({prop.address})
                          </div>
                          <div>
                            {status === 'sin_agente' && (
                              <span className="text-[#173B43]">
                                Modalidad elegida por propietario:{' '}
                                <strong>Propietario independiente (No solicitó agente)</strong>
                              </span>
                            )}
                            {status === 'pendiente_admin' && (
                              <span className="text-amber-950 font-bold block">
                                ⚠️ Acción requerida: El propietario pidió que el Administrador le asigne un agente inmobiliario
                              </span>
                            )}
                            {status === 'pendiente_agente' && (
                              <span className="text-amber-950 font-bold block">
                                ⚠️ Acción requerida: El propietario eligió a{' '}
                                <u>{prop.requestedAgentName || 'un agente'}</u> (podés confirmar la asignación aquí)
                              </span>
                            )}
                            {status === 'asignado' && (
                              <span className="text-[#173B43] font-semibold block">
                                ✓ Agente confirmado a cargo: {prop.agentName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Fila inferior con todos los botones de Acción del CRUD alineados */}
                      <div className="flex flex-wrap items-center justify-start gap-2.5 pt-3 border-t border-amber-300 w-full">
                        {isPubPending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onModerateProperty(prop.id, 'aprobada')}
                              className="px-4 py-2 text-xs font-bold text-white bg-[#173B43] rounded-sm hover:bg-[#122e35] inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aprobar Publicación
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectProperty(prop)}
                              className="px-3.5 py-2 text-xs font-bold text-[#173B43] bg-white border border-[#D5BFA0] rounded-sm inline-flex items-center gap-1.5 cursor-pointer hover:bg-amber-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Revisar Ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPropertyToReject(prop);
                                setRejectionReasonDraft('');
                              }}
                              className="px-3.5 py-2 text-xs font-bold text-white bg-red-600 rounded-sm hover:bg-red-700 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              Rechazar
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProperty(prop.id)}
                              className="px-3.5 py-2 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="text-xs font-semibold text-[#173B43] bg-[#D5BFA0]/30 border border-[#D5BFA0] px-3 py-1.5 rounded-sm">
                              Publicación ya revisada ({prop.publicationStatus.toUpperCase()})
                            </div>
                            <button
                              type="button"
                              onClick={() => onSelectProperty(prop)}
                              className="px-3.5 py-2 text-xs font-bold text-[#173B43] bg-white border border-[#D5BFA0] rounded-sm inline-flex items-center gap-1.5 cursor-pointer hover:bg-amber-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Revisar Ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProperty(prop.id)}
                              className="px-3.5 py-2 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </>
                        )}

                        {isAgentPending && (
                          <div className="flex flex-wrap items-center gap-2 ml-auto">
                            <select
                              value={selectedAgentUid}
                              onChange={(e) =>
                                setAdminSelectedAgentByProp((prev) => ({
                                  ...prev,
                                  [prop.id]: e.target.value,
                                }))
                              }
                              className="px-2.5 py-1.5 text-xs bg-white border border-amber-400 rounded-sm text-[#1F241F]"
                            >
                              <option value="">Seleccionar agente...</option>
                              {agentsList.map((ag) => (
                                <option key={ag.uid} value={ag.uid}>
                                  {ag.displayName} ({ag.email})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const ag = agentsList.find((a) => a.uid === selectedAgentUid);
                                if (!ag) return;
                                onAdminConfirmAgentAssignment(prop.id, ag.uid, ag.displayName);
                              }}
                              disabled={!selectedAgentUid}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Confirmar y Asignar Agente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Pestaña 2: Solicitudes YA RESPONDIDAS por el Administrador */
            <div className="space-y-4">
              {adminRespondedProperties.length === 0 ? (
                <p className="text-sm text-[#173B43]/70 py-8 text-center">
                  Todavía no hay publicaciones respondidas en el historial.
                </p>
              ) : (
                adminRespondedProperties.map((prop) => {
                  const status =
                    prop.agentAssignmentStatus ||
                    (prop.agentId?.trim() ? 'asignado' : 'sin_agente');
                  const selectedAgentUid =
                    adminSelectedAgentByProp[prop.id] ??
                    prop.requestedAgentId ??
                    prop.agentId ??
                    agentsList[0]?.uid ??
                    '';

                  return (
                    <div
                      key={prop.id}
                      className="p-5 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-4"
                    >
                      {/* Título de la casa en una línea independiente ocupando toda la tarjeta */}
                      <div className="w-full pb-2.5 border-b border-[#D5BFA0]/60 flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getPublicationStatusBadgeClass(
                              prop.publicationStatus
                            )}`}
                          >
                            {prop.publicationStatus === 'aprobada' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> APROBADA
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" /> RECHAZADA
                              </>
                            )}
                          </span>
                          <div className="text-xs font-tabular font-bold text-[#173B43]">
                            {prop.operationType.toUpperCase()} — {prop.currency}{' '}
                            {prop.price.toLocaleString()} ({prop.surface} m²)
                          </div>
                        </div>
                        <h3 className="text-base sm:text-lg font-serif-display font-bold text-[#173B43] w-full pt-1">
                          {prop.title}
                        </h3>
                      </div>

                      {/* Info principal e imagen */}
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <img
                          src={resolvePropertyImageUrl(prop.images[0])}
                          alt={prop.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src !== HERO_IMAGE) {
                              e.currentTarget.src = HERO_IMAGE;
                            }
                          }}
                          className="w-24 h-18 rounded-sm object-cover bg-[#D5BFA0] shrink-0 border border-[#D5BFA0]"
                        />
                        <div className="space-y-1.5 text-xs text-[#173B43]">
                          <div>
                            Titular: <strong>{prop.ownerName}</strong> · Ubicación: {prop.location} ({prop.address})
                          </div>
                          <div>
                            {status === 'sin_agente' && (
                              <span className="text-[#173B43]">
                                Modalidad: <strong>Propietario independiente (Sin agente)</strong>
                              </span>
                            )}
                            {status === 'rechazado' && (
                              <span className="text-red-700 font-semibold">
                                El agente anterior rechazó la solicitud. Podés asignarle otro agente:
                              </span>
                            )}
                            {status === 'asignado' && (
                              <span className="text-[#173B43] font-semibold">
                                ✓ Agente confirmado a cargo: <strong>{prop.agentName}</strong>
                              </span>
                            )}
                          </div>
                          {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && prop.rejectionReason && (
                            <div className="text-xs text-red-700 font-medium">
                              Motivo de rechazo registrado: “{prop.rejectionReason}”
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fila inferior con todos los botones de Acción del CRUD alineados */}
                      <div className="flex flex-wrap items-center justify-start gap-2.5 pt-3 border-t border-[#D5BFA0] w-full">
                        <button
                          type="button"
                          onClick={() => onSelectProperty(prop)}
                          className="px-3.5 py-2 text-xs font-bold text-[#173B43] bg-white border border-[#D5BFA0] rounded-sm inline-flex items-center gap-1.5 cursor-pointer hover:bg-amber-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Revisar Ficha
                        </button>
                        {prop.publicationStatus !== 'aprobada' && (
                          <button
                            type="button"
                            onClick={() => onModerateProperty(prop.id, 'aprobada')}
                            className="px-3.5 py-2 text-xs font-bold text-white bg-[#173B43] border border-[#173B43] rounded-sm hover:bg-[#122e35] inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Cambiar a Aprobada
                          </button>
                        )}
                        {prop.publicationStatus !== 'rechazada' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPropertyToReject(prop);
                              setRejectionReasonDraft('');
                            }}
                            className="px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cambiar a Rechazada
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteProperty(prop.id)}
                          className="px-3.5 py-2 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>

                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                          <select
                            value={selectedAgentUid}
                            onChange={(e) =>
                              setAdminSelectedAgentByProp((prev) => ({
                                ...prev,
                                [prop.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#D5BFA0] rounded-sm text-[#1F241F]"
                          >
                            <option value="">Seleccionar agente...</option>
                            {agentsList.map((ag) => (
                              <option key={ag.uid} value={ag.uid}>
                                {ag.displayName} ({ag.email})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const ag = agentsList.find((a) => a.uid === selectedAgentUid);
                              if (!ag) return;
                              onAdminConfirmAgentAssignment(prop.id, ag.uid, ag.displayName);
                            }}
                            disabled={!selectedAgentUid}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Asignar / Cambiar Agente
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {activeSubView === 'admin_usuarios' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
              Administración de Usuarios, Roles y Estado de Cuentas
            </h2>
            <p className="text-xs text-[#173B43]/75 mt-0.5">
              Cualquier usuario registrado ingresa como Cliente (pudiendo habilitar funciones de Propietario). Desde aquí podés cambiar el rol de un usuario a Agente Inmobiliario.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D5BFA0] text-xs uppercase tracking-wider text-[#173B43]/70">
                  <th className="py-3 pr-4">Nombre</th>
                  <th className="py-3 px-4">Correo / Teléfono</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 pl-4 text-right">Estado de Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5BFA0]/60">
                {uniqueUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#173B43] text-[#FCFBF7] flex items-center justify-center shrink-0">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1F241F]">{u.displayName}</div>
                          <div className="text-xs text-[#173B43]/70">
                            {u.agencyName || (u.isAlsoOwner ? 'Cliente y Propietario' : 'Particular')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-tabular text-[#173B43]">
                      <div>{u.email}</div>
                      <div className="text-[#173B43]/70">{u.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          onUpdateUserAdmin(u.uid, e.target.value as UserRole, u.active)
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-[#D5BFA0] rounded-sm capitalize"
                      >
                        <option value="cliente">Cliente</option>
                        <option value="propietario">Propietario</option>
                        <option value="agente">Agente Inmobiliario</option>
                        <option value="administrador">Administrador</option>
                      </select>
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => onUpdateUserAdmin(u.uid, u.role, !u.active)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm border ${
                          u.active
                            ? 'text-[#173B43] border-[#173B43] bg-[#D5BFA0]/30'
                            : 'text-red-800 border-red-400 bg-red-100'
                        }`}
                      >
                        {u.active ? 'Activa (Desactivar)' : 'Suspendida / Inactiva (Activar)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubView === 'admin_categorias' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
            Gestión de Tipos de Inmueble y Características
          </h2>
          <form onSubmit={handleAddCategorySubmit} className="flex flex-wrap gap-2.5">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nombre de nuevo tipo o característica (ej. Quincho cubierto)..."
              className="flex-1 min-w-[220px] px-3.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
            />
            <select
              value={newCatKind}
              onChange={(e) => setNewCatKind(e.target.value as 'tipo_inmueble' | 'caracteristica')}
              className="px-3.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
            >
              <option value="caracteristica">Característica / Comodidad</option>
              <option value="tipo_inmueble">Tipo de Inmueble</option>
            </select>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] rounded-sm hover:bg-[#2c382d]"
            >
              + Agregar al Catálogo
            </button>
          </form>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#1F241F]">{cat.name}</div>
                  <div className="text-[11px] text-[#173B43]/70">
                    {cat.kind === 'tipo_inmueble' ? 'Tipo inmueble' : 'Característica'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleCategory(cat.id, !cat.active)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-sm border ${
                    cat.active
                      ? 'bg-[#D5BFA0]/30 text-[#173B43] border-[#173B43]'
                      : 'bg-red-100 text-red-800 border-red-400'
                  }`}
                >
                  {cat.active ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          CLAIMS / RECLAMOS (Admin & User views, con 4 estados y filtros)
         ===================================================================== */}
      {(activeSubView === 'admin_reclamos' || activeSubView === 'reclamos_usuario') && (
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-6 space-y-6">
          <div className="flex flex-col gap-4 border-b border-[#D5BFA0] pb-4">
            <div className="w-full">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
                Soporte y Reclamaciones
              </span>
              <h2 className="text-2xl font-serif-display font-semibold text-[#173B43]">
                Centro de Reclamos y Seguimiento
              </h2>
              <p className="text-xs text-[#173B43]/75 mt-0.5">
                {currentUser.role === 'administrador'
                  ? 'Gestioná los reclamos de los clientes, respondé en el chat interno, cambiá estados y registrá soluciones o motivos de desestimación.'
                  : 'Consultá tus reclamos, chateá con el administrador y seguí el historial y la solución de tus casos.'}
              </p>
            </div>

            {currentUser.role === 'administrador' && (
              <div className="grid grid-cols-3 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setAdminClaimFilter('pendientes')}
                  className={`px-3 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    adminClaimFilter === 'pendientes'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Pendientes ({adminPendingClaims.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminClaimFilter('en_revision')}
                  className={`px-3 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    adminClaimFilter === 'en_revision'
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                      : 'bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">En Revisión ({adminRevisionClaims.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminClaimFilter('solucionados')}
                  className={`px-3 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                    adminClaimFilter === 'solucionados'
                      ? 'bg-[#173B43] text-white border-[#173B43] shadow-xs'
                      : 'bg-[#F8F6F1] text-[#173B43] border-[#D5BFA0] hover:bg-[#D5BFA0]/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Solucionados ({adminSolvedClaims.length})</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {currentUser.role !== 'administrador' && (
              <form
                onSubmit={handleClaimSubmit}
                className="lg:col-span-4 space-y-3.5 bg-[#F8F6F1] p-5 rounded-sm border border-[#D5BFA0] shadow-xs"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[#173B43]">
                  + Enviar Nuevo Reclamo
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#173B43] mb-1">
                    Categoría del reclamo
                  </label>
                  <select
                    value={claimTargetType}
                    onChange={(e) => setClaimTargetType(e.target.value as ClaimTargetType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                  >
                    <option value="publicacion">Sobre una Publicación de inmueble</option>
                    <option value="visita">Sobre una Visita programada</option>
                    <option value="operacion">Sobre una Oferta / Contrato</option>
                    <option value="usuario">Atención al Usuario / General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#173B43] mb-1">
                    Asunto
                  </label>
                  <input
                    type="text"
                    required
                    value={claimSubject}
                    onChange={(e) => setClaimSubject(e.target.value)}
                    placeholder="Breve resumen del inconveniente..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#173B43] mb-1">
                    Descripción detallada
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={claimDesc}
                    onChange={(e) => setClaimDesc(e.target.value)}
                    placeholder="Describí los detalles para que la administración pueda ayudarte..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm resize-y"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-bold text-[#FCFBF7] bg-[#173B43] rounded-sm hover:bg-[#2c382d] transition-colors cursor-pointer"
                >
                  Registrar Reclamo
                </button>
              </form>
            )}

            <div
              className={`${
                currentUser.role === 'administrador' ? 'lg:col-span-12' : 'lg:col-span-8'
              } space-y-4`}
            >
              {(currentUser.role === 'administrador'
                ? adminClaimFilter === 'pendientes'
                  ? adminPendingClaims
                  : adminClaimFilter === 'en_revision'
                  ? adminRevisionClaims
                  : adminSolvedClaims
                : claims.filter((c) => c.reporterId === currentUser.uid)
              ).length === 0 ? (
                <div className="p-10 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-[#173B43]/50 mx-auto" />
                  <p className="text-sm font-semibold text-[#173B43]">
                    {currentUser.role === 'administrador'
                      ? adminClaimFilter === 'pendientes'
                        ? 'No hay reclamos pendientes en este momento.'
                        : adminClaimFilter === 'en_revision'
                        ? 'No hay reclamos en revisión.'
                        : 'No hay reclamos solucionados o desestimados en el historial.'
                      : 'No tenés reclamos registrados en este momento.'}
                  </p>
                  <p className="text-xs text-[#173B43]/75">
                    {currentUser.role === 'administrador'
                      ? 'Podés revisar las demás pestañas superiores para ver casos en otros estados.'
                      : 'Utilizá el formulario de la izquierda para iniciar una nueva consulta o reclamo de soporte.'}
                  </p>
                </div>
              ) : (
                (currentUser.role === 'administrador'
                  ? adminClaimFilter === 'pendientes'
                    ? adminPendingClaims
                    : adminClaimFilter === 'en_revision'
                    ? adminRevisionClaims
                    : adminSolvedClaims
                  : claims.filter((c) => c.reporterId === currentUser.uid)
                ).map((clm) => {
                  const isExpanded = expandedClaimId === clm.id;
                  const claimCode = clm.claimCode || `#REC-${clm.id.replace('clm_', '').slice(-5).toUpperCase()}`;
                  const normStatus = normalizeClaimStatus(clm.status);

                  return (
                    <div
                      key={clm.id}
                      className="p-5 bg-white border border-[#D5BFA0] rounded-sm space-y-4 shadow-xs"
                    >
                      {/* Cabecera del reclamo */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D5BFA0]/60 pb-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold font-tabular text-[#173B43] bg-[#F8F6F1] px-2.5 py-1 rounded-sm border border-[#D5BFA0]">
                            {claimCode}
                          </span>
                          <span className="text-[#173B43]/75">
                            Reportado por <strong className="text-[#1F241F]">{clm.reporterName}</strong> ({clm.reporterEmail})
                          </span>
                          <span className="uppercase text-[10px] bg-[#173B43]/10 text-[#173B43] px-2 py-0.5 rounded-sm font-semibold">
                            {getClaimCategoryLabel(clm.targetType)}
                          </span>
                        </div>
                        <span
                          className={`inline-block text-[11px] uppercase tracking-wider font-bold px-3 py-1 rounded-sm border ${getClaimStatusBadgeClass(
                            clm.status
                          )}`}
                        >
                          {getClaimStatusLabel(clm.status)}
                        </span>
                      </div>

                      {/* Asunto y descripción */}
                      <div className="space-y-1.5">
                        <h3 className="text-base font-serif-display font-semibold text-[#1F241F]">
                          {clm.subject}
                        </h3>
                        <p className="text-xs text-[#173B43]/85 leading-relaxed bg-[#F8F6F1]/50 p-3 rounded-sm border border-[#D5BFA0]/40">
                          {clm.description}
                        </p>
                      </div>

                      {/* Resolución / Solución / Desestimación si corresponde */}
                      {normStatus === 'solucionado' && clm.solutionDescription && (
                        <div className="p-3.5 bg-[#F8F6F1] border-2 border-[#173B43] rounded-sm text-xs space-y-1">
                          <div className="font-bold text-[#173B43] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-[#173B43]" />
                            <span>Solución Aplicada por Administración:</span>
                          </div>
                          <p className="text-[#173B43] leading-relaxed font-medium">
                            {clm.solutionDescription}
                          </p>
                        </div>
                      )}



                      {/* Acciones de Administrador & Despliegue de Conversación / Historial */}
                      <div className="pt-3 border-t border-[#D5BFA0]/70 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedClaimId(isExpanded ? null : clm.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] hover:bg-[#D5BFA0]/40 rounded-sm inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Conversación e Historial ({clm.messages?.length || 0} msgs)</span>
                            </button>
                          </div>

                          {currentUser.role === 'administrador' && (
                            <div className="flex flex-wrap items-center gap-2">
                              {normStatus !== 'en_revision' && normStatus !== 'solucionado' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onUpdateClaimStatus) {
                                      await onUpdateClaimStatus(clm.id, 'en_revision', 'Reclamo puesto en revisión por administrador.');
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-300 hover:bg-blue-100 rounded-sm cursor-pointer"
                                >
                                  Poner en Revisión
                                </button>
                              )}

                              {normStatus !== 'solucionado' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolveClaimModal(clm);
                                    setResolveDescDraft(clm.solutionDescription || '');
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#173B43] hover:bg-[#122e35] rounded-sm cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Resolver (Solucionado)
                                </button>
                              )}

                              {normStatus === 'solucionado' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (onUpdateClaimStatus) {
                                      await onUpdateClaimStatus(clm.id, 'pendiente', 'Reclamo reabierto por administración.', { reopenReason: 'Reabierto para revisión adicional' });
                                    }
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-400 hover:bg-amber-200 rounded-sm cursor-pointer inline-flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Reabrir Reclamo
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Panel expandido con chat y línea de tiempo */}
                        {isExpanded && (
                          <div className="mt-3 p-4 bg-[#F8F6F1]/70 border border-[#D5BFA0] rounded-sm space-y-4">
                            <div className="text-xs font-bold text-[#173B43] uppercase tracking-wider flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5" />
                              Conversación interna del reclamo
                            </div>

                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                              {(!clm.messages || clm.messages.length === 0) ? (
                                <p className="text-xs text-[#173B43]/70 italic">
                                  No hay mensajes en la conversación todavía. Escribí abajo para responder.
                                </p>
                              ) : (
                                clm.messages.map((m) => {
                                  const isMine = m.senderId === currentUser.uid;
                                  return (
                                    <div
                                      key={m.id}
                                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                                    >
                                      <div
                                        className={`max-w-md p-3 rounded-sm text-xs space-y-1 ${
                                          isMine
                                            ? 'bg-[#173B43] text-[#FCFBF7]'
                                            : 'bg-white border border-[#D5BFA0] text-[#1F241F]'
                                        }`}
                                      >
                                        <div
                                          className={`flex items-center justify-between gap-4 text-[10px] ${
                                            isMine ? 'text-[#D5BFA0]' : 'text-[#173B43]/75'
                                          }`}
                                        >
                                          <span className="font-semibold">{m.senderName} ({m.senderRole})</span>
                                          <span className="font-tabular">{m.timestamp}</span>
                                        </div>
                                        <p className="leading-relaxed">{m.text}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Enviar mensaje en el reclamo */}
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const txt = (claimReplyDrafts[clm.id] || '').trim();
                                if (!txt || !onSendClaimMessage) return;
                                await onSendClaimMessage(clm.id, txt);
                                setClaimReplyDrafts((prev) => ({ ...prev, [clm.id]: '' }));
                              }}
                              className="flex gap-2 pt-2 border-t border-[#D5BFA0]/60"
                            >
                              <input
                                type="text"
                                value={claimReplyDrafts[clm.id] || ''}
                                onChange={(e) =>
                                  setClaimReplyDrafts((prev) => ({ ...prev, [clm.id]: e.target.value }))
                                }
                                placeholder="Escribir respuesta en el reclamo..."
                                className="flex-1 px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm"
                              />
                              <button
                                type="submit"
                                className="px-4 py-2 text-xs font-semibold text-white bg-[#173B43] hover:bg-[#2c382d] rounded-sm inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Enviar
                              </button>
                            </form>

                            {/* Historial de cambios de estado */}
                            {clm.statusHistory && clm.statusHistory.length > 0 && (
                              <div className="pt-3 border-t border-[#D5BFA0]/60 space-y-2">
                                <div className="text-[11px] font-bold text-[#173B43] uppercase tracking-wider flex items-center gap-1.5">
                                  <History className="w-3.5 h-3.5" />
                                  Historial de Seguimiento y Cambios
                                </div>
                                <div className="space-y-1.5 text-[11px] text-[#173B43]/85">
                                  {clm.statusHistory.map((sh) => (
                                    <div key={sh.id} className="flex flex-wrap items-center justify-between bg-white p-2 rounded-sm border border-[#D5BFA0]/60">
                                      <div>
                                        <span className="font-semibold text-[#1F241F]">{sh.changedBy}</span> ({sh.changedByRole}):{' '}
                                        <span>{sh.note || `Estado: ${sh.fromStatus} → ${sh.toStatus}`}</span>
                                      </div>
                                      <span className="font-tabular text-[10px] text-[#173B43]/70">{sh.timestamp}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Obligatorio para Marcar como Solucionado */}
      {resolveClaimModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setResolveClaimModal(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const desc = resolveDescDraft.trim();
              if (!desc) {
                if (onNotify) onNotify('error', 'Descripción obligatoria', 'Por favor ingresá la descripción de la solución.');
                return;
              }
              if (onUpdateClaimStatus) {
                await onUpdateClaimStatus(resolveClaimModal.id, 'solucionado', desc, {
                  solutionDescription: desc,
                });
              }
              setResolveClaimModal(null);
              setResolveDescDraft('');
            }}
            className="w-full max-w-lg space-y-4 rounded-sm border border-[#D5BFA0] bg-[#FCFBF7] p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-xl font-serif-display font-semibold text-[#1F241F]">
                Marcar Reclamo como Solucionado
              </h2>
              <p className="mt-1 text-xs text-[#173B43]/80">
                Reclamo {resolveClaimModal.claimCode || `#REC-${resolveClaimModal.id.replace('clm_', '').slice(-5)}`}: ingresá la descripción de la solución que se enviará automáticamente al cliente.
              </p>
            </div>
            <label className="block space-y-1 text-xs font-semibold text-[#173B43]">
              <span>Descripción de la Solución <span className="text-[#173B43]">(Obligatorio)</span></span>
              <textarea
                autoFocus
                required
                rows={4}
                value={resolveDescDraft}
                onChange={(e) => setResolveDescDraft(e.target.value)}
                placeholder="Detallá cómo se resolvió el reclamo..."
                className="w-full resize-y rounded-sm border border-[#D5BFA0] bg-white p-3 text-xs text-[#1F241F] outline-none focus:border-emerald-700"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResolveClaimModal(null);
                  setResolveDescDraft('');
                }}
                className="rounded-sm border border-[#D5BFA0] bg-white px-4 py-2 text-xs font-semibold text-[#173B43] hover:bg-[#F8F6F1]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!resolveDescDraft.trim()}
                className="rounded-sm bg-[#173B43] px-4 py-2 text-xs font-semibold text-white hover:bg-[#122e35] disabled:opacity-50 cursor-pointer"
              >
                Confirmar Solución y Notificar
              </button>
            </div>
          </form>
        </div>
      )}

      {propertyToReject && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPropertyToReject(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-property-title"
            onSubmit={async (event) => {
              event.preventDefault();
              const reason = rejectionReasonDraft.trim();
              if (!reason) return;
              await onModerateProperty(propertyToReject.id, 'rechazada', reason);
              setPropertyToReject(null);
              setRejectionReasonDraft('');
            }}
            className="w-full max-w-lg space-y-5 rounded-sm border border-[#D5BFA0] bg-[#FCFBF7] p-6 shadow-2xl"
          >
            <div>
              <h2 id="reject-property-title" className="text-xl font-serif-display font-semibold text-[#1F241F]">
                Rechazar publicación
              </h2>
              <p className="mt-1 text-sm text-[#173B43]/80">
                {propertyToReject.title}: explicá qué debe corregir el propietario o agente.
              </p>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold text-[#173B43]">
              <span>Motivo de rechazo <span className="text-red-700">(obligatorio)</span></span>
              <textarea
                autoFocus
                required
                maxLength={400}
                rows={4}
                value={rejectionReasonDraft}
                onChange={(event) => setRejectionReasonDraft(event.target.value)}
                placeholder="Indicá el problema y cómo corregirlo"
                className="w-full resize-y rounded-sm border border-[#D5BFA0] bg-white px-3 py-2 text-sm font-normal text-[#1F241F] outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPropertyToReject(null);
                  setRejectionReasonDraft('');
                }}
                className="rounded-sm border border-[#D5BFA0] bg-white px-4 py-2 text-sm font-semibold text-[#173B43] hover:bg-[#F8F6F1]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!rejectionReasonDraft.trim()}
                className="rounded-sm bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}

      {activeCounterModalOp && (
        <CounterOfferModal
          operation={activeCounterModalOp}
          proposedByRole={
            currentUser.role === 'agente' ? 'agente' : 'propietario'
          }
          onClose={() => setActiveCounterModalOp(null)}
          onSubmitCounterOffer={async (counterData) => {
            if (onCounterOffer) {
              await onCounterOffer(activeCounterModalOp.id, counterData);
            }
            setActiveCounterModalOp(null);
          }}
          onNotify={onNotify || (() => {})}
        />
      )}

      {activeContractModalOp && (
        <ContractRegistrationModal
          operation={activeContractModalOp}
          property={allProperties.find((p) => p.id === activeContractModalOp.propertyId)}
          currentUser={currentUser}
          onClose={() => setActiveContractModalOp(null)}
          onConfirmContract={async (contractData) => {
            if (onConfirmContract) {
              await onConfirmContract(activeContractModalOp.id, contractData);
            }
            setActiveContractModalOp(null);
          }}
          onNotify={onNotify || (() => {})}
        />
      )}
    </section>
  );
};
