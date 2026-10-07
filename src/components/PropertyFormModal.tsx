import React, { useState, useRef } from 'react';
import { X, UploadCloud, Trash2, Check, Image as ImageIcon } from 'lucide-react';
import {
  PropertyItem,
  OperationTypeChoice,
  AvailabilityStatus,
  CategoryConfigItem,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';

interface PropertyFormModalProps {
  isOpen: boolean;
  editingProperty: PropertyItem | null;
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

  const [title, setTitle] = useState(editingProperty?.title || '');
  const [description, setDescription] = useState(editingProperty?.description || '');
  const [location, setLocation] = useState(editingProperty?.location || '');
  const [address, setAddress] = useState(editingProperty?.address || '');
  const [operationType, setOperationType] = useState<OperationTypeChoice>(
    editingProperty?.operationType || 'venta'
  );
  const [propertyType, setPropertyType] = useState(
    editingProperty?.propertyType || propertyTypes[0] || 'Casa'
  );
  const [price, setPrice] = useState(String(editingProperty?.price || ''));
  const [currency, setCurrency] = useState<'USD' | 'ARS'>(editingProperty?.currency || 'USD');
  const [surface, setSurface] = useState(String(editingProperty?.surface || ''));
  const [rooms, setRooms] = useState(String(editingProperty?.rooms || '3'));
  const [bedrooms, setBedrooms] = useState(String(editingProperty?.bedrooms || '2'));
  const [bathrooms, setBathrooms] = useState(String(editingProperty?.bathrooms || '2'));
  const [availability, setAvailability] = useState<AvailabilityStatus>(
    editingProperty?.availability || 'disponible'
  );
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    editingProperty?.features || []
  );
  const [selectedImages, setSelectedImages] = useState<string[]>(
    editingProperty?.images || []
  );
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

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
          agentId: editingProperty?.agentId,
          agentName: editingProperty?.agentName,
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
              Registro de Inmuebles
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
