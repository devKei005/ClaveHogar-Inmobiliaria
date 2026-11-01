import React, { useState } from 'react';
import { X, RefreshCw, DollarSign, Send, ArrowRight } from 'lucide-react';
import { OperationItem, CounterOfferItem } from '../types';

interface CounterOfferModalProps {
  operation: OperationItem;
  onClose: () => void;
  onSubmitCounterOffer: (counterData: CounterOfferItem) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  proposedByRole: 'propietario' | 'agente';
}

export const CounterOfferModal: React.FC<CounterOfferModalProps> = ({
  operation,
  onClose,
  onSubmitCounterOffer,
  onNotify,
  proposedByRole,
}) => {
  const [counterAmount, setCounterAmount] = useState<string>(
    String(operation.counterOffer?.amount || operation.offeredAmount)
  );
  const [counterCurrency, setCounterCurrency] = useState<'USD' | 'ARS'>(
    operation.counterOffer?.currency || operation.currency || 'USD'
  );
  const [counterConditions, setCounterConditions] = useState<string>(
    operation.counterOffer?.conditions ||
      'Se proponen los siguientes ajustes en el valor y condiciones...'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(counterAmount);
    if (!numAmount || numAmount <= 0) {
      onNotify('error', 'Monto inválido', 'Ingresá un valor mayor a 0 para la contrapropuesta.');
      return;
    }
    if (!counterConditions.trim()) {
      onNotify('error', 'Condiciones requeridas', 'Explicá los términos o condiciones de tu propuesta.');
      return;
    }

    setIsSubmitting(true);
    try {
      const counterItem: CounterOfferItem = {
        amount: numAmount,
        currency: counterCurrency,
        conditions: counterConditions.trim(),
        proposedBy: proposedByRole,
        createdAtIso: new Date().toISOString(),
      };
      await onSubmitCounterOffer(counterItem);
    } catch (err) {
      console.error('Error submitting counter offer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1F241F]/70 p-4 overflow-y-auto backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-[#FCFBF7] border-2 border-[#173B43] rounded-md overflow-hidden my-8 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#173B43] text-[#FCFBF7]">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-[#D5BFA0]" />
            <div>
              <h2 className="text-lg font-serif-display font-semibold text-white">
                Proponer Otros Términos (Contrapropuesta)
              </h2>
              <p className="text-xs text-[#D5BFA0]">
                {operation.propertyTitle} · Cliente: {operation.clientName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#D5BFA0] hover:text-[#FCFBF7] hover:bg-white/10 rounded-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Reference of Original Client Proposal */}
          <div className="p-4 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-1 text-xs">
            <div className="font-bold text-[#173B43] uppercase tracking-wider text-[11px]">
              Propuesta recibida del cliente ({operation.clientName}):
            </div>
            <div className="text-sm font-semibold font-tabular text-[#1F241F]">
              {operation.currency} {operation.offeredAmount.toLocaleString()}
            </div>
            <p className="text-[#173B43]/85 italic">
              &ldquo;{operation.conditions || operation.message || 'Sin observaciones detalladas'}&rdquo;
            </p>
          </div>

          {/* Counter offer fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">
                  Nuevo Monto Propuesto *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#173B43]">Moneda *</label>
                <select
                  value={counterCurrency}
                  onChange={(e) => setCounterCurrency(e.target.value as 'USD' | 'ARS')}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#173B43]">
                Condiciones y Explicación de los Nuevos Términos *
              </label>
              <textarea
                rows={3}
                required
                value={counterConditions}
                onChange={(e) => setCounterConditions(e.target.value)}
                placeholder="Indicá ajustes en el precio, forma de pago, requisitos o fechas..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
              />
              <span className="text-[11px] text-[#173B43]/70 block">
                Esta propuesta le llegará al cliente para que pueda evaluarla y responder.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#D5BFA0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] hover:bg-[#D5BFA0]/40 rounded-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enviando...' : 'Enviar Contrapropuesta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
