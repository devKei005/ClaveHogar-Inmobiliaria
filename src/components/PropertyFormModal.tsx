import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UploadCloud,
  Trash2,
  Check,
  Image as ImageIcon,
  UserCheck,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  PropertyItem,
  OperationTypeChoice,
  AvailabilityStatus,
  CategoryConfigItem,
  UserProfile,
  PropertyManagementMode,
  AgentRequestType,
  AgentAssignmentStatus,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';

interface PropertyFormModalProps {
  isOpen: boolean;
  editingProperty: PropertyItem | null;
  currentUser: UserProfile | null;
  availableAgents: UserProfile[];
  categories: CategoryConfigItem[];
  onClose: () => void;
  onSave: (
    data: Omit<PropertyItem, 'id' | 'ownerId' | 'ownerName' | 'publicationStatus' | 'createdAtIso'>,
    existingId?: string
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 960;
        const MAX_HEIGHT = 720;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(event.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo del dispositivo.'));
    reader.readAsDataURL(file);
  });
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  isOpen,
  editingProperty,
  currentUser,
  availableAgents,
  categories,
  onClose,
  onSave,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const propertyTypes = categories
    .filter((c) => c.kind === 'tipo_inmueble' && c.active)
    .map((c) => c.name);
  const availableFeatures = categories
    .filter((c) => c.kind === 'caracteristica' && c.active)
    .map((c) => c.name);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [operationType, setOperationType] = useState<OperationTypeChoice>('venta');
  const [propertyType, setPropertyType] = useState(propertyTypes[0] || 'Casa');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
  const [surface, setSurface] = useState('');
  const [rooms, setRooms] = useState('3');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('2');
  const [availability, setAvailability] = useState<AvailabilityStatus>('disponible');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Modalidad de gestión y solicitud opcional de agente
  const [managementMode, setManagementMode] = useState<PropertyManagementMode>('directa');
  const [agentRequestType, setAgentRequestType] = useState<AgentRequestType>('ninguna');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingProperty) {
      setTitle(editingProperty.title || '');
      setDescription(editingProperty.description || '');
      setLocation(editingProperty.location || '');
      setAddress(editingProperty.address || '');
      setOperationType(editingProperty.operationType || 'venta');
      setPropertyType(editingProperty.propertyType || propertyTypes[0] || 'Casa');
      setPrice(String(editingProperty.price || ''));
      setCurrency(editingProperty.currency || 'USD');
      setSurface(String(editingProperty.surface || ''));
      setRooms(String(editingProperty.rooms || '3'));
      setBedrooms(String(editingProperty.bedrooms || '2'));
      setBathrooms(String(editingProperty.bathrooms || '2'));
      setAvailability(editingProperty.availability || 'disponible');
      setSelectedFeatures(editingProperty.features || []);
      setSelectedImages(editingProperty.images || []);

      const hasAgentOrPending =
        editingProperty.managementMode === 'con_agente' ||
        Boolean(editingProperty.agentId?.trim()) ||
        editingProperty.agentAssignmentStatus === 'pendiente_agente' ||
        editingProperty.agentAssignmentStatus === 'pendiente_admin' ||
        editingProperty.agentAssignmentStatus === 'asignado';

      setManagementMode(hasAgentOrPending ? 'con_agente' : 'directa');
      if (!hasAgentOrPending) {
        setAgentRequestType('ninguna');
        setSelectedAgentId('');
      } else if (editingProperty.agentRequestType === 'asignacion_admin' || editingProperty.agentAssignmentStatus === 'pendiente_admin') {
        setAgentRequestType('asignacion_admin');
        setSelectedAgentId('');
      } else {
        setAgentRequestType('elegir_agente');
        setSelectedAgentId(
          editingProperty.agentId ||
            editingProperty.requestedAgentId ||
            availableAgents[0]?.uid ||
            ''
        );
      }
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setAddress('');
      setOperationType('venta');
      setPropertyType(propertyTypes[0] || 'Casa');
      setPrice('');
      setCurrency('USD');
      setSurface('');
      setRooms('3');
      setBedrooms('2');
      setBathrooms('2');
      setAvailability('disponible');
      setSelectedFeatures([]);
      setSelectedImages([]);
      setManagementMode('directa');
      setAgentRequestType('ninguna');
      setSelectedAgentId(availableAgents[0]?.uid || '');
    }
  }, [isOpen, editingProperty]);

  if (!isOpen) return null;

  const isAgentEditor =
    currentUser?.role === 'agente' &&
    editingProperty &&
    editingProperty.ownerId !== currentUser.uid;

  const toggleFeature = (feat: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feat)
        ? prev.filter((f) => f !== feat)
        : prev.length < SCHEMA_LIMITS.PROP_FEATURES_MAX
        ? [...prev, feat]
        : prev
    );
  };

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const processedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          onNotify('error', 'Archivo inválido', `"${file.name}" no es una imagen válida.`);
          continue;
        }
        const dataUrl = await processImageFile(file);
        if (dataUrl) {
          processedUrls.push(dataUrl);
        }
      }

      if (processedUrls.length > 0) {
        setSelectedImages((prev) =>
          [...prev, ...processedUrls].slice(0, SCHEMA_LIMITS.PROP_IMAGES_MAX)
        );
        onNotify(
          'success',
          `${processedUrls.length} ${processedUrls.length === 1 ? 'fotografía cargada' : 'fotografías cargadas'}`,
          'Las imágenes de tu dispositivo fueron procesadas correctamente.'
        );
      }
    } catch (err) {
      onNotify(
        'error',
        'Error al subir imagen',
        err instanceof Error ? err.message : 'No se pudo cargar la imagen.'
      );
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setSelectedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !location.trim() || !address.trim() || !price || !surface) {
      onNotify('error', 'Error: faltan completar campos', 'Por favor completa todos los campos obligatorios del inmueble.');
      return;
    }

    if (selectedImages.length === 0) {
      onNotify(
        'error',
        'Falta subir fotografías',
        'Debes adjuntar al menos una fotografía desde tu dispositivo para publicar la propiedad.'
      );
      return;
    }

    if (!isAgentEditor && managementMode === 'con_agente' && agentRequestType === 'elegir_agente' && !selectedAgentId) {
      onNotify(
        'error',
        'Seleccioná un agente',
        'Elegí un agente inmobiliario de la lista o seleccioná la opción "Que me asignen uno".'
      );
      return;
    }

    // Calcular campos de agente según la modalidad elegida por el propietario
    let finalManagementMode: PropertyManagementMode = editingProperty?.managementMode || 'directa';
    let finalRequestType: AgentRequestType = editingProperty?.agentRequestType || 'ninguna';
    let finalStatus: AgentAssignmentStatus = editingProperty?.agentAssignmentStatus || 'sin_agente';
    let finalAgentId = editingProperty?.agentId || '';
    let finalAgentName = editingProperty?.agentName || '';
    let finalRequestedAgentId = editingProperty?.requestedAgentId || '';
    let finalRequestedAgentName = editingProperty?.requestedAgentName || '';
    let finalAgentRejectionReason = editingProperty?.agentRejectionReason || '';

    if (!isAgentEditor) {
      if (managementMode === 'directa') {
        finalManagementMode = 'directa';
        finalRequestType = 'ninguna';
        finalStatus = 'sin_agente';
        finalAgentId = '';
        finalAgentName = '';
        finalRequestedAgentId = '';
        finalRequestedAgentName = '';
        finalAgentRejectionReason = '';
      } else {
        finalManagementMode = 'con_agente';
        if (agentRequestType === 'asignacion_admin') {
          finalRequestType = 'asignacion_admin';
          finalStatus = 'pendiente_admin';
          finalAgentId = '';
          finalAgentName = '';
          finalRequestedAgentId = '';
          finalRequestedAgentName = '';
          finalAgentRejectionReason = '';
        } else {
          finalRequestType = 'elegir_agente';
          const chosenAgent = availableAgents.find((a) => a.uid === selectedAgentId);
          const chosenName = chosenAgent?.displayName || '';
          const alreadyHadAgent =
            Boolean(editingProperty?.agentId) ||
            editingProperty?.agentAssignmentStatus === 'asignado';
          const keepingSameAgent =
            alreadyHadAgent &&
            (editingProperty?.agentId === selectedAgentId ||
              editingProperty?.requestedAgentId === selectedAgentId ||
              !selectedAgentId);

          if (keepingSameAgent) {
            finalStatus = 'asignado';
            finalAgentId = editingProperty?.agentId || selectedAgentId;
            finalAgentName = editingProperty?.agentName || chosenName;
            finalRequestedAgentId = editingProperty?.agentId || selectedAgentId;
            finalRequestedAgentName = chosenName || editingProperty?.agentName || '';
          } else {
            // Si el propietario elige un agente nuevo o diferente, queda pendiente hasta que el agente acepte o el admin confirme
            finalStatus = 'pendiente_agente';
            finalAgentId = '';
            finalAgentName = '';
            finalRequestedAgentId = selectedAgentId;
            finalRequestedAgentName = chosenName;
            finalAgentRejectionReason = '';
          }
        }
      }
    } else {
      // Si el editor es el Agente responsable a cargo de la propiedad:
      finalManagementMode = editingProperty?.managementMode || 'con_agente';
      finalRequestType = editingProperty?.agentRequestType || 'elegir_agente';
      finalStatus = 'asignado';
      finalAgentId = editingProperty?.agentId || currentUser?.uid || '';
      finalAgentName = editingProperty?.agentName || currentUser?.displayName || '';
      finalRequestedAgentId = editingProperty?.requestedAgentId || currentUser?.uid || '';
      finalRequestedAgentName = editingProperty?.requestedAgentName || currentUser?.displayName || '';
    }

    setSaving(true);
    try {
      await onSave(
        {
          title: truncateText(title, SCHEMA_LIMITS.PROP_TITLE_MAX),
          description: truncateText(description, SCHEMA_LIMITS.PROP_DESC_MAX),
          location: truncateText(location, SCHEMA_LIMITS.PROP_LOC_MAX),
          address: truncateText(address, SCHEMA_LIMITS.PROP_ADDR_MAX),
          operationType,
          propertyType,
          price: Math.max(1, Number(price) || 1000),
          currency,
          surface: Math.max(10, Number(surface) || 50),
          rooms: Math.max(1, Number(rooms) || 1),
          bedrooms: Math.max(0, Number(bedrooms) || 1),
          bathrooms: Math.max(1, Number(bathrooms) || 1),
          features: selectedFeatures.slice(0, SCHEMA_LIMITS.PROP_FEATURES_MAX),
          images: selectedImages.slice(0, SCHEMA_LIMITS.PROP_IMAGES_MAX),
          availability,
          managementMode: finalManagementMode,
          agentRequestType: finalRequestType,
          agentAssignmentStatus: finalStatus,
          agentId: finalAgentId,
          agentName: finalAgentName,
          requestedAgentId: finalRequestedAgentId,
          requestedAgentName: finalRequestedAgentName,
          agentRejectionReason: finalAgentRejectionReason,
        },
        editingProperty?.id
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F241F]/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FCFBF7] border border-[#D8C7AA] rounded-md overflow-hidden my-8 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[#39483A] text-[#FCFBF7] shrink-0">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#D8C7AA] font-semibold block">
              Mis Propiedades · ClaveHogar
            </span>
            <h2 className="text-xl font-serif-display font-semibold">
              {editingProperty
                ? 'Editar Propiedad Registrada'
                : 'Publicar Nueva Propiedad'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#D8C7AA] hover:text-[#FCFBF7] rounded-sm hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {!editingProperty && currentUser?.role !== 'administrador' && (
            <div className="p-3.5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm text-xs text-[#39483A]">
              <strong>Nota sobre revisión:</strong> Al publicar tu propiedad, quedará en estado{' '}
              <strong className="text-[#B86F52]">Pendiente de revisión</strong> hasta que el administrador la apruebe para aparecer públicamente en el catálogo.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Título de la publicación *
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={SCHEMA_LIMITS.PROP_TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Casa Moderna de 3 Habitaciones con Pileta en Quilmes"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Tipo de operación *
              </label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value as OperationTypeChoice)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
              >
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Tipo de inmueble *
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
              >
                {propertyTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Ciudad / Localidad / Barrio *
              </label>
              <input
                type="text"
                required
                maxLength={SCHEMA_LIMITS.PROP_LOC_MAX}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej. Quilmes, Zona Sur / Palermo, CABA"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Dirección exacta *
              </label>
              <input
                type="text"
                required
                maxLength={SCHEMA_LIMITS.PROP_ADDR_MAX}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Alvear 840, Quilmes"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#39483A] mb-1">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'ARS')}
                  className="w-full px-2.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-[#39483A] mb-1">Precio *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ej. 185000"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular focus:outline-none focus:border-[#39483A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">
                Estado de disponibilidad
              </label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm"
              >
                <option value="disponible">Disponible</option>
                <option value="reservada">Reservada</option>
                <option value="alquilada">Alquilada</option>
                <option value="vendida">Vendida</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">Superficie (m²) *</label>
              <input
                type="number"
                required
                min={10}
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                placeholder="180"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">Ambientes *</label>
              <input
                type="number"
                required
                min={1}
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                placeholder="3"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">Habitaciones *</label>
              <input
                type="number"
                required
                min={0}
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="2"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#39483A] mb-1">Baños *</label>
              <input
                type="number"
                required
                min={1}
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="2"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#39483A] mb-1">
              Descripción completa de la propiedad *
            </label>
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={SCHEMA_LIMITS.PROP_DESC_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe distribución, orientación, estado general, jardín, pileta..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
            />
          </div>

          {/* =================================================================
              MODALIDAD DE GESTIÓN Y ASIGNACIÓN OPCIONAL DE AGENTE
             ================================================================= */}
          {!isAgentEditor && (
            <div className="p-5 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#B86F52] font-semibold block">
                  Modalidad de Administración (Opcional)
                </span>
                <h3 className="text-base font-serif-display font-semibold text-[#39483A]">
                  ¿Cómo querés gestionar esta propiedad?
                </h3>
                <p className="text-xs text-[#39483A]/80 mt-0.5">
                  Podés administrarla por tu cuenta o solicitar la asistencia de un agente inmobiliario.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setManagementMode('directa');
                    setAgentRequestType('ninguna');
                  }}
                  className={`p-3.5 rounded-sm border text-left transition-colors ${
                    managementMode === 'directa'
                      ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                      : 'bg-[#FCFBF7] text-[#1F241F] border-[#D8C7AA] hover:border-[#39483A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      1. Propietario Independiente
                    </span>
                    {managementMode === 'directa' && <Check className="w-4 h-4 text-[#D8C7AA]" />}
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      managementMode === 'directa' ? 'text-[#FCFBF7]/85' : 'text-[#39483A]/80'
                    }`}
                  >
                    Administro mi propiedad por mi cuenta y recibo consultas, visitas y ofertas directamente.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManagementMode('con_agente');
                    if (agentRequestType === 'ninguna') {
                      setAgentRequestType('elegir_agente');
                      if (!selectedAgentId && availableAgents[0]) {
                        setSelectedAgentId(availableAgents[0].uid);
                      }
                    }
                  }}
                  className={`p-3.5 rounded-sm border text-left transition-colors ${
                    managementMode === 'con_agente'
                      ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                      : 'bg-[#FCFBF7] text-[#1F241F] border-[#D8C7AA] hover:border-[#39483A]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      2. Trabajar con un Agente
                    </span>
                    {managementMode === 'con_agente' && <Check className="w-4 h-4 text-[#D8C7AA]" />}
                  </div>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      managementMode === 'con_agente' ? 'text-[#FCFBF7]/85' : 'text-[#39483A]/80'
                    }`}
                  >
                    Solicito asistencia profesional para gestionar consultas, coordinar visitas y seguir la operación.
                  </p>
                </button>
              </div>

              {managementMode === 'con_agente' && (
                <div className="pt-3 border-t border-[#D8C7AA] space-y-3">
                  <div className="text-xs font-semibold text-[#39483A]">
                    Elegí cómo solicitar tu agente inmobiliario:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAgentRequestType('elegir_agente');
                        if (!selectedAgentId && availableAgents[0]) {
                          setSelectedAgentId(availableAgents[0].uid);
                        }
                      }}
                      className={`p-3 rounded-sm border text-left flex items-start gap-2.5 transition-colors ${
                        agentRequestType === 'elegir_agente'
                          ? 'bg-white border-[#39483A] ring-1 ring-[#39483A]'
                          : 'bg-[#FCFBF7] border-[#D8C7AA]'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-[#B86F52] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#1F241F]">
                          Opción A: Elegir un agente disponible
                        </div>
                        <div className="text-[11px] text-[#39483A]/75 mt-0.5">
                          Consultá los perfiles disponibles y seleccioná uno. Quedará pendiente hasta que acepte o el administrador confirme.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAgentRequestType('asignacion_admin')}
                      className={`p-3 rounded-sm border text-left flex items-start gap-2.5 transition-colors ${
                        agentRequestType === 'asignacion_admin'
                          ? 'bg-white border-[#39483A] ring-1 ring-[#39483A]'
                          : 'bg-[#FCFBF7] border-[#D8C7AA]'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-[#B86F52] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-semibold text-[#1F241F]">
                          Opción B: Que me asignen uno
                        </div>
                        <div className="text-[11px] text-[#39483A]/75 mt-0.5">
                          El administrador recibe tu solicitud y te asigna un agente inmobiliario matriculado.
                        </div>
                      </div>
                    </button>
                  </div>

                  {agentRequestType === 'elegir_agente' && (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs font-semibold text-[#39483A]">
                        Perfiles de Agentes Disponibles ({availableAgents.length}):
                      </div>
                      {availableAgents.length === 0 ? (
                        <p className="text-xs text-[#B86F52]">
                          No hay agentes activos en este momento. Podés elegir &ldquo;Que me asignen uno&rdquo;.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                          {availableAgents.map((ag) => {
                            const isSelected = selectedAgentId === ag.uid;
                            return (
                              <div
                                key={ag.uid}
                                onClick={() => setSelectedAgentId(ag.uid)}
                                className={`p-3 rounded-sm border cursor-pointer transition-colors flex items-start gap-3 ${
                                  isSelected
                                    ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                                    : 'bg-white text-[#1F241F] border-[#D8C7AA] hover:border-[#39483A]'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#D8C7AA] text-[#39483A] flex items-center justify-center shrink-0">
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
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-semibold truncate">
                                      {ag.displayName}
                                    </span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#D8C7AA] shrink-0" />}
                                  </div>
                                  <div
                                    className={`text-[11px] truncate ${
                                      isSelected ? 'text-[#D8C7AA]' : 'text-[#B86F52]'
                                    }`}
                                  >
                                    {ag.agencyName || 'Agente Inmobiliario'}
                                  </div>
                                  <div
                                    className={`text-[10px] font-tabular truncate ${
                                      isSelected ? 'text-[#FCFBF7]/80' : 'text-[#39483A]/75'
                                    }`}
                                  >
                                    {ag.email} · {ag.phone}
                                  </div>
                                  {ag.bio && (
                                    <p
                                      className={`text-[10px] line-clamp-2 pt-0.5 ${
                                        isSelected ? 'text-[#FCFBF7]/85' : 'text-[#39483A]/75'
                                      }`}
                                    >
                                      {ag.bio}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Features selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#39483A]">
              Características y comodidades del inmueble
            </label>
            <div className="flex flex-wrap gap-2">
              {availableFeatures.map((feat) => {
                const active = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleFeature(feat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
                      active
                        ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                        : 'bg-white text-[#39483A] border-[#D8C7AA] hover:bg-[#F5F1E8]'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    {feat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real Device File Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#39483A]">
                Fotografías del inmueble ({selectedImages.length} / {SCHEMA_LIMITS.PROP_IMAGES_MAX}) *
              </label>
              <span className="text-[11px] text-[#39483A]/60">
                Formatos JPG, PNG o WEBP desde tu dispositivo
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelection}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[#A8B5A0] hover:border-[#39483A] bg-[#F5F1E8]/60 hover:bg-[#F5F1E8] rounded-sm p-6 text-center cursor-pointer transition-colors"
            >
              <UploadCloud className="w-7 h-7 text-[#39483A] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#39483A]">
                {uploadingFiles
                  ? 'Procesando imágenes seleccionadas...'
                  : 'Hacé clic aquí para adjuntar fotos desde tu dispositivo'}
              </p>
              <p className="text-xs text-[#39483A]/70 mt-1">
                Seleccioná una o varias fotografías reales de la propiedad
              </p>
            </div>

            {selectedImages.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-[#B86F52] bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm px-3.5 py-2.5">
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>Aún no has subido fotografías. Seleccioná al menos una imagen de tu dispositivo.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {selectedImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[4/3] rounded-sm overflow-hidden border border-[#D8C7AA] bg-[#F5F1E8]"
                  >
                    <img
                      src={imgUrl}
                      alt={`Fotografía subida ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-2 right-2 p-1.5 rounded-sm bg-[#B86F52] text-[#FCFBF7] hover:bg-[#9e5b40] transition-colors"
                      title="Eliminar fotografía"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 bg-[#39483A]/85 text-[#FCFBF7] text-[10px] px-2 py-0.5 rounded-sm font-tabular">
                      Foto #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D8C7AA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingFiles}
              className="px-6 py-2.5 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors disabled:opacity-50"
            >
              {saving
                ? 'Guardando...'
                : editingProperty
                ? 'Guardar Cambios'
                : 'Publicar Propiedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
