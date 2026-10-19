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
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  PropertyItem,
  VisitItem,
  VisitStatus,
  InquiryItem,
  OperationItem,
  DealStatus,
  ClaimItem,
  ClaimTargetType,
  ClaimStatus,
  CategoryConfigItem,
  AvailabilityStatus,
  PublicationStatus,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';
import { HERO_IMAGE, INITIAL_USERS, resolvePropertyImageUrl } from '../data/initialData';

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
  onCreateClaim: (
    targetType: ClaimTargetType,
    targetReference: string,
    subject: string,
    description: string
  ) => Promise<void>;
  onResolveClaim: (claimId: string, status: ClaimStatus, resolution: string) => Promise<void>;
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
      return 'bg-emerald-100 text-emerald-900 border-emerald-400';
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
      return 'bg-emerald-100 text-emerald-900 border-emerald-400';
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

function getDealStatusBadgeClass(status: DealStatus): string {
  switch (status) {
    case 'aprobada':
    case 'concretada':
      return 'bg-emerald-100 text-emerald-900 border-emerald-400';
    case 'solicitada':
    case 'en_revision':
      return 'bg-amber-100 text-amber-900 border-amber-400';
    case 'rechazada':
      return 'bg-red-100 text-red-800 border-red-400';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-400';
  }
}

