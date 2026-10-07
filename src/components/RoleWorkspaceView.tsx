import React, { useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Eye,
  Send,
  ArrowLeft,
  ChevronRight,
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
import { HERO_IMAGE, resolvePropertyImageUrl } from '../data/initialData';

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
  properties: PropertyItem[];
  favoriteIds: string[];
  visits: VisitItem[];
  inquiries: InquiryItem[];
  operations: OperationItem[];
  claims: ClaimItem[];
  categories: CategoryConfigItem[];
  onEnableOwnerRole: () => Promise<void>;
  onOpenNewProperty: () => void;
  onOpenEditProperty: (property: PropertyItem) => void;
  onSelectProperty: (property: PropertyItem) => void;
  onDeleteProperty: (propertyId: string) => Promise<void>;
  onUpdateAvailability: (propertyId: string, availability: AvailabilityStatus) => Promise<void>;
  onAssignAgent: (propertyId: string, agentId: string, agentName: string) => Promise<void>;
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

export const RoleWorkspaceView: React.FC<RoleWorkspaceViewProps> = ({
  currentUser,
  activeSubView,
  onChangeSubView,
  users,
  properties,
  favoriteIds,
  visits,
  inquiries,
  operations,
  claims,
  categories,
  onEnableOwnerRole,
  onOpenNewProperty,
  onOpenEditProperty,
  onSelectProperty,
  onDeleteProperty,
  onUpdateAvailability,
  onAssignAgent,
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
  // Selected chat conversation ID (null = show list of people/conversations; string = show full chat screen)
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [rescheduleDates, setRescheduleDates] = useState<Record<string, string>>({});
  const [rescheduleSlots, setRescheduleSlots] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [contractDrafts, setContractDrafts] = useState<
    Record<string, { code: string; terms: string; start: string; end: string }>
  >({});

  const [claimTargetType, setClaimTargetType] = useState<ClaimTargetType>('publicacion');
  const [claimRef, setClaimRef] = useState('');
  const [claimSubject, setClaimSubject] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimResolutionDrafts, setClaimResolutionDrafts] = useState<Record<string, string>>({});

  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'tipo_inmueble' | 'caracteristica'>('caracteristica');

  const agentsList = users.filter((u) => u.role === 'agente' && u.active);
  const favoriteProperties = properties.filter((p) => favoriteIds.includes(p.id));
  const pendingProperties = properties.filter((p) => p.publicationStatus === 'pendiente');

  const myOwnedProperties = properties.filter(
    (p) => p.ownerId === currentUser.uid || currentUser.uid === 'usr_propietario_demo'
  );
  const myAssignedProperties = properties.filter(
    (p) => p.agentId === currentUser.uid || currentUser.uid === 'usr_agente_demo'
  );

  const canActAsClient = currentUser.role === 'cliente' || currentUser.role === 'propietario';
  const canActAsOwner =
    currentUser.role === 'propietario' ||
    (currentUser.role === 'cliente' && Boolean(currentUser.isAlsoOwner));

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimSubject.trim() || !claimDesc.trim()) return;
    await onCreateClaim(
      claimTargetType,
      truncateText(claimRef || 'General', 140),
      truncateText(claimSubject, SCHEMA_LIMITS.CLAIM_SUBJECT_MAX),
      truncateText(claimDesc, SCHEMA_LIMITS.CLAIM_DESC_MAX)
    );
    setClaimRef('');
    setClaimSubject('');
    setClaimDesc('');
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onAddCategory(truncateText(newCatName, 80), newCatKind);
    setNewCatName('');
  };

  const totalSalesVolume = operations
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
      { id: 'propietario_inmuebles', label: 'Mis Propiedades Publicadas', group: 'Propietario' },
      { id: 'propietario_visitas', label: 'Visitas Recibidas', group: 'Propietario' },
      { id: 'propietario_operaciones', label: 'Ofertas y Contratos', group: 'Propietario' },
      { id: 'propietario_consultas', label: 'Chat con Interesados', group: 'Propietario' }
    );
  }

  if (currentUser.role === 'agente') {
    roleNavItems.push(
      { id: 'agente_cartera', label: 'Propiedades Asignadas' },
      { id: 'agente_visitas', label: 'Agenda de Visitas' },
      { id: 'agente_consultas', label: 'Chat con Clientes' },
      { id: 'agente_operaciones', label: 'Operaciones y Contratos' }
    );
  }

  if (currentUser.role === 'administrador') {
    roleNavItems.push(
      { id: 'admin_dashboard', label: 'Reportes y Métricas' },
      { id: 'admin_publicaciones', label: `Aprobación de Publicaciones (${pendingProperties.length})` },
      { id: 'admin_usuarios', label: 'Usuarios y Roles' },
      { id: 'admin_categorias', label: 'Categorías y Características' },
      { id: 'admin_reclamos', label: 'Gestión de Reclamos' }
    );
  } else {
    roleNavItems.push({ id: 'reclamos_usuario', label: 'Mis Reclamos / Soporte' });
  }

  /**
   * Renders the new Clean Inbox -> Full Screen Chat View:
   * - When `selectedChatId` is null: displays a clean list of people/conversations.
   * - When a person/conversation is clicked: opens the dedicated Full Chat Screen for that conversation.
   */
  const renderChatSection = (threads: InquiryItem[], isManagerView: boolean) => {
    const activeInquiry = selectedChatId
      ? threads.find((t) => t.id === selectedChatId) || null
      : null;

    // 1. FULL SCREEN INDIVIDUAL CHAT VIEW
    if (activeInquiry) {
      const prop = properties.find((p) => p.id === activeInquiry.propertyId);
      const counterpartName = isManagerView
        ? activeInquiry.clientName
        : activeInquiry.agentName ||
          activeInquiry.ownerName ||
          prop?.agentName ||
          prop?.ownerName ||
          'Responsable Inmobiliario';
      const counterpartRoleLabel = isManagerView ? 'Cliente interesado' : 'Propietario / Agente';

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
          {/* Full Chat Top Header */}
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

          {/* Messages Body */}
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

          {/* Bottom Message Input Bar */}
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

    // 2. CLEAN LIST OF PEOPLE / CONVERSATIONS
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
              const prop = properties.find((p) => p.id === inq.propertyId);
              const personName = isManagerView
                ? inq.clientName
                : inq.agentName ||
                  inq.ownerName ||
                  prop?.agentName ||
                  prop?.ownerName ||
                  'Responsable';
              const personRole = isManagerView ? 'Cliente' : 'Propietario / Agente';
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
                    <div className="w-11 h-11 rounded-sm bg-[#39483A] text-[#FCFBF7] flex items-center justify-center font-serif-display font-semibold text-lg shrink-0">
                      {personName.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-[#1F241F] group-hover:text-[#39483A]">
                          {personName}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 bg-[#F5F1E8] border border-[#D8C7AA] text-[#39483A] rounded-sm">
                          {personRole}
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
      {/* Role Header Banner */}
      <div className="bg-[#39483A] rounded-sm p-6 sm:p-8 text-[#FCFBF7] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D8C7AA]">
            Espacio de Gestión ·{' '}
            {currentUser.role === 'cliente' && currentUser.isAlsoOwner
              ? 'Cliente y Propietario'
              : currentUser.role.toUpperCase()}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif-display font-semibold">
            {currentUser.displayName}
          </h1>
          <p className="text-xs sm:text-sm text-[#F5F1E8]/85 max-w-2xl leading-relaxed">
            {currentUser.role === 'cliente' &&
              !currentUser.isAlsoOwner &&
              'Gestioná tus inmuebles favoritos, tus visitas programadas, tus solicitudes de alquiler o compra y tus conversaciones.'}
            {canActAsOwner &&
              'Administrá tanto tus búsquedas y reservas como Cliente, como la publicación y gestión de tus propios inmuebles como Propietario.'}
            {currentUser.role === 'agente' &&
              'Gestioná las propiedades que te fueron asignadas, coordiná agendas de visitas, respondé consultas de clientes y registrá contratos.'}
            {currentUser.role === 'administrador' &&
              'Supervisión general de ClaveHogar: aprobá o rechazá publicaciones, administrá usuarios y roles, categorías, reclamos y métricas.'}
          </p>
        </div>

        {currentUser.role === 'cliente' && !currentUser.isAlsoOwner && (
          <div className="bg-[#FCFBF7]/10 border border-[#D8C7AA]/30 rounded-sm p-4 max-w-xs space-y-2.5 shrink-0">
            <div className="text-xs font-semibold text-[#D8C7AA]">
              ¿Querés publicar una propiedad?
            </div>
            <p className="text-[11px] text-[#FCFBF7]/85 leading-relaxed">
              Habilitá también tu perfil de <strong>Propietario</strong> sin perder ninguna de tus funciones de Cliente.
            </p>
            <button
              type="button"
              onClick={onEnableOwnerRole}
              className="w-full py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
            >
              Habilitar Modo Propietario
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
            Publicar Propiedad
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
                      className="py-2 px-3 text-xs font-semibold text-[#B86F52] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
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
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td className="py-3.5 pr-4 font-semibold text-[#1F241F]">{v.propertyTitle}</td>
                    <td className="py-3.5 px-4 font-tabular text-xs text-[#39483A]">
                      {v.date} · {v.timeSlot}
                    </td>
                    <td className="py-3.5 px-4 text-xs capitalize font-semibold text-[#B86F52]">
                      {v.status}
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
                          className="px-3 py-1.5 text-xs font-semibold text-[#B86F52] border border-[#B86F52]/40 rounded-sm hover:bg-[#F5F1E8]"
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
        </div>
      )}

      {activeSubView === 'cliente_operaciones' && canActAsClient && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Mis Solicitudes de Alquiler / Compra y Contratos
          </h2>
          <div className="space-y-3">
            {operations.map((op) => (
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
                  <div className="text-right">
                    <span className="text-base font-semibold font-tabular text-[#39483A]">
                      {op.currency} {op.offeredAmount.toLocaleString()}
                    </span>
                    <span className="block text-xs text-[#B86F52] font-semibold capitalize">
                      Estado: {op.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#39483A]/85">{op.message}</p>
                {op.contractCode && (
                  <div className="p-3.5 bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm text-xs space-y-1">
                    <div className="font-semibold text-[#39483A] font-tabular">
                      Contrato Registrado: {op.contractCode} ({op.contractStartDate} a{' '}
                      {op.contractEndDate})
                    </div>
                    <p className="text-[#1F241F]/80">{op.contractTerms}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubView === 'cliente_consultas' &&
        canActAsClient &&
        renderChatSection(inquiries, false)}

      {/* =====================================================================
          PROPIETARIO & AGENTE SCREENS
         ===================================================================== */}
      {(activeSubView === 'propietario_inmuebles' || activeSubView === 'agente_cartera') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8C7AA] pb-4">
            <div>
              <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                {activeSubView === 'propietario_inmuebles'
                  ? 'Mis Propiedades Registradas y Asignación de Agente'
                  : 'Cartera de Propiedades Asignadas'}
              </h2>
              <p className="text-xs text-[#39483A]/75">
                Los cambios de valor, fotografías y estado se actualizan en tiempo real en Firestore.
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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D8C7AA] text-xs uppercase tracking-wider text-[#39483A]/70">
                  <th className="py-3 pr-4">Inmueble</th>
                  <th className="py-3 px-3">Operación / Valor</th>
                  <th className="py-3 px-3">Publicación</th>
                  <th className="py-3 px-3">Disponibilidad</th>
                  {activeSubView === 'propietario_inmuebles' && (
                    <th className="py-3 px-3">Agente Asignado</th>
                  )}
                  <th className="py-3 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C7AA]/60">
                {(activeSubView === 'propietario_inmuebles'
                  ? myOwnedProperties
                  : myAssignedProperties
                ).map((prop) => (
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
                    <td className="py-3.5 px-3 font-tabular text-xs">
                      <span className="uppercase text-[#B86F52] font-semibold block">
                        {prop.operationType}
                      </span>
                      <span className="font-semibold text-[#39483A]">
                        {prop.currency} {prop.price.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-xs">
                      <span className="capitalize font-semibold text-[#39483A]">
                        {prop.publicationStatus}
                      </span>
                      {prop.rejectionReason && (
                        <span className="block text-[11px] text-[#B86F52]">
                          Motivo: {prop.rejectionReason}
                        </span>
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
                    {activeSubView === 'propietario_inmuebles' && (
                      <td className="py-3.5 px-3">
                        <select
                          value={prop.agentId || ''}
                          onChange={(e) => {
                            const ag = agentsList.find((a) => a.uid === e.target.value);
                            onAssignAgent(prop.id, ag ? ag.uid : '', ag ? ag.displayName : '');
                          }}
                          className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                        >
                          <option value="">Sin agente (Gestión directa)</option>
                          {agentsList.map((ag) => (
                            <option key={ag.uid} value={ag.uid}>
                              {ag.displayName}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="py-3.5 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectProperty(prop)}
                          className="p-2 text-[#39483A] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
                          title="Ver ficha"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEditProperty(prop)}
                          className="p-2 text-[#39483A] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
                          title="Editar propiedad"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {activeSubView === 'propietario_inmuebles' && (
                          <button
                            type="button"
                            onClick={() => onDeleteProperty(prop.id)}
                            className="p-2 text-[#B86F52] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
                            title="Eliminar publicación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeSubView === 'propietario_visitas' || activeSubView === 'agente_visitas') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Agenda de Visitas y Clientes Interesados
          </h2>
          <div className="space-y-3">
            {visits.map((v) => (
              <div
                key={v.id}
                className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-[#39483A]/80">
                    Cliente interesado: <strong className="text-[#1F241F]">{v.clientName}</strong> ·
                    Estado: <strong className="uppercase text-[#B86F52]">{v.status}</strong>
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
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                  >
                    Confirmar Visita
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateVisit(v.id, 'rechazada', v.date, v.timeSlot, v.notes)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#B86F52] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
                  >
                    Rechazar
                  </button>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
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
                      className="px-3 py-1.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
                    >
                      Reprogramar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeSubView === 'propietario_consultas' || activeSubView === 'agente_consultas') &&
        renderChatSection(inquiries, true)}

      {(activeSubView === 'propietario_operaciones' || activeSubView === 'agente_operaciones') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Gestión de Solicitudes de Alquiler/Venta, Operaciones y Contratos
          </h2>
          <div className="space-y-4">
            {operations.map((op) => {
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
                    <div className="text-right">
                      <span className="text-base font-semibold font-tabular text-[#39483A]">
                        {op.currency} {op.offeredAmount.toLocaleString()}
                      </span>
                      <span className="block text-xs font-semibold text-[#B86F52] capitalize">
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
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
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
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#B86F52] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          ADMINISTRADOR SCREENS
         ===================================================================== */}
      {activeSubView === 'admin_dashboard' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-6">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Reportes Ejecutivos y Supervisión de Plataforma
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#39483A]/75">
                Propiedades en Firestore
              </div>
              <div className="text-3xl font-semibold font-tabular text-[#1F241F] mt-1">
                {properties.length}
              </div>
              <div className="text-xs text-[#39483A]/70 mt-1">
                {properties.filter((p) => p.publicationStatus === 'aprobada').length} aprobadas ·{' '}
                {pendingProperties.length} pendientes
              </div>
            </div>
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#39483A]/75">
                Usuarios Registrados
              </div>
              <div className="text-3xl font-semibold font-tabular text-[#1F241F] mt-1">
                {users.filter((u) => u.active).length} / {users.length}
              </div>
              <div className="text-xs text-[#39483A]/70 mt-1">
                Clientes, Propietarios y Agentes
              </div>
            </div>
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#39483A]/75">
                Visitas Gestionadas
              </div>
              <div className="text-3xl font-semibold font-tabular text-[#1F241F] mt-1">
                {visits.length}
              </div>
              <div className="text-xs text-[#39483A]/70 mt-1">
                {visits.filter((v) => v.status === 'confirmada').length} confirmadas
              </div>
            </div>
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm">
              <div className="text-xs uppercase tracking-wider font-semibold text-[#39483A]/75">
                Volumen de Operaciones
              </div>
              <div className="text-2xl font-semibold font-tabular text-[#B86F52] mt-1">
                USD {totalSalesVolume.toLocaleString()}
              </div>
              <div className="text-xs text-[#39483A]/70 mt-1">
                {operations.length} operaciones registradas
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubView === 'admin_publicaciones' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Aprobación y Supervisión General de Publicaciones
          </h2>
          <div className="space-y-3">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
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
                    <div className="text-xs text-[#39483A]/75">
                      Estado: <strong className="uppercase text-[#B86F52]">{prop.publicationStatus}</strong> ·
                      Titular: {prop.ownerName} · {prop.location}
                    </div>
                    <div className="text-sm font-semibold text-[#1F241F]">{prop.title}</div>
                    <div className="text-xs font-tabular font-semibold text-[#39483A]">
                      {prop.operationType.toUpperCase()} — {prop.currency} {prop.price.toLocaleString()} ({prop.surface} m²)
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onModerateProperty(prop.id, 'aprobada')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                  >
                    Aprobar Publicación
                  </button>
                  <input
                    type="text"
                    value={rejectionReasons[prop.id] || ''}
                    onChange={(e) =>
                      setRejectionReasons((prev) => ({ ...prev, [prop.id]: e.target.value }))
                    }
                    placeholder="Motivo de rechazo..."
                    className="px-2.5 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onModerateProperty(
                        prop.id,
                        'rechazada',
                        rejectionReasons[prop.id] || 'Incumple requisitos de verificación'
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-[#B86F52] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProperty(prop.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#B86F52] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#FCFBF7]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubView === 'admin_usuarios' && currentUser.role === 'administrador' && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Administración de Usuarios, Roles y Estado de Cuentas
          </h2>
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
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-[#1F241F]">{u.displayName}</div>
                      <div className="text-xs text-[#39483A]/70">{u.agencyName || 'Particular'}</div>
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
                        className={`px-3 py-1.5 text-xs font-semibold rounded-sm border ${
                          u.active
                            ? 'text-[#39483A] border-[#D8C7AA] bg-[#F5F1E8]'
                            : 'text-[#B86F52] border-[#B86F52]/40 bg-white'
                        }`}
                      >
                        {u.active ? 'Activa (Desactivar)' : 'Inactiva (Activar)'}
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
                  className={`text-[11px] font-semibold underline ${
                    cat.active ? 'text-[#39483A]' : 'text-[#B86F52]'
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
          CLAIMS / RECLAMOS (Admin & User views)
         ===================================================================== */}
      {(activeSubView === 'admin_reclamos' || activeSubView === 'reclamos_usuario') && (
        <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-5">
          <h2 className="text-2xl font-serif-display font-semibold text-[#39483A]">
            Centro de Reclamos y Soporte
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {currentUser.role !== 'administrador' && (
              <form
                onSubmit={handleClaimSubmit}
                className="lg:col-span-5 space-y-3 bg-[#F5F1E8] p-5 rounded-sm border border-[#D8C7AA]"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-[#39483A]">
                  Enviar Nuevo Reclamo
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={claimTargetType}
                    onChange={(e) => setClaimTargetType(e.target.value as ClaimTargetType)}
                    className="px-3 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                  >
                    <option value="publicacion">Sobre Publicación</option>
                    <option value="visita">Sobre Visita</option>
                    <option value="operacion">Sobre Operación</option>
                    <option value="usuario">Sobre Usuario</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={claimRef}
                    onChange={(e) => setClaimRef(e.target.value)}
                    placeholder="Referencia / ID"
                    className="px-3 py-2 text-xs bg-white border border-[#D8C7AA] rounded-sm"
                  />
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
              {claims.map((clm) => (
                <div
                  key={clm.id}
                  className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-[#39483A]/75">
                    <span>
                      Reportado por <strong className="text-[#1F241F]">{clm.reporterName}</strong> ·
                      Categoría: <span className="uppercase">{clm.targetType}</span> ({clm.targetReference})
                    </span>
                    <span className="font-semibold capitalize text-[#B86F52]">
                      {clm.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#1F241F]">{clm.subject}</div>
                  <p className="text-xs text-[#39483A]/85">{clm.description}</p>
                  {clm.adminResolution && (
                    <p className="text-xs text-[#39483A] bg-[#FCFBF7] border border-[#D8C7AA] p-2.5 rounded-sm">
                      Resolución Administración: {clm.adminResolution}
                    </p>
                  )}
                  {currentUser.role === 'administrador' && (
                    <div className="flex gap-2 pt-1">
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
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#D8C7AA] rounded-sm"
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
                        className="px-4 py-1.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                      >
                        Resolver Reclamo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
