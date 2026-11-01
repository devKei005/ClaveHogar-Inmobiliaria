import React, { useState } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  Calendar,
  DollarSign,
  User,
  ShieldCheck,
  Building,
  Info,
  KeyRound,
  FileCheck,
} from 'lucide-react';
import { OperationItem, PropertyItem, ContractItem, UserProfile } from '../types';

interface ContractRegistrationModalProps {
  operation: OperationItem;
  property?: PropertyItem;
  currentUser: UserProfile;
  onClose: () => void;
  onConfirmContract: (
    contractData: Omit<ContractItem, 'id' | 'createdAtIso'>
  ) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

export const ContractRegistrationModal: React.FC<ContractRegistrationModalProps> = ({
  operation,
  property,
  currentUser,
  onClose,
  onConfirmContract,
  onNotify,
}) => {
  const isRental = operation.operationType === 'alquiler';

  // Auto-generate contract code (CTR-YEAR-RANDOM5)
  const [contractCode] = useState<string>(() => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `CTR-${year}-${rand}`;
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Form states
  const [finalPrice, setFinalPrice] = useState<string>(
    String(operation.counterOffer?.amount || operation.offeredAmount || 0)
  );
  const [finalCurrency, setFinalCurrency] = useState<'USD' | 'ARS'>(
    operation.counterOffer?.currency || operation.currency || 'USD'
  );

  const [closingDate, setClosingDate] = useState<string>(todayStr);

  // Proposal Summary Component
  const renderProposalSummary = () => (
    <div className="p-4 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-2 mb-6">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#173B43]">Resumen de términos acordados:</h4>
      <p className="text-sm text-[#1F241F]">
        <span className="font-semibold">Monto:</span> {operation.counterOffer?.amount || operation.offeredAmount} {operation.counterOffer?.currency || operation.currency}
      </p>
      <p className="text-sm text-[#1F241F]">
        <span className="font-semibold">Condiciones:</span> {operation.counterOffer?.conditions || operation.conditions || 'Sin condiciones especiales'}
      </p>
      {operation.operationType === 'alquiler' && (
        <p className="text-sm text-[#1F241F]">
          <span className="font-semibold">Plazo:</span> {operation.desiredTerm || '24 meses'}
        </p>
      )}
    </div>
  );

  // Rental specific dates
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2); // default 24 months
    return d.toISOString().split('T')[0];
  });
  const [contractTermMonths, setContractTermMonths] = useState<number>(() => {
    if (operation.desiredTerm) {
      const parsed = parseInt(operation.desiredTerm, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 24;
  });

  // Purchase specific possession date
  const [possessionDate, setPossessionDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const signedContractDocRef = `Contrato_Firmado_${operation.operationType}_${contractCode}.pdf`;

  const [contractTerms, setContractTerms] = useState<string>(() => {
    const finalAmount = operation.counterOffer?.amount || operation.offeredAmount;
    const finalCurrency = operation.counterOffer?.currency || operation.currency;
    const conditions = operation.counterOffer?.conditions || operation.conditions || operation.message || 'Sin observaciones';

    if (isRental) {
      return `Contrato de alquiler por ${operation.propertyTitle}.\nMonto propuesto / aceptado: ${finalAmount} ${finalCurrency}.\nCondiciones pactadas entre ambas partes:\n${conditions}\nGarantía: ${operation.guaranteeType || 'Acordada'}.\nIngresos declarados: ${operation.declaredIncome || 'Verificados'}`;
    }
    return `Contrato de compraventa por ${operation.propertyTitle}.\nMonto propuesto / aceptado: ${finalAmount} ${finalCurrency}.\nCondiciones pactadas entre ambas partes:\n${conditions}\nForma de pago: ${operation.paymentMethod || 'Acordada'}`;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const priceNum = Number(finalPrice);
    if (!priceNum || priceNum <= 0) {
      onNotify('error', 'Monto inválido', 'El precio final acordado debe ser mayor a 0.');
      return;
    }

    if (!closingDate) {
      onNotify('error', 'Campo obligatorio', 'Seleccioná la fecha de cierre / firma del contrato.');
      return;
    }

    if (isRental) {
      if (!startDate) {
        onNotify('error', 'Campo obligatorio', 'Seleccioná la fecha de inicio del alquiler.');
        return;
      }
      if (!endDate) {
        onNotify('error', 'Campo obligatorio', 'Seleccioná la fecha de finalización del alquiler.');
        return;
      }
      if (endDate <= startDate) {
        onNotify(
          'error',
          'Rango de fechas inválido',
          'La fecha de finalización debe ser posterior a la fecha de inicio.'
        );
        return;
      }
    } else {
      if (!possessionDate) {
        onNotify(
          'error',
          'Campo obligatorio',
          'Seleccioná la fecha de toma de posesión / escrituración.'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const contractData: Omit<ContractItem, 'id' | 'createdAtIso'> = {
        operationId: operation.id,
        propertyId: operation.propertyId,
        propertyTitle: operation.propertyTitle,
        operationType: operation.operationType,
        contractCode,
        finalPrice: priceNum,
        finalCurrency,
        ownerId: operation.ownerId,
        ownerName: property?.ownerName || 'Propietario',
        clientId: operation.clientId,
        clientName: operation.clientName,
        agentId: operation.agentId || property?.agentId,
        agentName: property?.agentName,
        closingDate,
        ...(isRental
          ? {
              startDate,
              endDate,
              contractTermMonths: `${contractTermMonths} meses`,
            }
          : {
              possessionDate,
            }),
        signedContractDocRef,
        contractTerms: contractTerms.trim(),
      };

      await onConfirmContract(contractData);
    } catch (err: any) {
      console.error('Error registering contract:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1F241F]/70 p-4 overflow-y-auto backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[#FCFBF7] border-2 border-[#173B43] rounded-md overflow-hidden my-8 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#173B43] text-[#FCFBF7] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-6 h-6 text-[#D5BFA0]" />
            <div>
              <h2 className="text-xl font-serif-display font-semibold text-white">
                Registrar Contrato Definitivo y Concretar Operación
              </h2>
              <p className="text-xs text-[#D5BFA0]">
                Documentación formal de {isRental ? 'Alquiler' : 'Compraventa'} · {operation.propertyTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-[#D5BFA0] hover:text-[#FCFBF7] hover:bg-white/10 rounded-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {renderProposalSummary()}
          {/* Information Notice */}
          <div className="p-4 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#173B43] shrink-0 mt-0.5" />
            <div className="text-xs text-[#173B43] space-y-1">
              <span className="font-bold block text-sm">Propuesta Aceptada Previamente</span>
              <p className="leading-relaxed">
                Al confirmar el registro de este contrato, la operación cambiará al estado{' '}
                <strong>CONCRETADA</strong> y la disponibilidad del inmueble se actualizará
                a <strong>{isRental ? 'ALQUILADA' : 'VENDIDA'}</strong>, ocultándola del catálogo público
                y conservando la propiedad, el contrato y el historial en la base de datos.
              </p>
            </div>
          </div>

          {/* Section 1: Parties & Operation Type */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#173B43] flex items-center gap-1.5 border-b border-[#D5BFA0] pb-1.5">
              <User className="w-4 h-4 text-[#B86F52]" />
              <span>1. Tipo de Operación y Partes Involucradas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm">
                <span className="text-[10px] uppercase font-bold text-[#B86F52] block">
                  Tipo de Operación
                </span>
                <span className="text-sm font-semibold text-[#1F241F] capitalize">
                  {operation.operationType}
                </span>
              </div>
              <div className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm">
                <span className="text-[10px] uppercase font-bold text-[#B86F52] block">
                  {isRental ? 'Inquilino / Cliente' : 'Comprador / Cliente'}
                </span>
                <span className="text-sm font-semibold text-[#1F241F]">
                  {operation.clientName}
                </span>
              </div>
              <div className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm">
                <span className="text-[10px] uppercase font-bold text-[#B86F52] block">
                  Propietario / Agente
                </span>
                <span className="text-sm font-semibold text-[#1F241F]">
                  {property?.agentName || property?.ownerName || 'Responsable'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Agreement */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#173B43] flex items-center gap-1.5 border-b border-[#D5BFA0] pb-1.5">
              <DollarSign className="w-4 h-4 text-[#B86F52]" />
              <span>2. Precio Final Acordado y Moneda</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">
                  Monto Final Acordado *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43]"
                />
                <span className="text-[11px] text-[#173B43]/70 block">
                  Importe definitivo pactado entre el cliente y la parte vendedora/locadora (por defecto el monto de la propuesta).
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">Moneda *</label>
                <select
                  value={finalCurrency}
                  onChange={(e) => setFinalCurrency(e.target.value as 'USD' | 'ARS')}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                >
                  <option value="USD">USD (Dólares)</option>
                  <option value="ARS">ARS (Pesos Argentinos)</option>
                </select>
                <span className="text-[11px] text-[#173B43]/70 block">
                  Moneda en que se instrumenta.
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Contractual Dates */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#173B43] flex items-center gap-1.5 border-b border-[#D5BFA0] pb-1.5">
              <Calendar className="w-4 h-4 text-[#B86F52]" />
              <span>3. Fechas y Plazos del Contrato</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">
                  Fecha de Cierre / Firma *
                </label>
                <input
                  type="date"
                  required
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                />
                <span className="text-[11px] text-[#173B43]/70 block">
                  Fecha efectiva de firma del instrumento.
                </span>
              </div>

              {isRental ? (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Fecha Inicio de Alquiler *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                    />
                    <span className="text-[11px] text-[#173B43]/70 block">
                      Comienzo de la vigencia del alquiler.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Fecha Fin de Alquiler *
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                    />
                    <span className="text-[11px] text-[#173B43]/70 block">
                      Vencimiento del plazo contractual.
                    </span>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-[#173B43]">
                    Fecha de Posesión / Escritura *
                  </label>
                  <input
                    type="date"
                    required
                    value={possessionDate}
                    onChange={(e) => setPossessionDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                  />
                  <span className="text-[11px] text-[#173B43]/70 block">
                    Fecha estimada o efectiva de toma de posesión / escritura traslativa de dominio.
                  </span>
                </div>
              )}
            </div>

            {isRental && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">
                  Plazo Contractual Registrado *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={contractTermMonths}
                    onChange={(e) => setContractTermMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-32 px-3.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43]"
                  />
                  <span className="text-xs font-semibold text-[#173B43] shrink-0">
                    meses
                  </span>
                </div>
                <span className="text-[11px] text-[#173B43]/70 block">
                  Duración en cantidad de meses acordada para el contrato de alquiler.
                </span>
              </div>
            )}
          </div>

          {/* Section 4: Identificación y Términos */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#173B43] flex items-center gap-1.5 border-b border-[#D5BFA0] pb-1.5">
              <KeyRound className="w-4 h-4 text-[#B86F52]" />
              <span>4. Identificación y Términos del Contrato</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#173B43]">
                Número de Contrato (Auto-generado)
              </label>
              <input
                type="text"
                readOnly
                value={contractCode}
                className="w-full px-3.5 py-2 text-xs bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm font-tabular font-bold text-[#173B43] cursor-not-allowed"
              />
              <span className="text-[11px] text-[#173B43]/70 block">
                Código unívoco del instrumento asignado por el sistema.
              </span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#173B43]">
                Términos y Cláusulas Definitivas
              </label>
              <textarea
                rows={3}
                value={contractTerms}
                onChange={(e) => setContractTerms(e.target.value)}
                placeholder="Resumen de condiciones especiales, depósitos, actualizaciones..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
              />
              <span className="text-[11px] text-[#173B43]/70 block">
                Detalle sintético de las condiciones contractuales acordadas.
              </span>
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-[#D5BFA0] flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] hover:bg-[#D5BFA0]/40 rounded-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting ? 'Registrando y concretando...' : 'Guardar y Concretar Operación'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
