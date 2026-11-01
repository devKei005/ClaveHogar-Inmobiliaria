import React from 'react';
import { X, Check, Minus, ArrowRight, ArrowLeftRight } from 'lucide-react';
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
  if (comparedProperties.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="card-floating bg-white border border-[#D5BFA0] rounded-2xl p-12 text-center max-w-xl mx-auto space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#F8F6F1] border border-[#D5BFA0] mx-auto flex items-center justify-center text-[#173B43]">
            <ArrowLeftRight className="w-5 h-5 text-[#C87955]" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#C87955] font-semibold block">
            Comparador de Inmuebles
          </span>
          <h2 className="text-3xl font-serif-display font-semibold text-[#303638]">
            Contrastá propiedades lado a lado
          </h2>
          <p className="text-sm text-[#303638]/80 leading-relaxed">
            Seleccioná propiedades desde el catálogo o el buscador inteligente con el botón de flechas de comparación para contrastar valores, superficie, ubicación y comodidades.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wider font-semibold text-white bg-[#173B43] hover:bg-[#122e35] rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>Explorar Catálogo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D5BFA0] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-[#C87955]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C87955] block">
              Análisis Comparativo
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif-display font-semibold text-[#303638]">
            Matriz Comparativa de Propiedades
          </h1>
          <p className="text-sm text-[#173B43]/75 mt-1">
            Comparando {comparedProperties.length}{' '}
            {comparedProperties.length === 1 ? 'propiedad seleccionada' : 'propiedades seleccionadas'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-4 py-2.5 text-xs font-semibold text-[#173B43] bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm hover:bg-[#F8F6F1] transition-colors whitespace-nowrap"
          >
            + Agregar otra propiedad
          </button>
          <button
            type="button"
            onClick={onClearCompare}
            className="px-4 py-2.5 text-xs font-semibold text-[#B86F52] bg-[#FCFBF7] border border-[#B86F52]/40 rounded-sm hover:bg-[#B86F52]/10 transition-colors whitespace-nowrap"
          >
            Limpiar comparador
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-[#FCFBF7] border border-[#D5BFA0] rounded-sm">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-[#D5BFA0]">
              <th className="p-5 w-52 bg-[#F8F6F1] text-xs uppercase tracking-wider font-semibold text-[#173B43] align-top">
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
