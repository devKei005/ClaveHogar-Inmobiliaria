import React, { useState, useEffect } from 'react';
import { X, Check, Minus, ArrowRight, ArrowLeftRight, Plus } from 'lucide-react';
import { PropertyItem } from '../types';
import { HERO_IMAGE, resolvePropertyImageUrl } from '../data/initialData';

interface ComparatorViewProps {
  comparedProperties: PropertyItem[];
  allFeatures: string[];
  onRemoveFromCompare: (id: string) => void;
  onClearCompare: () => void;
  onSelectProperty: (property: PropertyItem) => void;
  onGoToCatalog: () => void;
}

export const ComparatorView: React.FC<ComparatorViewProps> = ({
  comparedProperties,
  allFeatures,
  onRemoveFromCompare,
  onClearCompare,
  onSelectProperty,
  onGoToCatalog,
}) => {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);

  useEffect(() => {
    if (comparedProperties.length === 0) {
      setLeftIndex(0);
      setRightIndex(1);
      return;
    }
    if (leftIndex >= comparedProperties.length) {
      setLeftIndex(0);
    }
    if (comparedProperties.length >= 2) {
      if (rightIndex >= comparedProperties.length || rightIndex === leftIndex) {
        const next = comparedProperties.findIndex((_, idx) => idx !== Math.min(leftIndex, comparedProperties.length - 1));
        setRightIndex(next >= 0 ? next : 0);
      }
    } else {
      setRightIndex(0);
    }
  }, [comparedProperties.length, leftIndex, rightIndex]);

  if (comparedProperties.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <div className="card-floating bg-white border border-[#D5BFA0] rounded-2xl p-6 sm:p-12 text-center max-w-xl mx-auto space-y-4 sm:space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#F8F6F1] border border-[#D5BFA0] mx-auto flex items-center justify-center text-[#173B43]">
            <ArrowLeftRight className="w-5 h-5 text-[#C87955]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#C87955] font-semibold block">
            Comparador de Inmuebles
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-display font-semibold text-[#303638]">
            Contrastá propiedades lado a lado
          </h2>
          <p className="text-xs sm:text-sm text-[#303638]/80 leading-relaxed">
            Seleccioná propiedades desde el catálogo o el buscador inteligente con el botón de flechas de comparación para contrastar valores, superficie, ubicación y comodidades.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-xs uppercase tracking-wider font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>Explorar Catálogo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  const safeLeftIdx = Math.min(leftIndex, comparedProperties.length - 1);
  const safeRightIdx =
    comparedProperties.length > 1
      ? Math.min(rightIndex === safeLeftIdx ? (safeLeftIdx === 0 ? 1 : 0) : rightIndex, comparedProperties.length - 1)
      : -1;

  const mobileLeftProp = comparedProperties[safeLeftIdx];
  const mobileRightProp = safeRightIdx >= 0 ? comparedProperties[safeRightIdx] : null;
  const mobilePair: (PropertyItem | null)[] = [mobileLeftProp, mobileRightProp];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-12 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 border-b border-[#D5BFA0] pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-[#C87955]" />
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C87955] block">
              Análisis Comparativo
            </span>
          </div>
          <h1 className="text-xl sm:text-4xl font-serif-display font-semibold text-[#303638]">
            Matriz Comparativa de Propiedades
          </h1>
          <p className="text-xs sm:text-sm text-[#173B43]/75 mt-1">
            Comparando {comparedProperties.length}{' '}
            {comparedProperties.length === 1 ? 'propiedad seleccionada' : 'propiedades seleccionadas'}.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-[#173B43] bg-[#FCFBF7] border border-[#D5BFA0] rounded-lg sm:rounded-sm hover:bg-[#F8F6F1] transition-colors text-center truncate"
          >
            + Agregar otra
          </button>
          <button
            type="button"
            onClick={onClearCompare}
            className="px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-[#B86F52] bg-[#FCFBF7] border border-[#B86F52]/40 rounded-lg sm:rounded-sm hover:bg-[#B86F52]/10 transition-colors text-center truncate"
          >
            Limpiar comparador
          </button>
        </div>
      </div>

      {/* ===================================================================
          VISTA MÓVIL ADAPTADA AL ANCHO DEL CELULAR (SIN DESFASE HORIZONTAL)
         =================================================================== */}
      <div className="md:hidden space-y-3">
        {comparedProperties.length > 2 && (
          <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-xl p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#173B43]/75">
              Elegí qué 2 propiedades contrastar en pantalla ({comparedProperties.length} en lista):
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={safeLeftIdx}
                onChange={(e) => setLeftIndex(Number(e.target.value))}
                className="w-full min-w-0 px-2 py-1.5 text-[11px] font-semibold bg-white border border-[#D5BFA0] rounded-lg text-[#173B43] truncate"
                aria-label="Seleccionar propiedad izquierda"
              >
                {comparedProperties.map((p, idx) => (
                  <option key={p.id} value={idx} disabled={idx === safeRightIdx}>
                    1: {p.title}
                  </option>
                ))}
              </select>
              <select
                value={safeRightIdx}
                onChange={(e) => setRightIndex(Number(e.target.value))}
                className="w-full min-w-0 px-2 py-1.5 text-[11px] font-semibold bg-white border border-[#D5BFA0] rounded-lg text-[#173B43] truncate"
                aria-label="Seleccionar propiedad derecha"
              >
                {comparedProperties.map((p, idx) => (
                  <option key={p.id} value={idx} disabled={idx === safeLeftIdx}>
                    2: {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Cabecera de 2 propiedades lado a lado */}
        <div className="grid grid-cols-2 gap-2">
          {mobilePair.map((prop, colIdx) =>
            prop ? (
              <div
                key={prop.id}
                className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-xl overflow-hidden flex flex-col justify-between p-2 space-y-2 shadow-2xs min-w-0"
              >
                <div className="space-y-1.5">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-[#F8F6F1]">
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
                    <button
                      type="button"
                      onClick={() => onRemoveFromCompare(prop.id)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-[#173B43]/90 text-[#FCFBF7] hover:bg-[#B86F52] transition-colors"
                      title="Quitar de la comparación"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-[#B86F52] font-bold truncate">
                    {prop.propertyType} · {prop.operationType === 'alquiler' ? 'Alquiler' : 'Venta'}
                  </div>
                  <div className="text-xs font-serif-display font-semibold text-[#1F241F] line-clamp-2 min-h-[2rem] leading-tight">
                    {prop.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectProperty(prop)}
                  className="w-full py-1.5 px-2 text-[10px] font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-lg transition-colors"
                >
                  Ver Ficha
                </button>
              </div>
            ) : (
              <button
                key={`empty-col-${colIdx}`}
                type="button"
                onClick={onGoToCatalog}
                className="bg-[#F8F6F1]/70 border-2 border-dashed border-[#D5BFA0] rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 min-h-[160px] text-[#173B43]/75 hover:border-[#173B43] transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-white border border-[#D5BFA0] flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#C87955]" />
                </div>
                <span className="text-[11px] font-semibold leading-snug">
                  Agregá otra propiedad para comparar
                </span>
              </button>
            )
          )}
        </div>

        {/* Matriz comparativa apilada por especificación en 2 columnas fijas */}
        <div className="bg-[#FCFBF7] border border-[#D5BFA0] rounded-xl overflow-hidden divide-y divide-[#D5BFA0]/60">
          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Valor publicado
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-xs">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `price-${i}`} className="p-2.5 font-semibold font-tabular text-[#173B43] break-words">
                  {prop ? `${prop.currency} ${prop.price.toLocaleString()}` : '—'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Valor por m²
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `pm2-${i}`} className="p-2.5 font-tabular text-[#1F241F]/85 break-words">
                  {prop ? `${prop.currency} ${Math.round(prop.price / Math.max(1, prop.surface)).toLocaleString()} / m²` : '—'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Ubicación
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `loc-${i}`} className="p-2.5 text-[#1F241F] min-w-0">
                  {prop ? (
                    <>
                      <div className="font-semibold break-words">{prop.location}</div>
                      <div className="text-[10px] text-[#173B43]/70 break-words">{prop.address}</div>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Superficie total
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `sup-${i}`} className="p-2.5 font-tabular text-[#1F241F]">
                  {prop ? `${prop.surface} m²` : '—'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Distribución
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `dist-${i}`} className="p-2.5 font-tabular text-[#1F241F] leading-snug">
                  {prop ? `${prop.rooms} amb. · ${prop.bedrooms} dorm. · ${prop.bathrooms} baños` : '—'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Disponibilidad
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `disp-${i}`} className="p-2.5 capitalize font-semibold text-[#173B43]">
                  {prop ? prop.availability : '—'}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-bold text-[#173B43]">
              Responsable
            </div>
            <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
              {mobilePair.map((prop, i) => (
                <div key={prop ? prop.id : `resp-${i}`} className="p-2.5 text-[#173B43]/85 break-words">
                  {prop ? (prop.agentName ? `Agente: ${prop.agentName}` : `Propietario: ${prop.ownerName}`) : '—'}
                </div>
              ))}
            </div>
          </div>

          {allFeatures.map((feat) => (
            <div key={feat}>
              <div className="px-2.5 py-1 bg-[#F8F6F1] text-[10px] uppercase tracking-wider font-semibold text-[#173B43]">
                {feat}
              </div>
              <div className="grid grid-cols-2 divide-x divide-[#D5BFA0]/60 text-[11px]">
                {mobilePair.map((prop, i) => {
                  if (!prop) {
                    return (
                      <div key={`feat-empty-${i}`} className="p-2.5 text-[#173B43]/40">
                        —
                      </div>
                    );
                  }
                  const has = prop.features.includes(feat);
                  return (
                    <div key={prop.id} className="p-2.5">
                      {has ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#173B43]">
                          <Check className="w-3.5 h-3.5 text-[#B86F52] shrink-0" /> Incluye
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#173B43]/40">
                          <Minus className="w-3.5 h-3.5 shrink-0" /> —
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================
          VISTA ESCRITORIO / TABLET LANDSCAPE (TABLA ORIGINAL PC)
         =================================================================== */}
      <div className="hidden md:block overflow-x-auto bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-[#D5BFA0]">
              <th className="p-3.5 sm:p-5 w-36 sm:w-52 bg-[#F8F6F1] text-xs uppercase tracking-wider font-semibold text-[#173B43] align-top">
                Especificación
              </th>
              {comparedProperties.map((prop) => (
                <th key={prop.id} className="p-5 align-top border-l border-[#D5BFA0] min-w-[240px]">
                  <div className="space-y-3">
                    <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-[#F8F6F1]">
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
                      <button
                        type="button"
                        onClick={() => onRemoveFromCompare(prop.id)}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-sm bg-[#173B43]/90 text-[#FCFBF7] hover:bg-[#B86F52] transition-colors"
                        title="Quitar de la comparación"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-[#B86F52] font-semibold">
                      {prop.propertyType} · {prop.operationType === 'alquiler' ? 'Alquiler' : 'Venta'}
                    </div>
                    <div className="text-base font-serif-display font-semibold text-[#1F241F] line-clamp-2 min-h-[2.75rem]">
                      {prop.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProperty(prop)}
                      className="w-full py-2.5 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors"
                    >
                      Ver Ficha Completa
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D5BFA0]/60 text-sm">
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Valor publicado</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] font-semibold font-tabular text-base text-[#173B43]">
                  {prop.currency} {prop.price.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Valor por m²</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] font-tabular text-[#1F241F]/80">
                  {prop.currency} {Math.round(prop.price / Math.max(1, prop.surface)).toLocaleString()} / m²
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Ubicación</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] text-[#1F241F]">
                  <div className="font-medium">{prop.location}</div>
                  <div className="text-xs text-[#173B43]/70">{prop.address}</div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Superficie total</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] font-tabular text-[#1F241F]">
                  {prop.surface} m²
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Distribución</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] font-tabular text-[#1F241F]">
                  {prop.rooms} amb. · {prop.bedrooms} dorm. · {prop.bathrooms} baños
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Disponibilidad</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] capitalize font-medium text-[#173B43]">
                  {prop.availability}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F8F6F1] font-medium text-[#173B43]">Responsable</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D5BFA0] text-xs text-[#173B43]/80">
                  {prop.agentName ? `Agente: ${prop.agentName}` : `Propietario: ${prop.ownerName}`}
                </td>
              ))}
            </tr>
            {allFeatures.map((feat) => (
              <tr key={feat}>
                <td className="p-3.5 bg-[#F8F6F1] text-xs font-medium text-[#173B43]">{feat}</td>
                {comparedProperties.map((prop) => {
                  const has = prop.features.includes(feat);
                  return (
                    <td key={prop.id} className="p-3.5 border-l border-[#D5BFA0]">
                      {has ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173B43]">
                          <Check className="w-4 h-4 text-[#B86F52]" /> Incluye
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#173B43]/40">
                          <Minus className="w-4 h-4" /> —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