function getClaimStatusBadgeClass(status: ClaimStatus): string {
  switch (status) {
    case 'resuelto':
      return 'bg-emerald-100 text-emerald-900 border-emerald-400';
    case 'abierto':
    case 'en_revision':
      return 'bg-amber-100 text-amber-900 border-amber-400';
    case 'desestimado':
      return 'bg-red-100 text-red-800 border-red-400';
    default:
      return 'bg-amber-100 text-amber-900 border-amber-400';
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
  onCreateClaim,
  onResolveClaim,
  onUpdateUserAdmin,
  onAddCategory,
  onToggleCategory,
}) => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
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
  const [adminClaimFilter, setAdminClaimFilter] = useState<'pendientes' | 'respondidos'>(
    'pendientes'
  );

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

  // Reclamos separados por pendientes vs ya respondidos para el Admin
  const adminPendingClaims = claims.filter(
    (c) => c.status === 'abierto' || c.status === 'en_revision'
  );
  const adminRespondedClaims = claims.filter(
    (c) => c.status === 'resuelto' || c.status === 'desestimado'
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
    .filter((o) => o.status === 'concretada' || o.status === 'aprobada')
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm overflow-hidden flex flex-col min-h-[560px]">
          <div className="px-6 py-4 bg-[#39483A] text-[#FCFBF7] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSelectedChatId(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-[#FCFBF7] rounded-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a conversaciones
              </button>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#D8C7AA]">
                  {counterpartRoleLabel} · {activeInquiry.propertyTitle}
                </div>
                <h2 className="text-lg font-serif-display font-semibold text-[#FCFBF7]">
                  Conversación con {counterpartName}
                </h2>
              </div>
            </div>

            {prop && (
              <button
                type="button"
                onClick={() => onSelectProperty(prop)}
                className="px-3.5 py-1.5 text-xs font-semibold bg-[#B86F52] hover:bg-[#a35e42] text-[#FCFBF7] rounded-sm transition-colors"
              >
                Ver Ficha de la Propiedad
              </button>
            )}
          </div>

          <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-[#F5F1E8]/50 max-h-[460px]">
            {messagesList.map((msg) => {
              const isMine = msg.senderId === currentUser.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-xl p-4 rounded-sm text-sm space-y-1.5 ${
                      isMine
                        ? 'bg-[#39483A] text-[#FCFBF7]'
                        : 'bg-[#FCFBF7] border border-[#D8C7AA] text-[#1F241F]'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-6 text-[11px] ${
                        isMine ? 'text-[#D8C7AA]' : 'text-[#39483A]/70'
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
            className="p-4 bg-[#FCFBF7] border-t border-[#D8C7AA] flex gap-3"
          >
            <input
              type="text"
              value={replyDrafts[activeInquiry.id] || ''}
              onChange={(e) =>
                setReplyDrafts((prev) => ({ ...prev, [activeInquiry.id]: e.target.value }))
              }
              placeholder={`Escribir mensaje a ${counterpartName}...`}
              className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8C7AA] pb-4">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
              Bandeja de Mensajes
            </span>
            <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
              {isManagerView
                ? 'Clientes y Consultas Recibidas'
                : 'Mis Conversaciones con Propietarios y Agentes'}
            </h2>
            <p className="text-xs text-[#39483A]/75 mt-0.5">
              Seleccioná una persona o consulta de la lista para abrir la pantalla completa del chat.
            </p>
          </div>
          <span className="text-xs font-tabular text-[#39483A]/70">
            {threads.length} {threads.length === 1 ? 'conversación' : 'conversaciones'}
          </span>
        </div>

        {threads.length === 0 ? (
          <p className="text-sm text-[#39483A]/70 py-10 text-center">
            No tenés conversaciones activas en este momento.
          </p>
        ) : (
          <div className="divide-y divide-[#D8C7AA] border border-[#D8C7AA] rounded-sm bg-white">
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
                  className="w-full p-5 text-left hover:bg-[#F5F1E8] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center font-serif-display font-semibold text-lg shrink-0">
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
                        <span className="text-base font-semibold text-[#1F241F] group-hover:text-[#39483A]">
                          {personName}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 bg-[#F5F1E8] border border-[#D8C7AA] text-[#39483A] rounded-sm">
                          {personRole}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm border ${
                            inq.status === 'respondida'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                              : 'bg-amber-100 text-amber-900 border-amber-400'
                          }`}
                        >
                          {inq.status === 'respondida' ? 'Respondida' : 'En revisión / Pendiente'}
                        </span>
                        <span className="text-xs text-[#B86F52] font-medium truncate">
                          · {inq.propertyTitle}
                        </span>
                      </div>
                      <p className="text-xs text-[#39483A]/80 line-clamp-1">
                        Último mensaje: “{lastMessage.text}”
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#D8C7AA]/40">
                    <div className="text-right">
                      <div className="text-[11px] font-tabular text-[#39483A]/70">
                        {lastMessage.timestamp}
                      </div>
                      <div className="text-[11px] font-semibold text-[#39483A]">
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

  return (
    <section className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Role Header Banner ("Mi Espacio") with Live Profile Photo */}
      <div className="bg-[#39483A] rounded-sm p-6 sm:p-8 text-[#FCFBF7] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-5">
          <button
            type="button"
            onClick={onOpenProfileModal}
            title="Hacé clic para cambiar tu foto o editar tu perfil"
            className="group relative w-16 h-16 rounded-full overflow-hidden bg-[#F5F1E8] text-[#39483A] border-2 border-[#D8C7AA] flex items-center justify-center shrink-0 cursor-pointer"
          >
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-[#39483A]" />
            )}
            <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8C7AA]">
                Mi Espacio ·{' '}
                {currentUser.role === 'cliente' && canActAsOwner
                  ? 'Cliente y Propietario'
                  : currentUser.role.toUpperCase()}
              </span>
              {onOpenProfileModal && (
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-white/15 hover:bg-white/25 text-[#FCFBF7] rounded-sm transition-colors cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  Editar foto / perfil
                </button>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif-display font-semibold">
              {currentUser.displayName}
            </h1>
            <p className="text-xs sm:text-sm text-[#F5F1E8]/85 max-w-2xl leading-relaxed">
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

        {currentUser.role === 'cliente' && !canActAsOwner && (
          <div className="bg-[#FCFBF7]/10 border border-[#D8C7AA]/30 rounded-sm p-4 max-w-xs space-y-2.5 shrink-0">
            <div className="text-xs font-semibold text-[#D8C7AA]">
              ¿Querés vender o alquilar tu casa?
            </div>
            <p className="text-[11px] text-[#FCFBF7]/85 leading-relaxed">
              Convertite en <strong>Propietario</strong> desde tu misma cuenta sin perder tus funciones de Cliente.
            </p>
            <button
              type="button"
              onClick={onEnableOwnerRole}
              className="w-full py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
            >
              Convertirme en Propietario
            </button>
          </div>
        )}

        {canActAsOwner && (
          <button
            type="button"
            onClick={onOpenNewProperty}
            className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors whitespace-nowrap self-start lg:self-center"
          >
            <Plus className="w-4 h-4" />
            Publicar en Mis propiedades
          </button>
        )}
      </div>

      {/* Role-Specific Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D8C7AA] pb-4">
        {roleNavItems.map((item) => {
          const active = activeSubView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedChatId(null);
                onChangeSubView(item.id);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#39483A] text-[#FCFBF7]'
                  : 'bg-[#F5F1E8] text-[#39483A] border border-[#D8C7AA] hover:bg-[#D8C7AA]/40'
              }`}
            >
              {item.group ? `${item.group}: ${item.label}` : item.label}
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          CLIENTE SCREENS
         ===================================================================== */}
      {activeSubView === 'cliente_favoritos' && canActAsClient && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#D8C7AA] pb-4">
            <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
              Mis Propiedades Favoritas
            </h2>
            <span className="text-xs text-[#39483A]/70 font-tabular">
              {favoriteProperties.length} guardadas
            </span>
          </div>
          {favoriteProperties.length === 0 ? (
            <p className="text-sm text-[#39483A]/70 py-8 text-center">
              Aún no tenés propiedades guardadas en Favoritos.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {favoriteProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="border border-[#D8C7AA] rounded-sm overflow-hidden bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] bg-[#F5F1E8]">
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
                      <div className="text-base font-tabular font-semibold text-[#39483A]">
                        {prop.currency} {prop.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectProperty(prop)}
                      className="flex-1 py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Mis Solicitudes de Visita
          </h2>
          {clientVisits.length === 0 ? (
            <p className="text-sm text-[#39483A]/70 py-8 text-center">
              No tenés visitas solicitadas por el momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D8C7AA] text-xs uppercase tracking-wider text-[#39483A]/70">
                    <th className="py-3 pr-4">Propiedad</th>
                    <th className="py-3 px-4">Fecha y Horario</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Notas</th>
                    <th className="py-3 pl-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8C7AA]/60">
                  {clientVisits.map((v) => (
                    <tr key={v.id}>
                      <td className="py-3.5 pr-4 font-semibold text-[#1F241F]">{v.propertyTitle}</td>
                      <td className="py-3.5 px-4 font-tabular text-xs text-[#39483A]">
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
                      <td className="py-3.5 px-4 text-xs text-[#39483A]/75">{v.notes || '—'}</td>
                      <td className="py-3.5 pl-4 text-right">
                        {v.status !== 'cancelada' && v.status !== 'realizada' && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateVisit(
                                v.id,
                                'cancelada',
                                v.date,
                                v.timeSlot,
                                'Cancelada por el cliente'
                              )
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
                          >
                            Cancelar Visita
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubView === 'cliente_operaciones' && canActAsClient && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Mis Solicitudes de Alquiler / Compra y Contratos
          </h2>
          {clientOperations.length === 0 ? (
            <p className="text-sm text-[#39483A]/70 py-8 text-center">
              No tenés solicitudes de alquiler o compra registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {clientOperations.map((op) => (
                <div
                  key={op.id}
                  className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-[#B86F52] uppercase tracking-wider">
                        Solicitud de {op.operationType}
                      </span>
                      <h3 className="text-lg font-serif-display font-semibold text-[#1F241F]">
                        {op.propertyTitle}
                      </h3>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-base font-semibold font-tabular text-[#39483A] block">
                        {op.currency} {op.offeredAmount.toLocaleString()}
                      </span>
                      <span
                        className={`inline-block text-[11px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getDealStatusBadgeClass(
                          op.status
                        )}`}
                      >
                        Estado: {op.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#39483A]/85">{op.message}</p>
                  {op.contractCode && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-sm text-xs space-y-1">
                      <div className="font-semibold text-emerald-900 font-tabular">
                        Contrato Registrado: {op.contractCode} ({op.contractStartDate} a{' '}
                        {op.contractEndDate})
                      </div>
                      <p className="text-emerald-950/80">{op.contractTerms}</p>
                    </div>
                  )}
                </div>
              ))}
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8C7AA] pb-4">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
                Panel de Propietario
              </span>
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                Mis propiedades
              </h2>
              <p className="text-xs text-[#39483A]/75 mt-0.5">
                Publicá y administrá tus propiedades por tu cuenta o solicitá la asistencia de un agente inmobiliario. Las nuevas publicaciones quedan pendientes de revisión del administrador antes de aparecer públicamente.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewProperty}
              className="flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors whitespace-nowrap self-start"
            >
              <Plus className="w-4 h-4" />
              Publicar Propiedad
            </button>
          </div>

          {myOwnedProperties.length === 0 ? (
            <div className="p-10 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm text-center space-y-3">
              <p className="text-base font-serif-display font-semibold text-[#39483A]">
                Aún no tenés inmuebles publicados en &ldquo;Mis propiedades&rdquo;.
              </p>
              <p className="text-xs text-[#39483A]/80 max-w-md mx-auto">
                Podés publicar una o varias propiedades en venta o alquiler y elegir si deseás administrarlas por tu cuenta o con un agente inmobiliario.
              </p>
              <button
                type="button"
                onClick={onOpenNewProperty}
                className="px-5 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
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

                return (
                  <div
                    key={prop.id}
                    className="p-5 bg-white border border-[#D8C7AA] rounded-sm space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Datos de la propiedad */}
                      <div className="flex items-start gap-4">
                        <img
                          src={resolvePropertyImageUrl(prop.images[0])}
                          alt={prop.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src !== HERO_IMAGE) {
                              e.currentTarget.src = HERO_IMAGE;
                            }
                          }}
                          className="w-24 h-18 rounded-sm object-cover bg-[#F5F1E8] border border-[#D8C7AA] shrink-0"
                        />
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getPublicationStatusBadgeClass(
                                prop.publicationStatus
                              )}`}
                            >
                              {prop.publicationStatus === 'aprobada' && (
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
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
                            <span className="text-xs font-tabular font-semibold text-[#39483A]">
                              {prop.operationType.toUpperCase()} · {prop.currency}{' '}
                              {prop.price.toLocaleString()}
                            </span>
                          </div>
                          <h3 className="text-lg font-serif-display font-semibold text-[#1F241F]">
                            {prop.title}
                          </h3>
                          <div className="text-xs text-[#39483A]/75">
                            {prop.location} · {prop.address} ·{' '}
                            <span className="font-tabular">{prop.surface} m²</span>
                          </div>
                          {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && prop.rejectionReason && (
                            <div className="p-2.5 bg-red-50 border-l-4 border-red-600 text-xs text-red-900 font-medium rounded-r-sm">
                              <strong>Motivo de rechazo:</strong> {prop.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Disponibilidad y Acciones del Propietario */}
                      <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[#39483A]/70 mb-0.5">
                            Disponibilidad
                          </label>
                          <select
                            value={prop.availability}
                            onChange={(e) =>
                              onUpdateAvailability(prop.id, e.target.value as AvailabilityStatus)
                            }
                            className="px-2.5 py-1.5 text-xs bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm"
                          >
                            <option value="disponible">Disponible</option>
                            <option value="reservada">Reservada</option>
                            <option value="alquilada">Alquilada</option>
                            <option value="vendida">Vendida</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 pt-4">
                          <button
                            type="button"
                            onClick={() => onSelectProperty(prop)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#39483A] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8] inline-flex items-center gap-1"
                            title="Ver ficha"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditProperty(prop)}
                            className="px-3 py-1.5 text-xs font-semibold text-[#39483A] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8] inline-flex items-center gap-1"
                            title="Editar propiedad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProperty(prop.id)}
                            className="p-1.5 text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
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
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : 'bg-[#F5F1E8] border-[#D8C7AA]'
                      }`}
                    >
                      {status === 'sin_agente' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-[#39483A] flex items-center gap-1.5">
                              <span>
                                Modalidad actual: Propietario Independiente (Gestión por mi cuenta)
                              </span>
                            </div>
                            <p className="text-[11px] text-[#39483A]/80">
                              Recibís y respondés directamente las consultas, visitas y ofertas de esta propiedad.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAgentSelectorPropId(isChoosingAgentHere ? null : prop.id)
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors inline-flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Elegir un agente
                            </button>
                            <button
                              type="button"
                              onClick={() => onOwnerRequestAgent(prop.id, 'asignacion_admin')}
                              className="px-3 py-1.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] hover:bg-[#FCFBF7] rounded-sm transition-colors inline-flex items-center gap-1.5"
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
                                className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                              >
                                Elegir otro agente
                              </button>
                              <button
                                type="button"
                                onClick={() => onOwnerRequestAgent(prop.id, 'asignacion_admin')}
                                className="px-3 py-1.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
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
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0">
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
                              <div className="text-xs font-semibold text-emerald-950 flex flex-wrap items-center gap-2">
                                <span>Agente Inmobiliario Asignado: {prop.agentName}</span>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-400 rounded-sm">
                                  Asignación Confirmada
                                </span>
                              </div>
                              <div className="text-xs text-emerald-900">
                                {assignedAgentProfile?.agencyName || 'Corredor Inmobiliario Matriculado'}
                              </div>
                              <div className="text-[11px] font-tabular text-emerald-900/80">
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
                              className="px-3 py-1.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
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
                        <div className="pt-3 border-t border-[#D8C7AA] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#39483A]">
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
                                className="p-3.5 bg-white border border-[#D8C7AA] rounded-sm flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0">
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
                                    <div className="text-[11px] font-tabular text-[#39483A]/80">
                                      {ag.email} · {ag.phone}
                                    </div>
                                    {ag.bio && (
                                      <p className="text-[11px] text-[#39483A]/75 line-clamp-2">
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
                                  className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm shrink-0"
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
                        className="w-16 h-12 rounded-sm object-cover bg-[#D8C7AA] shrink-0"
                      />
                      <div className="space-y-0.5">
                        <div className="text-xs text-amber-800 font-semibold">
                          Propietario solicitante: {prop.ownerName}
                        </div>
                        <div className="text-sm font-semibold text-[#1F241F]">{prop.title}</div>
                        <div className="text-xs font-tabular text-[#39483A]">
                          {prop.location} · {prop.operationType.toUpperCase()} {prop.currency}{' '}
                          {prop.price.toLocaleString()} ({prop.surface} m²)
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAgentRespondAssignment(prop.id, true)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm inline-flex items-center gap-1.5"
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
                        className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
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
          <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-5">
            <div className="border-b border-[#D8C7AA] pb-4">
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                Propiedades Confirmadas a Mi Cargo ({myAssignedProperties.length})
              </h2>
              <p className="text-xs text-[#39483A]/75 mt-0.5">
                Aquí aparecen únicamente los inmuebles donde estás asignado formalmente como agente responsable. No podés modificar publicaciones de otros agentes ni propiedades sin asignación confirmada.
              </p>
            </div>

            {myAssignedProperties.length === 0 ? (
              <p className="text-sm text-[#39483A]/70 py-8 text-center">
                Actualmente no tenés propiedades asignadas a tu cargo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#D8C7AA] text-xs uppercase tracking-wider text-[#39483A]/70">
                      <th className="py-3 pr-4">Inmueble</th>
                      <th className="py-3 px-3">Propietario</th>
                      <th className="py-3 px-3">Operación / Valor</th>
                      <th className="py-3 px-3">Publicación</th>
                      <th className="py-3 px-3">Disponibilidad</th>
                      <th className="py-3 pl-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8C7AA]/60">
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
                              className="w-14 h-10 rounded-sm object-cover bg-[#F5F1E8] shrink-0"
                            />
                            <div>
                              <div className="font-semibold text-[#1F241F]">{prop.title}</div>
                              <div className="text-xs text-[#39483A]/70">
                                {prop.location} · <span className="font-tabular">{prop.surface} m²</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-xs text-[#39483A]">
                          <strong className="text-[#1F241F]">{prop.ownerName}</strong>
                        </td>
                        <td className="py-3.5 px-3 font-tabular text-xs">
                          <span className="uppercase text-[#B86F52] font-semibold block">
                            {prop.operationType}
                          </span>
                          <span className="font-semibold text-[#39483A]">
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
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
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
                              className="px-2.5 py-1.5 text-xs font-semibold text-[#39483A] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8] inline-flex items-center gap-1"
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

      {(activeSubView === 'propietario_visitas' || activeSubView === 'agente_visitas') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            {activeSubView === 'propietario_visitas'
              ? 'Visitas Solicitadas a Mis Propiedades'
              : 'Agenda de Visitas de Propiedades a Mi Cargo'}
          </h2>
          {(activeSubView === 'propietario_visitas' ? ownerVisits : agentVisits).length === 0 ? (
            <p className="text-sm text-[#39483A]/70 py-8 text-center">
              No hay visitas registradas en esta sección.
            </p>
          ) : (
            <div className="space-y-3">
              {(activeSubView === 'propietario_visitas' ? ownerVisits : agentVisits).map((v) => (
                <div
                  key={v.id}
                  className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#39483A]/80">
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
                    <div className="text-xs font-tabular text-[#39483A]">
                      Fecha solicitada: {v.date} · Horario: {v.timeSlot}
                    </div>
                    {v.notes && <div className="text-xs text-[#39483A]/75">Nota: {v.notes}</div>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateVisit(v.id, 'confirmada', v.date, v.timeSlot, v.notes)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-sm hover:bg-emerald-800"
                    >
                      Confirmar Visita
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateVisit(v.id, 'rechazada', v.date, v.timeSlot, v.notes)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
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
                        className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                      />
                      <input
                        type="text"
                        value={rescheduleSlots[v.id] || v.timeSlot}
                        onChange={(e) =>
                          setRescheduleSlots((prev) => ({ ...prev, [v.id]: e.target.value }))
                        }
                        placeholder="Nuevo horario"
                        className="w-28 px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateVisit(
                            v.id,
                            'reprogramada',
                            rescheduleDates[v.id] || v.date,
                            rescheduleSlots[v.id] || v.timeSlot,
                            'Horario reprogramado por el responsable'
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-400 rounded-sm hover:bg-amber-200"
                      >
                        Reprogramar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubView === 'propietario_consultas' &&
        canActAsOwner &&
        renderChatSection(ownerInquiries, true)}

      {activeSubView === 'agente_consultas' &&
        currentUser.role === 'agente' &&
        renderChatSection(agentInquiries, true)}

      {(activeSubView === 'propietario_operaciones' || activeSubView === 'agente_operaciones') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            {activeSubView === 'propietario_operaciones'
              ? 'Ofertas y Contratos en Mis Propiedades'
              : 'Operaciones y Contratos de Propiedades a Mi Cargo'}
          </h2>
          {(activeSubView === 'propietario_operaciones' ? ownerOperations : agentOperations)
            .length === 0 ? (
            <p className="text-sm text-[#39483A]/70 py-8 text-center">
              No hay solicitudes de operación registradas para estas propiedades.
            </p>
          ) : (
            <div className="space-y-4">
              {(activeSubView === 'propietario_operaciones'
                ? ownerOperations
                : agentOperations
              ).map((op) => {
                const draft = contractDrafts[op.id] || {
                  code: op.contractCode || `CH-2026-${op.id.slice(-3).toUpperCase()}`,
                  terms:
                    op.contractTerms ||
                    `Contrato de ${op.operationType} por ${op.currency} ${op.offeredAmount.toLocaleString()}.`,
                  start: op.contractStartDate || '2026-11-01',
                  end: op.contractEndDate || '2028-10-31',
                };
                return (
                  <div
                    key={op.id}
                    className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-[#B86F52] uppercase tracking-wider">
                          {op.operationType} · Solicitante: {op.clientName}
                        </span>
                        <h3 className="text-lg font-serif-display font-semibold text-[#1F241F]">
                          {op.propertyTitle}
                        </h3>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="text-base font-semibold font-tabular text-[#39483A] block">
                          {op.currency} {op.offeredAmount.toLocaleString()}
                        </span>
                        <span
                          className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getDealStatusBadgeClass(
                            op.status
                          )}`}
                        >
                          Estado actual: {op.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-[#39483A]/85">{op.message}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-[#D8C7AA]">
                      <input
                        type="text"
                        value={draft.code}
                        onChange={(e) =>
                          setContractDrafts((prev) => ({
                            ...prev,
                            [op.id]: { ...draft, code: e.target.value },
                          }))
                        }
                        placeholder="Código de contrato"
                        className="px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                      />
                      <input
                        type="date"
                        value={draft.start}
                        onChange={(e) =>
                          setContractDrafts((prev) => ({
                            ...prev,
                            [op.id]: { ...draft, start: e.target.value },
                          }))
                        }
                        className="px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                      />
                      <input
                        type="date"
                        value={draft.end}
                        onChange={(e) =>
                          setContractDrafts((prev) => ({
                            ...prev,
                            [op.id]: { ...draft, end: e.target.value },
                          }))
                        }
                        className="px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                      />
                      <input
                        type="text"
                        value={draft.terms}
                        onChange={(e) =>
                          setContractDrafts((prev) => ({
                            ...prev,
                            [op.id]: { ...draft, terms: e.target.value },
                          }))
                        }
                        placeholder="Términos del contrato"
                        className="px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateOperation(op.id, 'aprobada')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100 border border-emerald-400 rounded-sm hover:bg-emerald-200"
                      >
                        Aceptar Solicitud
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateOperation(op.id, 'concretada', {
                            contractCode: draft.code,
                            contractTerms: draft.terms,
                            contractStartDate: draft.start,
                            contractEndDate: draft.end,
                          })
                        }
                        className="px-3.5 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                      >
                        Concretar Operación y Registrar Contrato
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateOperation(op.id, 'rechazada')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
                      >
                        Rechazar
                      </button>
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#D8C7AA] pb-4">
            <div>
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                Reportes y Métricas de la Plataforma
              </h2>
              <p className="text-xs text-[#39483A]/75 mt-0.5">
                Datos calculados en tiempo real directamente desde Firestore a partir de las publicaciones, usuarios y operaciones registradas.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#39483A]/10 text-[#39483A] rounded-sm self-start md:self-center">
              Supervisión Administrativa
            </span>
          </div>

          {/* Métricas Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total de Inmuebles */}
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#39483A]/75">
                Total de Inmuebles
              </div>
              <div className="text-3xl font-bold font-tabular text-[#1F241F]">
                {allProperties.length}
              </div>
              <div className="text-xs text-[#39483A]/70 flex flex-wrap gap-2 pt-1">
                <span className="text-emerald-800 font-semibold">
                  {allProperties.filter((p) => p.publicationStatus === 'aprobada').length} activas
                </span>
                <span>·</span>
                <span className="text-amber-800 font-semibold">
                  {allProperties.filter((p) => p.publicationStatus === 'pendiente').length} pend.
                </span>
                <span>·</span>
                <span className="text-rose-800 font-semibold">
                  {allProperties.filter((p) => p.publicationStatus === 'rechazada').length} rech.
                </span>
              </div>
            </div>

            {/* 2. Inmuebles Aprobados */}
            <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-900">
                Inmuebles Aprobados
              </div>
              <div className="text-3xl font-bold font-tabular text-emerald-900">
                {allProperties.filter((p) => p.publicationStatus === 'aprobada').length}
              </div>
              <div className="text-xs text-emerald-800">
                Publicaciones validadas y visibles en el catálogo general.
              </div>
            </div>

            {/* 3. Inmuebles Rechazados */}
            <div className="p-5 bg-rose-50 border border-rose-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-rose-900">
                Inmuebles Rechazados
              </div>
              <div className="text-3xl font-bold font-tabular text-rose-900">
                {allProperties.filter((p) => p.publicationStatus === 'rechazada').length}
              </div>
              <div className="text-xs text-rose-800">
                Devueltos con motivo de rechazo para corrección del propietario/agente.
              </div>
            </div>

            {/* 4. Solicitudes Pendientes Admin */}
            <div className="p-5 bg-amber-50 border border-amber-300 rounded-sm space-y-2">
              <div className="text-xs uppercase tracking-wider font-semibold text-amber-900">
                Pendientes de Moderación
              </div>
              <div className="text-3xl font-bold font-tabular text-amber-900">
                {adminPendingActionProperties.length}
              </div>
              <div className="text-xs text-amber-800">
                Publicaciones en revisión o asignaciones que requieren tu acción.
              </div>
            </div>
          </div>

          {/* Segunda Fila: Usuarios, Transacciones y Reclamos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Usuarios y Roles */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#39483A]">
                  Usuarios Registrados
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {uniqueUsers.length}
                </span>
              </div>
            <div className="space-y-1.5 text-xs text-[#39483A]/85 border-t border-[#D8C7AA]/60 pt-2">
  <div className="flex justify-between">
    {/* Suma clientes y propietarios sin duplicar */}
    <span>Clientes y Propietarios:</span>
    <strong className="font-tabular">
      {uniqueUsers.filter((u) => u.role === 'cliente' || u.role === 'propietario' || u.isAlsoOwner).length}
    </strong>
  </div>

  <div className="flex justify-between">
    <span>Agentes Inmobiliarios:</span>
    <strong className="font-tabular">{uniqueUsers.filter((u) => u.role === 'agente').length}</strong>
  </div>

  <div className="flex justify-between">
    <span>Administradores:</span>
    <strong className="font-tabular">{uniqueUsers.filter((u) => u.role === 'administrador').length}</strong>
  </div>
</div>
            </div>

            {/* Operaciones y Contratos Reales */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#39483A]">
                  Operaciones y Contratos
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {allOperations.length}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#39483A]/85 border-t border-[#D8C7AA]/60 pt-2">
                <div className="flex justify-between">
                  <span>Concretadas / Cerradas:</span>
                  <strong className="font-tabular text-emerald-800">
                    {allOperations.filter((o) => o.status === 'concretada').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Aprobadas (en proceso):</span>
                  <strong className="font-tabular text-amber-800">
                    {allOperations.filter((o) => o.status === 'aprobada').length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Monto transaccionado (cerradas):</span>
                  <strong className="font-tabular text-[#39483A]">
                    USD {allOperations.filter((o) => o.status === 'concretada').reduce((acc, o) => acc + (Number(o.offeredAmount) || 0), 0).toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px] text-[#39483A]/60 pt-1">
                  <span>Valor total cartera venta activa:</span>
                  <strong className="font-tabular">
                    USD {allProperties.filter((p) => p.publicationStatus === 'aprobada' && p.operationType === 'venta').reduce((acc, p) => acc + (Number(p.price) || 0), 0).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Reclamos y Soporte */}
            <div className="p-5 bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#39483A]">
                  Centro de Reclamos
                </span>
                <span className="text-lg font-bold font-tabular text-[#1F241F]">
                  {claims.length}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-[#39483A]/85 border-t border-[#D8C7AA]/60 pt-2">
                <div className="flex justify-between">
                  <span>Pendientes por responder:</span>
                  <strong className="font-tabular text-amber-800">
                    {adminPendingClaims.length}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Reclamos resueltos:</span>
                  <strong className="font-tabular text-emerald-800">
                    {adminRespondedClaims.length}
                  </strong>
                </div>
                <p className="text-[11px] text-[#39483A]/65 pt-2">
                  Podés resolver o dictaminar sobre reclamos desde la pestaña &quot;Gestión de Reclamos&quot;.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODERACIÓN Y SOLICITUDES DEL ADMINISTRADOR CON FILTROS
          (Pendientes sin acción vs Ya Respondidas)
         ===================================================================== */}
      {activeSubView === 'admin_publicaciones' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D8C7AA] pb-4">
            <div>
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                Moderación de Publicaciones y Solicitudes de Agente
              </h2>
              <p className="text-xs text-[#39483A]/75 mt-0.5">
                Las solicitudes que apruebes o rechaces pasan automáticamente a la pestaña de{' '}
                <strong>Ya Respondidas / Gestionadas</strong> para mantener limpio tu panel principal.
              </p>
            </div>

            {/* Filtro de solicitudes del Administrador */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAdminModerationFilter('pendientes')}
                className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center gap-2 cursor-pointer ${
                  adminModerationFilter === 'pendientes'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Pendientes de Acción ({adminPendingActionProperties.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminModerationFilter('respondidas')}
                className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center gap-2 cursor-pointer ${
                  adminModerationFilter === 'respondidas'
                    ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A] shadow-xs'
                    : 'bg-[#F5F1E8] text-[#39483A] border-[#D8C7AA] hover:bg-[#D8C7AA]/40'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ya Respondidas / Historial ({adminRespondedProperties.length})
              </button>
            </div>
          </div>

          {adminModerationFilter === 'pendientes' ? (
            adminPendingActionProperties.length === 0 ? (
              <div className="p-10 bg-emerald-50 border border-emerald-300 rounded-sm text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                <div className="text-base font-serif-display font-semibold text-emerald-950">
                  ¡Todo al día! No hay solicitudes pendientes por revisar
                </div>
                <p className="text-xs text-emerald-900/80 max-w-md mx-auto">
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
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <img
                            src={resolvePropertyImageUrl(prop.images[0])}
                            alt={prop.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (e.currentTarget.src !== HERO_IMAGE) {
                                e.currentTarget.src = HERO_IMAGE;
                              }
                            }}
                            className="w-20 h-15 rounded-sm object-cover bg-[#D8C7AA] shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
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
                              <span className="text-[#39483A]">
                                Titular: <strong>{prop.ownerName}</strong> · {prop.location}
                              </span>
                            </div>
                            <div className="text-base font-semibold text-[#1F241F]">
                              {prop.title}
                            </div>
                            <div className="text-xs font-tabular font-semibold text-[#39483A]">
                              {prop.operationType.toUpperCase()} — {prop.currency}{' '}
                              {prop.price.toLocaleString()} ({prop.surface} m²)
                            </div>
                          </div>
                        </div>

                        {/* Botones de aprobación/rechazo de publicación si está pendiente */}
                        {isPubPending ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onModerateProperty(prop.id, 'aprobada')}
                              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-sm hover:bg-emerald-800 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aprobar Publicación
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectProperty(prop)}
                              className="px-3 py-2 text-xs font-bold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Revisar ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPropertyToReject(prop);
                                setRejectionReasonDraft('');
                              }}
                              className="px-3.5 py-2 text-xs font-bold text-white bg-red-600 rounded-sm hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Rechazar
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProperty(prop.id)}
                              className="px-3 py-2 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-sm cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-sm">
                              Publicación ya revisada ({prop.publicationStatus.toUpperCase()})
                            </div>
                            <button
                              type="button"
                              onClick={() => onDeleteProperty(prop.id)}
                              className="px-3 py-2 text-xs font-bold text-red-700 bg-white border border-red-300 rounded-sm cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Solicitud de Agente en esta propiedad */}
                      <div className="pt-3 border-t border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          {status === 'sin_agente' && (
                            <span className="text-[#39483A]">
                              Modalidad elegida por propietario:{' '}
                              <strong>Propietario independiente (No solicitó agente)</strong>
                            </span>
                          )}
                          {status === 'pendiente_admin' && (
                            <span className="text-amber-950 font-bold">
                              ⚠️ Acción requerida: El propietario pidió que el Administrador le asigne un agente inmobiliario
                            </span>
                          )}
                          {status === 'pendiente_agente' && (
                            <span className="text-amber-950 font-bold">
                              ⚠️ Acción requerida: El propietario eligió a{' '}
                              <u>{prop.requestedAgentName || 'un agente'}</u> (podés confirmar la asignación aquí)
                            </span>
                          )}
                          {status === 'asignado' && (
                            <span className="text-emerald-900 font-semibold">
                              ✓ Agente confirmado a cargo: {prop.agentName}
                            </span>
                          )}
                        </div>

                        {isAgentPending && (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={selectedAgentUid}
                              onChange={(e) =>
                                setAdminSelectedAgentByProp((prev) => ({
                                  ...prev,
                                  [prop.id]: e.target.value,
                                }))
                              }
                              className="px-2.5 py-1.5 text-xs bg-white border border-amber-400 rounded-sm"
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
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm disabled:opacity-50 cursor-pointer"
                            >
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
                <p className="text-sm text-[#39483A]/70 py-8 text-center">
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
                      className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
                            className="w-16 h-12 rounded-sm object-cover bg-[#D8C7AA] shrink-0"
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
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
                              <span className="text-[#39483A]/80">
                                Titular: <strong>{prop.ownerName}</strong> · {prop.location}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-[#1F241F]">{prop.title}</div>
                            <div className="text-xs font-tabular font-semibold text-[#39483A]">
                              {prop.operationType.toUpperCase()} — {prop.currency}{' '}
                              {prop.price.toLocaleString()} ({prop.surface} m²)
                            </div>
                            {(prop.publicationStatus === 'rechazada' || prop.publicationStatus === 'suspendida') && prop.rejectionReason && (
                              <div className="text-xs text-red-700 font-medium">
                                Motivo de rechazo registrado: “{prop.rejectionReason}”
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {prop.publicationStatus !== 'aprobada' && (
                            <button
                              type="button"
                              onClick={() => onModerateProperty(prop.id, 'aprobada')}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100 border border-emerald-400 rounded-sm hover:bg-emerald-200"
                            >
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
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100"
                            >
                              Cambiar a Rechazada
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteProperty(prop.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-sm hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#D8C7AA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          {status === 'sin_agente' && (
                            <span className="text-[#39483A]/80">
                              Modalidad: <strong>Propietario independiente (Sin agente)</strong>
                            </span>
                          )}
                          {status === 'rechazado' && (
                            <span className="text-red-700 font-semibold">
                              El agente anterior rechazó la solicitud. Podés asignarle otro agente:
                            </span>
                          )}
                          {status === 'asignado' && (
                            <span className="text-emerald-900 font-semibold">
                              ✓ Agente confirmado a cargo: <strong>{prop.agentName}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={selectedAgentUid}
                            onChange={(e) =>
                              setAdminSelectedAgentByProp((prev) => ({
                                ...prev,
                                [prop.id]: e.target.value,
                              }))
                            }
                            className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
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
                            className="px-3 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm disabled:opacity-50"
                          >
                            Reasignar Agente
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
              Administración de Usuarios, Roles y Estado de Cuentas
            </h2>
            <p className="text-xs text-[#39483A]/75 mt-0.5">
              Cualquier usuario registrado ingresa como Cliente (pudiendo habilitar funciones de Propietario). Desde aquí podés cambiar el rol de un usuario a Agente Inmobiliario.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D8C7AA] text-xs uppercase tracking-wider text-[#39483A]/70">
                  <th className="py-3 pr-4">Nombre</th>
                  <th className="py-3 px-4">Correo / Teléfono</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 pl-4 text-right">Estado de Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C7AA]/60">
                {uniqueUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1F241F]">{u.displayName}</div>
                          <div className="text-xs text-[#39483A]/70">
                            {u.agencyName || (u.isAlsoOwner ? 'Cliente y Propietario' : 'Particular')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-tabular text-[#39483A]">
                      <div>{u.email}</div>
                      <div className="text-[#39483A]/70">{u.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          onUpdateUserAdmin(u.uid, e.target.value as UserRole, u.active)
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm capitalize"
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
                            ? 'text-emerald-900 border-emerald-400 bg-emerald-100'
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
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Gestión de Tipos de Inmueble y Características
          </h2>
          <form onSubmit={handleAddCategorySubmit} className="flex flex-wrap gap-2.5">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nombre de nuevo tipo o característica (ej. Quincho cubierto)..."
              className="flex-1 min-w-[220px] px-3.5 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
            />
            <select
              value={newCatKind}
              onChange={(e) => setNewCatKind(e.target.value as 'tipo_inmueble' | 'caracteristica')}
              className="px-3.5 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
            >
              <option value="caracteristica">Característica / Comodidad</option>
              <option value="tipo_inmueble">Tipo de Inmueble</option>
            </select>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
            >
              + Agregar al Catálogo
            </button>
          </form>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-[#1F241F]">{cat.name}</div>
                  <div className="text-[11px] text-[#39483A]/70">
                    {cat.kind === 'tipo_inmueble' ? 'Tipo inmueble' : 'Característica'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleCategory(cat.id, !cat.active)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-sm border ${
                    cat.active
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
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
          CLAIMS / RECLAMOS (Admin & User views, con filtro para Admin)
         ===================================================================== */}
      {(activeSubView === 'admin_reclamos' || activeSubView === 'reclamos_usuario') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8C7AA] pb-4">
            <div>
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                Centro de Reclamos y Soporte
              </h2>
              {currentUser.role === 'administrador' && (
                <p className="text-xs text-[#39483A]/75 mt-0.5">
                  Filtrá entre los reclamos pendientes de resolución y aquellos ya respondidos.
                </p>
              )}
            </div>

            {currentUser.role === 'administrador' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdminClaimFilter('pendientes')}
                  className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    adminClaimFilter === 'pendientes'
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pendientes de Respuesta ({adminPendingClaims.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminClaimFilter('respondidos')}
                  className={`px-4 py-2 text-xs font-bold rounded-sm border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    adminClaimFilter === 'respondidos'
                      ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                      : 'bg-[#F5F1E8] text-[#39483A] border-[#D8C7AA] hover:bg-[#D8C7AA]/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ya Respondidos ({adminRespondedClaims.length})
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {currentUser.role !== 'administrador' && (
              <form
                onSubmit={handleClaimSubmit}
                className="lg:col-span-5 space-y-3 bg-[#F5F1E8] p-5 rounded-sm border border-[#D8C7AA]"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-[#39483A]">
                  Enviar Nuevo Reclamo
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#39483A] mb-1">
                    Categoría del reclamo
                  </label>
                  <select
                    value={claimTargetType}
                    onChange={(e) => setClaimTargetType(e.target.value as ClaimTargetType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                  >
                    <option value="publicacion">Sobre una Publicación de inmueble</option>
                    <option value="visita">Sobre una Visita programada</option>
                    <option value="operacion">Sobre una Oferta / Contrato</option>
                    <option value="usuario">Atención al Usuario / General</option>
                  </select>
                </div>
                <input
                  type="text"
                  required
                  value={claimSubject}
                  onChange={(e) => setClaimSubject(e.target.value)}
                  placeholder="Asunto del reclamo..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                />
                <textarea
                  rows={3}
                  required
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  placeholder="Describí detalladamente el inconveniente..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                >
                  Enviar Reclamo
                </button>
              </form>
            )}

            <div
              className={`${
                currentUser.role === 'administrador' ? 'lg:col-span-12' : 'lg:col-span-7'
              } space-y-3`}
            >
              {(currentUser.role === 'administrador'
                ? adminClaimFilter === 'pendientes'
                  ? adminPendingClaims
                  : adminRespondedClaims
                : claims
              ).length === 0 ? (
                <p className="text-sm text-[#39483A]/70 py-8 text-center">
                  {currentUser.role === 'administrador'
                    ? adminClaimFilter === 'pendientes'
                      ? 'No hay reclamos pendientes por responder.'
                      : 'Aún no hay reclamos respondidos en el historial.'
                    : 'No tenés reclamos registrados.'}
                </p>
              ) : (
                (currentUser.role === 'administrador'
                  ? adminClaimFilter === 'pendientes'
                    ? adminPendingClaims
                    : adminRespondedClaims
                  : claims
                ).map((clm) => (
                  <div
                    key={clm.id}
                    className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#39483A]/75">
                      <span>
                        Reportado por <strong className="text-[#1F241F]">{clm.reporterName}</strong> ·
                        Categoría: <span className="uppercase font-semibold">{clm.targetType}</span>
                      </span>
                      <span
                        className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-sm border ${getClaimStatusBadgeClass(
                          clm.status
                        )}`}
                      >
                        {clm.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#1F241F]">{clm.subject}</div>
                    <p className="text-xs text-[#39483A]/85">{clm.description}</p>
                    {clm.adminResolution && (
                      <p className="text-xs text-emerald-950 bg-emerald-50 border border-emerald-300 p-2.5 rounded-sm">
                        <strong>Resolución Administración:</strong> {clm.adminResolution}
                      </p>
                    )}
                    {currentUser.role === 'administrador' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <input
                          type="text"
                          value={claimResolutionDrafts[clm.id] ?? clm.adminResolution}
                          onChange={(e) =>
                            setClaimResolutionDrafts((prev) => ({
                              ...prev,
                              [clm.id]: e.target.value,
                            }))
                          }
                          placeholder="Dictamen o resolución administrativa..."
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onResolveClaim(
                              clm.id,
                              'resuelto',
                              claimResolutionDrafts[clm.id] ||
                                'Reclamo verificado y resuelto por Administración.'
                            )
                          }
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 rounded-sm hover:bg-emerald-800 cursor-pointer"
                        >
                          Resolver Reclamo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onResolveClaim(
                              clm.id,
                              'desestimado',
                              claimResolutionDrafts[clm.id] ||
                                'Reclamo desestimado tras revisión administrativa.'
                            )
                          }
                          className="px-3.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 cursor-pointer"
                        >
                          Desestimar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
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
            className="w-full max-w-lg space-y-5 rounded-sm border border-[#D8C7AA] bg-[#FCFBF7] p-6 shadow-2xl"
          >
            <div>
              <h2 id="reject-property-title" className="text-xl font-serif-display font-semibold text-[#1F241F]">
                Rechazar publicación
              </h2>
              <p className="mt-1 text-sm text-[#39483A]/80">
                {propertyToReject.title}: explicá qué debe corregir el propietario o agente.
              </p>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold text-[#39483A]">
              <span>Motivo de rechazo <span className="text-red-700">(obligatorio)</span></span>
              <textarea
                autoFocus
                required
                maxLength={400}
                rows={4}
                value={rejectionReasonDraft}
                onChange={(event) => setRejectionReasonDraft(event.target.value)}
                placeholder="Indicá el problema y cómo corregirlo"
                className="w-full resize-y rounded-sm border border-[#D8C7AA] bg-white px-3 py-2 text-sm font-normal text-[#1F241F] outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPropertyToReject(null);
                  setRejectionReasonDraft('');
                }}
                className="rounded-sm border border-[#D8C7AA] bg-white px-4 py-2 text-sm font-semibold text-[#39483A] hover:bg-[#F5F1E8]"
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
    </section>
  );
};
