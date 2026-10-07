import React from 'react';
import { X, Check, Minus, ArrowRight } from 'lucide-react';
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
        <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-md p-12 text-center max-w-xl mx-auto space-y-5">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
            Comparador de Inmuebles
          </span>
          <h2 className="text-3xl font-serif-display font-semibold text-[#39483A]">
            Contrastá propiedades lado a lado
          </h2>
          <p className="text-sm text-[#39483A]/80 leading-relaxed">
            Seleccioná hasta 4 propiedades desde el catálogo o el buscador inteligente para comparar valores, superficie, ubicación y características arquitectónicas.
          </p>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
          >
            Explorar Catálogo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D8C7AA] pb-6">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B86F52] block mb-1">
            Análisis Comparativo
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif-display font-semibold text-[#39483A]">
            Matriz Comparativa de Propiedades
          </h1>
          <p className="text-sm text-[#39483A]/75 mt-1">
            Comparando {comparedProperties.length}{' '}
            {comparedProperties.length === 1 ? 'propiedad seleccionada' : 'propiedades seleccionadas'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-4 py-2.5 text-xs font-semibold text-[#39483A] bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm hover:bg-[#F5F1E8] transition-colors whitespace-nowrap"
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

      <div className="overflow-x-auto bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-[#D8C7AA]">
              <th className="p-5 w-52 bg-[#F5F1E8] text-xs uppercase tracking-wider font-semibold text-[#39483A] align-top">
                Especificación
              </th>
              {comparedProperties.map((prop) => (
                <th key={prop.id} className="p-5 align-top border-l border-[#D8C7AA] min-w-[240px]">
                  <div className="space-y-3">
                    <div className="relative aspect-[4/3] rounded-sm overflow-hidden bg-[#F5F1E8]">
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
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-sm bg-[#39483A]/90 text-[#FCFBF7] hover:bg-[#B86F52] transition-colors"
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
                      className="w-full py-2.5 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                    >
                      Ver Ficha Completa
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8C7AA]/60 text-sm">
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Valor publicado</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] font-semibold font-tabular text-base text-[#39483A]">
                  {prop.currency} {prop.price.toLocaleString()}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Valor por m²</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] font-tabular text-[#1F241F]/80">
                  {prop.currency} {Math.round(prop.price / Math.max(1, prop.surface)).toLocaleString()} / m²
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Ubicación</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] text-[#1F241F]">
                  <div className="font-medium">{prop.location}</div>
                  <div className="text-xs text-[#39483A]/70">{prop.address}</div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Superficie total</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] font-tabular text-[#1F241F]">
                  {prop.surface} m²
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Distribución</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] font-tabular text-[#1F241F]">
                  {prop.rooms} amb. · {prop.bedrooms} dorm. · {prop.bathrooms} baños
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Disponibilidad</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] capitalize font-medium text-[#39483A]">
                  {prop.availability}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 bg-[#F5F1E8] font-medium text-[#39483A]">Responsable</td>
              {comparedProperties.map((prop) => (
                <td key={prop.id} className="p-4 border-l border-[#D8C7AA] text-xs text-[#39483A]/80">
                  {prop.agentName ? `Agente: ${prop.agentName}` : `Propietario: ${prop.ownerName}`}
                </td>
              ))}
            </tr>
            {allFeatures.map((feat) => (
              <tr key={feat}>
                <td className="p-3.5 bg-[#F5F1E8] text-xs font-medium text-[#39483A]">{feat}</td>
                {comparedProperties.map((prop) => {
                  const has = prop.features.includes(feat);
                  return (
                    <td key={prop.id} className="p-3.5 border-l border-[#D8C7AA]">
                      {has ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39483A]">
                          <Check className="w-4 h-4 text-[#B86F52]" /> Incluye
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#39483A]/40">
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
