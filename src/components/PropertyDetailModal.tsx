import React, { useState } from 'react';
import {
  X,
  Heart,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  ArrowLeft,
  Edit3,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  PropertyItem,
  InquiryItem,
  OperationItem,
  OperationTypeChoice,
  UserProfile,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';
import { HERO_IMAGE, resolvePropertyImages } from '../data/initialData';
import {
  canUserEditProperty,
  isUserOwnerOfProperty,
  isUserAssignedAgentOfProperty,
  getMinVisitDate,
  isPropertyConcretada,
  isPropertySoldConcretada,
} from '../utils/propertyPermissions';

interface PropertyDetailModalProps {
  property: PropertyItem;
  currentUser: UserProfile | null;
  allOperations?: OperationItem[];
  isFavorite: boolean;
  isCompared: boolean;
  aiReason?: string;
  aiScore?: number;
  inquiries: InquiryItem[];
  onClose: () => void;
  onOpenEditProperty?: (property: PropertyItem) => void;
  onDeleteProperty?: (propertyId: string) => void;
  onRequireLogin: () => void;
  onToggleFavorite: (propertyId: string) => void;
  onToggleCompare: (propertyId: string) => void;
  onRequestVisit: (property: PropertyItem, date: string, timeSlot: string, notes: string) => Promise<void>;
  onSendChatMessage: (property: PropertyItem, messageText: string, existingInquiryId?: string) => Promise<void>;
  onRequestOperation: (
    property: PropertyItem,
    operationType: OperationTypeChoice,
    offeredAmount: number,
    currency: 'USD' | 'ARS',
    details: {
      guaranteeType?: string;
      desiredTerm?: string;
      declaredIncome?: string;
      paymentMethod?: string;
      conditions: string;
    }
  ) => Promise<void>;
  users?: UserProfile[];
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const AVAILABLE_TIME_SLOTS = [
  '09:30 - 10:30 hs',
  '11:00 - 12:00 hs',
  '14:30 - 15:30 hs',
  '16:00 - 17:00 hs',
  '17:30 - 18:30 hs',
];

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  property,
  currentUser,
  allOperations,
  users,
  isFavorite,
  isCompared,
  aiReason,
  aiScore,
  inquiries,
  onClose,
  onOpenEditProperty,
  onDeleteProperty,
  onRequireLogin,
  onToggleFavorite,
  onToggleCompare,
  onRequestVisit,
  onSendChatMessage,
  onRequestOperation,
  onNotify,
}) => {
  const isSoldConcretada = isPropertySoldConcretada(property, allOperations);
  const isConcretada = isPropertyConcretada(property, allOperations);
  const canEdit = canUserEditProperty(property, currentUser, users, allOperations);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'visita' | 'consulta' | 'operacion'>('visita');
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);

  const minVisitDate = getMinVisitDate();
  const [visitDate, setVisitDate] = useState(() => getMinVisitDate());
  const [visitSlot, setVisitSlot] = useState(AVAILABLE_TIME_SLOTS[1]);
  const [visitNotes, setVisitNotes] = useState('');

  const [chatText, setChatText] = useState('');
  const [offeredAmount, setOfferedAmount] = useState<string>(String(property.price));
  const [offeredCurrency, setOfferedCurrency] = useState<'USD' | 'ARS'>(property.currency || 'USD');
  const [guaranteeType, setGuaranteeType] = useState<string>('Garantía Propietaria CABA/GBA');
  const [desiredTermMonths, setDesiredTermMonths] = useState<number>(24);
  const [paymentMethod, setPaymentMethod] = useState<string>('Contado efectivo al boleto');
  const [operationMessage, setOperationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isConfirmedAgent =
    Boolean(property.agentId?.trim()) &&
    (!property.agentAssignmentStatus || property.agentAssignmentStatus === 'asignado');
  const activeAgentName = isConfirmedAgent ? property.agentName : '';

  const isOwnerOfProperty = Boolean(
    currentUser &&
      (currentUser.uid === property.ownerId ||
        (users && isUserOwnerOfProperty(property, currentUser, users)))
  );
  const isAgentOfProperty = Boolean(
    currentUser &&
      ((isConfirmedAgent && currentUser.uid === property.agentId) ||
        (users && isUserAssignedAgentOfProperty(property, currentUser, users)))
  );
  const isOwnerOrAgent = isOwnerOfProperty || isAgentOfProperty;

  const propertyInquiries = inquiries.filter((inq) => {
    if (inq.propertyId !== property.id) return false;
    if (!currentUser) return false;
    if (currentUser.role === 'administrador') return true;
    if (property.ownerId === currentUser.uid) return true;
    if (isConfirmedAgent && property.agentId === currentUser.uid) return true;
    return inq.clientId === currentUser.uid;
  });
  const myThread = currentUser
    ? propertyInquiries.find(
        (inq) =>
          inq.clientId === currentUser.uid ||
          inq.ownerId === currentUser.uid ||
          (isConfirmedAgent && inq.agentId === currentUser.uid)
      )
    : undefined;

  const activeThread = selectedInquiryId
    ? propertyInquiries.find((i) => i.id === selectedInquiryId)
    : null;

  const images = resolvePropertyImages(property.images, property.id);

  const handleVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConcretada) {
      onNotify(
        'error',
        'Acción no permitida',
        'No se permite realizar estas acciones porque la propiedad ya está concretada.'
      );
      return;
    }
    if (!currentUser) {
      onNotify('info', 'Iniciá sesión para reservar', 'Debés iniciar sesión con tu cuenta para agendar una visita.');
      onRequireLogin();
      return;
    }
    if (isOwnerOrAgent) {
      onNotify(
        'error',
        'Acción no permitida',
        isOwnerOfProperty
          ? 'Como propietario titular de esta publicación, no podés agendar una visita sobre tu propia propiedad.'
          : 'Como agente inmobiliario a cargo de esta publicación, no podés agendar una visita sobre esta propiedad.'
      );
      return;
    }
    if (!visitDate || !visitSlot) {
      onNotify('error', 'Error: faltan completar campos', 'Seleccioná fecha y horario para la visita.');
      return;
    }
    const currentMin = getMinVisitDate();
    if (visitDate < currentMin) {
      onNotify(
        'error',
        'Fecha no permitida para visita',
        'Las visitas deben solicitarse con un mínimo de 24 horas de anticipación (a partir de mañana) y no se admiten fechas anteriores ni del día actual.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await onRequestVisit(
        property,
        visitDate,
        visitSlot,
        truncateText(visitNotes, SCHEMA_LIMITS.VISIT_NOTES_MAX)
      );
      setVisitNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent, threadIdToReply?: string) => {
    e.preventDefault();
    if (isConcretada && !threadIdToReply && !myThread) {
      onNotify(
        'error',
        'Acción no permitida',
        'No se permite realizar estas acciones porque la propiedad ya está concretada.'
      );
      return;
    }
    if (!currentUser) {
      onNotify('info', 'Iniciá sesión para consultar', 'Debés iniciar sesión para iniciar un chat con el propietario o agente.');
      onRequireLogin();
      return;
    }
    if (chatText.trim().length < 2) {
      onNotify('error', 'Error: faltan completar campos', 'Escribí tu mensaje antes de enviarlo.');
      return;
    }
    setSubmitting(true);
    try {
      await onSendChatMessage(
        property,
        truncateText(chatText, SCHEMA_LIMITS.INQUIRY_MAX),
        threadIdToReply || myThread?.id
      );
      setChatText('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOperationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConcretada) {
      onNotify(
        'error',
        'Acción no permitida',
        'No se permite realizar estas acciones porque la propiedad ya está concretada.'
      );
      return;
    }
    if (!currentUser) {
      onNotify('info', 'Iniciá sesión para solicitar', 'Iniciá sesión para enviar una propuesta formal.');
      onRequireLogin();
      return;
    }
    if (isOwnerOrAgent) {
      onNotify(
        'error',
        'Acción no permitida',
        isOwnerOfProperty
          ? 'Como propietario titular de esta publicación, no podés enviar una oferta de compra o alquiler sobre tu propia propiedad.'
          : 'Como agente inmobiliario a cargo de esta publicación, no podés enviar una propuesta sobre esta propiedad.'
      );
      return;
    }

    const numOffer = Number(offeredAmount);
    if (!numOffer || numOffer <= 0) {
      onNotify('error', 'Monto inválido', 'Ingresá un monto ofrecido válido mayor a 0.');
      return;
    }

    const isRental = property.operationType === 'alquiler';

    if (isRental) {
      if (!guaranteeType.trim()) {
        onNotify('error', 'Campo obligatorio', 'Seleccioná o indicá el tipo de garantía.');
        return;
      }
    } else {
      if (!paymentMethod.trim()) {
        onNotify('error', 'Campo obligatorio', 'Seleccioná la forma de pago propuesta.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onRequestOperation(
        property,
        property.operationType,
        numOffer,
        offeredCurrency,
        {
          guaranteeType: isRental ? guaranteeType.trim() : undefined,
          desiredTerm: isRental ? `${desiredTermMonths} meses` : undefined,
          paymentMethod: !isRental ? paymentMethod.trim() : undefined,
          conditions: truncateText(operationMessage, SCHEMA_LIMITS.OP_MESSAGE_MAX),
        }
      );
      setOperationMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F241F]/65 p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#FCFBF7] border border-[#D5BFA0] rounded-md overflow-hidden my-8 max-h-[92vh] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#173B43] text-[#FCFBF7] shrink-0">
          <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-[#D5BFA0]">
            <span>{property.propertyType}</span>
            <span aria-hidden="true">·</span>
            <span>{property.operationType === 'alquiler' ? 'Alquiler' : 'Venta'}</span>
            <span aria-hidden="true">·</span>
            <span>{property.availability}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {canEdit && onOpenEditProperty && !isConcretada && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditProperty(property);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm bg-[#B86F52] hover:bg-[#a35e42] text-[#FCFBF7] border border-[#B86F52] transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                title="Editar datos, fotos, precio o disponibilidad de esta propiedad"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Propiedad</span>
              </button>
            )}
            {currentUser?.role !== 'administrador' && isOwnerOfProperty && !isConcretada && onDeleteProperty && (
              <button
                type="button"
                onClick={() => {
                  onDeleteProperty(property.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm bg-red-600 hover:bg-red-700 text-white border border-red-600 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                title="Eliminar esta propiedad"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleCompare(property.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                isCompared
                  ? 'bg-[#C87955] text-white border-[#C87955]'
                  : 'bg-transparent text-white border-white/30 hover:bg-white/10'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {isCompared ? 'En comparador' : 'Comparar'}
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(property.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors whitespace-nowrap ${
                isFavorite
                  ? 'bg-[#B86F52] text-[#FCFBF7] border-[#B86F52]'
                  : 'bg-transparent text-[#FCFBF7] border-[#A8B5A0]/40 hover:bg-white/10'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              {isFavorite ? 'Guardado' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#D5BFA0] hover:text-[#FCFBF7] rounded-sm hover:bg-white/10 transition-colors"
              aria-label="Cerrar detalle"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left column: Large Photography + Architectural Specs + Description (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Image Gallery */}
            <div className="relative aspect-[16/10] w-full rounded-sm overflow-hidden bg-[#F8F6F1] border border-[#D5BFA0]">
              <img
                src={images[activeImageIdx] || HERO_IMAGE}
                alt={property.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== HERO_IMAGE) {
                    e.currentTarget.src = HERO_IMAGE;
                  }
                }}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx((prev) => (prev - 1 + images.length) % images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-sm bg-[#173B43]/85 text-[#FCFBF7] hover:bg-[#173B43] transition-colors"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImageIdx((prev) => (prev + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-sm bg-[#173B43]/85 text-[#FCFBF7] hover:bg-[#173B43] transition-colors"
                    aria-label="Siguiente foto"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-[#173B43]/90 text-[#FCFBF7] px-3 py-1 rounded-sm text-xs font-tabular">
                    {activeImageIdx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-24 h-16 rounded-sm overflow-hidden border-2 transition-all shrink-0 ${
                      idx === activeImageIdx ? 'border-[#173B43]' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl || HERO_IMAGE}
                      alt={`${property.title} miniatura ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.currentTarget.src !== HERO_IMAGE) {
                          e.currentTarget.src = HERO_IMAGE;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* AI Recommendation Explanation */}
            {aiReason && (
              <div className="p-5 bg-[#F8F6F1] border-l-4 border-[#B86F52] space-y-1.5">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-[#173B43]">
                  <span>Lectura de Compatibilidad IA</span>
                  {aiScore && <span className="font-tabular text-[#B86F52]">{aiScore}% coincidencia</span>}
                </div>
                <p className="text-sm text-[#1F241F]/85 leading-relaxed">{aiReason}</p>
              </div>
            )}

            {/* Architectural Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 px-6 bg-[#F8F6F1] border-y border-[#D5BFA0]">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#173B43]/70">Superficie</div>
                <div className="text-lg font-semibold font-tabular text-[#1F241F] mt-0.5">
                  {property.surface} m²
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#173B43]/70">Ambientes</div>
                <div className="text-lg font-semibold font-tabular text-[#1F241F] mt-0.5">
                  {property.rooms} amb.
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#173B43]/70">Dormitorios</div>
                <div className="text-lg font-semibold font-tabular text-[#1F241F] mt-0.5">
                  {property.bedrooms} dorm.
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#173B43]/70">Baños</div>
                <div className="text-lg font-semibold font-tabular text-[#1F241F] mt-0.5">
                  {property.bathrooms} baños
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-xl font-serif-display font-semibold text-[#173B43]">
                Memoria Descriptiva
              </h3>
              <p className="text-sm text-[#1F241F]/85 leading-relaxed">{property.description}</p>
            </div>

            {/* Features list */}
            <div className="space-y-3">
              <h3 className="text-xl font-serif-display font-semibold text-[#173B43]">
                Características y Equipamiento
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-sm text-[#1F241F]/85">
                {property.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#B86F52] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Editorial Action Module + Clean Chat List -> Full Conversation (5 cols) */}
          <div className="lg:col-span-5">
            <div className="bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm p-6 space-y-6 sticky top-0">
              {/* Header info */}
              <div className="space-y-2 border-b border-[#D5BFA0] pb-5">
                <div className="text-xs uppercase tracking-widest text-[#B86F52] font-semibold">
                  {property.location} · {property.address}
                </div>
                <h2 className="text-2xl sm:text-3xl font-serif-display font-semibold text-[#1F241F] leading-snug">
                  {property.title}
                </h2>
                <div className="pt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#173B43]/70 block">
                      Valor de {property.operationType === 'alquiler' ? 'alquiler mensual' : 'venta'}
                    </span>
                    <span className="text-2xl font-semibold font-tabular text-[#173B43]">
                      {property.currency} {property.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right text-xs text-[#173B43]/70 font-tabular">
                    {property.currency} {Math.round(property.price / Math.max(1, property.surface)).toLocaleString()} / m²
                  </div>
                </div>
                <div className="pt-2 text-xs text-[#173B43]/80 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>Propietario: <strong className="text-[#1F241F]">{property.ownerName}</strong></span>
                  {activeAgentName ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Agente a cargo: <strong className="text-[#1F241F]">{activeAgentName}</strong></span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#B86F52] font-semibold">Gestión directa por propietario</span>
                    </>
                  )}
                </div>
              </div>

              {/* Banner de gestión para propietario / agente / admin */}
              {/* {canEdit && onOpenEditProperty && (
                <div className="p-3.5 bg-[#173B43] text-[#FCFBF7] rounded-sm flex items-center justify-between gap-3 shadow-sm">
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-bold text-[#D5BFA0] block uppercase tracking-wider text-[10px]">
                      {currentUser?.role === 'administrador'
                        ? 'Administración General'
                        : isUserAssignedAgentOfProperty(property, currentUser)
                        ? 'Agente Inmobiliario a Cargo'
                        : 'Propietario Titular'}
                    </span>
                    <p className="text-xs text-[#FCFBF7]/90 truncate">
                      Tenés permisos de edición sobre esta propiedad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEditProperty(property);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold bg-[#B86F52] hover:bg-[#a35e42] text-[#FCFBF7] rounded-sm inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Ficha
                  </button>
                </div>
              )} */}

              {/* Cartel de Venta Concretada / Operación Concretada */}
              {isSoldConcretada ? (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-sm text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-900">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>Venta Concretada · Operación Finalizada</span>
                  </div>
                  <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                    Esta propiedad ya fue vendida y la operación está concretada. Por normativa, no se reciben nuevos interesados, visitas ni ofertas de compra.
                  </p>
                </div>
              ) : isConcretada ? (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-sm text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-900">
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>Operación Concretada</span>
                  </div>
                  <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                    Esta propiedad ya cuenta con una operación concretada. No se reciben nuevos interesados ni solicitudes.
                  </p>
                </div>
              ) : null}

              {/* Action Selector Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#D5BFA0]/40 rounded-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab('visita')}
                  className={`py-2 px-2 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap ${
                    activeTab === 'visita'
                      ? 'bg-[#173B43] text-[#FCFBF7]'
                      : 'text-[#173B43] hover:bg-[#FCFBF7]/60'
                  }`}
                >
                  Agendar Visita
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('operacion')}
                  className={`py-2 px-2 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap ${
                    activeTab === 'operacion'
                      ? 'bg-[#173B43] text-[#FCFBF7]'
                      : 'text-[#173B43] hover:bg-[#FCFBF7]/60'
                  }`}
                >
                  {property.operationType === 'alquiler' ? 'Alquilar' : 'Comprar'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('consulta')}
                  className={`py-2 px-2 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap ${
                    activeTab === 'consulta'
                      ? 'bg-[#173B43] text-[#FCFBF7]'
                      : 'text-[#173B43] hover:bg-[#FCFBF7]/60'
                  }`}
                >
                  Chat ({propertyInquiries.length})
                </button>
              </div>

              {/* Tab 1: Solicitud de Visita */}
              {activeTab === 'visita' && (
                <form onSubmit={handleVisitSubmit} className="space-y-4">
                  {isOwnerOrAgent && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Propiedad propia o a tu cargo</span>
                      </div>
                      <p className="leading-relaxed">
                        {isOwnerOfProperty
                           ? 'Sos el propietario titular de esta publicación. No podés agendar visitas sobre tu propia propiedad.'
                          : 'Sos el agente inmobiliario a cargo de esta publicación. No podés agendar visitas sobre esta propiedad.'}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#173B43]">
                        Fecha preferida de visita
                      </label>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xs">
                        Mínimo 24 hs de anticipación
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      disabled={isOwnerOrAgent || isConcretada}
                      value={visitDate}
                      min={minVisitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                    />
                    <p className="text-[11px] text-[#173B43]/80 font-medium flex items-center gap-1.5 pt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#B86F52] shrink-0" />
                      <span>Solo podés agendar a partir de mañana ({minVisitDate}). No se permiten fechas pasadas ni del día de hoy.</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Franja horaria disponible
                    </label>
                    <select
                      disabled={isOwnerOrAgent || isConcretada}
                      value={visitSlot}
                      onChange={(e) => setVisitSlot(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                    >
                      {AVAILABLE_TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Notas para la visita
                    </label>
                    <textarea
                      rows={2}
                      disabled={isOwnerOrAgent || isConcretada}
                      maxLength={SCHEMA_LIMITS.VISIT_NOTES_MAX}
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      placeholder="Indicá tus preferencias o consultas para el recorrido..."
                      className="w-full px-3.5 py-2 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || isOwnerOrAgent || isConcretada || property.availability === 'alquilada' || property.availability === 'vendida'}
                    className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#122e35] disabled:opacity-50 rounded-sm transition-colors cursor-pointer shadow-xs"
                  >
                    {submitting
                      ? 'Guardando reserva...'
                      : isOwnerOrAgent
                      ? 'No disponible (Propiedad propia)'
                      : isConcretada
                      ? 'No disponible (Propiedad ya concretada)'
                      : property.availability === 'disponible' || property.availability === 'reservada'
                      ? 'Confirmar Solicitud de Visita'
                      : 'Propiedad no disponible'}
                  </button>
                </form>
              )}

              {/* Tab 2: Formulario del Cliente - Propuesta de Alquiler / Compra */}
              {activeTab === 'operacion' && (
                <form onSubmit={handleOperationSubmit} className="space-y-4">
                  {isOwnerOrAgent && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Propiedad propia o a tu cargo</span>
                      </div>
                      <p className="leading-relaxed">
                        {isOwnerOfProperty
                          ? 'Sos el propietario titular de esta publicación. No podés enviar ofertas de compra o alquiler sobre tu propia propiedad.'
                          : 'Sos el agente inmobiliario a cargo de esta publicación. No podés enviar ofertas sobre esta propiedad.'}
                      </p>
                    </div>
                  )}

                  {/* Reference Published Price Box */}
                  <div className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-xs space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#B86F52] block">
                      Precio Publicado de Referencia:
                    </span>
                    <span className="text-base font-bold font-tabular text-[#173B43]">
                      {property.currency} {property.price.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-[#173B43]/70 block">
                      Podés enviar la propuesta con el monto publicado o indicar un valor negociable.
                    </span>
                  </div>

                  {/* Offered Price & Currency */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-xs font-semibold text-[#173B43]">
                        Monto Ofrecido *
                      </label>
                      <input
                        type="number"
                        required
                        disabled={isOwnerOrAgent}
                        min={1}
                        value={offeredAmount}
                        onChange={(e) => setOfferedAmount(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#173B43]">Moneda *</label>
                      <select
                        disabled={isOwnerOrAgent}
                        value={offeredCurrency}
                        onChange={(e) => setOfferedCurrency(e.target.value as 'USD' | 'ARS')}
                        className="w-full px-3.5 py-2 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                      >
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </div>
                  </div>

                  {/* Rental Specific Fields */}
                  {property.operationType === 'alquiler' ? (
                    <>
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#173B43]">
                          Tipo de Garantía Propuesta *
                        </label>
                        <select
                          disabled={isOwnerOrAgent}
                          value={guaranteeType}
                          onChange={(e) => setGuaranteeType(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                        >
                          <option value="Garantía Propietaria CABA/GBA">Garantía Propietaria CABA / GBA</option>
                          <option value="Seguro de Caución Finaer / Premiar">Seguro de Caución (Finaer / Premiar)</option>
                          <option value="Seguro de Caución Bancario">Seguro de Caución Bancario</option>
                          <option value="Recibos de Sueldo / Comprobantes">Recibos de Sueldo / Comprobantes de Ingresos</option>
                          <option value="Otro / A convenir">Otro / A convenir con el propietario</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#173B43]">
                          Plazo Deseado *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            required
                            disabled={isOwnerOrAgent}
                            value={desiredTermMonths}
                            onChange={(e) => setDesiredTermMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full px-3.5 py-2 text-xs bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                          />
                          <span className="text-xs font-semibold text-[#173B43] shrink-0">
                            meses
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Purchase Specific Fields */
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#173B43]">
                        Forma de Pago Propuesta *
                      </label>
                      <select
                        disabled={isOwnerOrAgent}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                      >
                        <option value="Contado efectivo al boleto">Contado efectivo al boleto / escritura</option>
                        <option value="Transferencia bancaria">Transferencia bancaria internacional / local</option>
                        <option value="Boleto 70% + 30% a la escritura">Boleto 70% + Saldo 30% a la escritura</option>
                        <option value="Permuta parcial + Efectivo">Permuta parcial + Diferencia en efectivo</option>
                        <option value="Crédito hipotecario">Sujeto a aprobación de crédito hipotecario</option>
                      </select>
                    </div>
                  )}

                  {/* General Conditions */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Condiciones Particulares de la Propuesta
                    </label>
                    <textarea
                      rows={3}
                      disabled={isOwnerOrAgent}
                      maxLength={SCHEMA_LIMITS.OP_MESSAGE_MAX}
                      value={operationMessage}
                      onChange={(e) => setOperationMessage(e.target.value)}
                      placeholder={
                        property.operationType === 'alquiler'
                          ? 'Detallá fecha de ingreso deseada, mascotas, expensas o condiciones particulares...'
                          : 'Detallá plazo de escrituración, vigencia de la propuesta, gastos de escritura...'
                      }
                      className="w-full px-3.5 py-2 text-xs bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43] disabled:opacity-60"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || isOwnerOrAgent || isConcretada || property.availability === 'alquilada' || property.availability === 'vendida'}
                    className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#9e5b40] disabled:opacity-50 rounded-sm transition-colors cursor-pointer shadow-xs"
                  >
                    {submitting
                      ? 'Enviando propuesta...'
                      : isOwnerOrAgent
                      ? 'No disponible (Propiedad propia o a tu cargo)'
                      : isConcretada
                      ? 'No disponible (Propiedad ya concretada)'
                      : property.availability === 'disponible' || property.availability === 'reservada'
                      ? `Enviar Propuesta de ${property.operationType === 'alquiler' ? 'Alquiler' : 'Compra'}`
                      : 'Propiedad no disponible'}
                  </button>
                </form>
              )}

              {/* Tab 3: Chat (List of people -> click -> Full Chat view) */}
              {activeTab === 'consulta' && (
                <div className="space-y-4">
                  {!activeThread ? (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#173B43]">
                          Conversaciones sobre este inmueble
                        </div>
                        {propertyInquiries.length === 0 ? (
                          <p className="text-xs text-[#173B43]/75 bg-[#FCFBF7] border border-[#D5BFA0] p-3.5 rounded-sm">
                            Aún no hay conversaciones registradas. Iniciá una nueva consulta debajo con{' '}
                            <strong>{property.agentName || property.ownerName}</strong>.
                          </p>
                        ) : (
                          <div className="divide-y divide-[#D5BFA0] border border-[#D5BFA0] rounded-sm bg-[#FCFBF7]">
                            {propertyInquiries.map((inq) => {
                              const lastMsg =
                                inq.messages && inq.messages.length > 0
                                  ? inq.messages[inq.messages.length - 1].text
                                  : inq.reply || inq.question;
                              return (
                                <button
                                  key={inq.id}
                                  type="button"
                                  onClick={() => setSelectedInquiryId(inq.id)}
                                  className="w-full p-3.5 text-left hover:bg-[#F8F6F1] transition-colors flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#1F241F] truncate">
                                      {inq.clientName} ↔ {inq.agentName || property.agentName || property.ownerName}
                                    </div>
                                    <p className="text-xs text-[#173B43]/75 truncate mt-0.5">
                                      {lastMsg}
                                    </p>
                                  </div>
                                  <span className="text-[11px] font-semibold text-[#B86F52] shrink-0">
                                    Abrir chat →
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {isConcretada ? (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-950 font-medium">
                          Esta publicación ya está concretada y no recibe nuevas consultas de interesados.
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleChatSubmit(e)} className="space-y-3 pt-2 border-t border-[#D5BFA0]">
                          <label className="block text-xs font-semibold text-[#173B43]">
                            Iniciar nueva consulta con {property.agentName || property.ownerName}
                          </label>
                          <textarea
                            rows={3}
                            required
                            maxLength={SCHEMA_LIMITS.INQUIRY_MAX}
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            placeholder="Escribí tu consulta sobre requisitos, expensas o visitas..."
                            className="w-full px-3.5 py-2.5 text-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center justify-center gap-2 w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] disabled:opacity-50 rounded-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {submitting ? 'Enviando...' : 'Enviar Mensaje'}
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    /* Individual Full Chat View inside modal */
                    <div className="space-y-3 bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm p-4">
                      <div className="flex items-center justify-between border-b border-[#D5BFA0] pb-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInquiryId(null)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#173B43] hover:text-[#B86F52]"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Volver a la lista
                        </button>
                        <span className="text-[11px] text-[#173B43]/70 font-tabular">
                          {activeThread.createdAtIso.slice(0, 10)}
                        </span>
                      </div>

                      <div className="text-xs text-[#173B43]">
                        Conversación entre <strong>{activeThread.clientName}</strong> y{' '}
                        <strong>{activeThread.agentName || property.agentName || property.ownerName}</strong>
                      </div>

                      <div className="space-y-2.5 max-h-60 overflow-y-auto py-2">
                        {(activeThread.messages && activeThread.messages.length > 0
                          ? activeThread.messages
                          : [
                              {
                                id: 'q',
                                senderId: activeThread.clientId,
                                senderName: activeThread.clientName,
                                senderRole: 'cliente' as const,
                                text: activeThread.question,
                                timestamp: activeThread.createdAtIso.slice(0, 16).replace('T', ' '),
                              },
                            ]
                        ).map((msg) => {
                          const isClient = msg.senderRole === 'cliente';
                          return (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-sm text-xs space-y-1 ${
                                isClient
                                  ? 'bg-[#F8F6F1] text-[#1F241F] mr-4 border border-[#D5BFA0]'
                                  : 'bg-[#173B43] text-[#FCFBF7] ml-4'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] opacity-75">
                                <span className="font-semibold">{msg.senderName}</span>
                                <span className="font-tabular">{msg.timestamp}</span>
                              </div>
                              <p className="text-xs leading-relaxed">{msg.text}</p>
                            </div>
                          );
                        })}
                      </div>

                      <form
                        onSubmit={(e) => handleChatSubmit(e, activeThread.id)}
                        className="flex gap-2 pt-2 border-t border-[#D5BFA0]"
                      >
                        <input
                          type="text"
                          required
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          placeholder="Responder en este chat..."
                          className="flex-1 px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                        />
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-3.5 py-2 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm"
                        >
                          Enviar
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
