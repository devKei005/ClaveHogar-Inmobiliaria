import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer';
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    const accepted = await install();
    if (accepted && onInstalled) {
      onInstalled();
    }
  };

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        title="Instalar aplicación ClaveHogar"
        className={
          variant === 'drawer'
            ? 'w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#122e35] rounded-sm transition-colors cursor-pointer'
            : 'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] text-[11px] sm:text-xs font-semibold text-[#173B43] bg-[#F8F6F1] hover:bg-white border border-[#D5BFA0] rounded-xl transition-colors cursor-pointer shadow-2xs whitespace-nowrap'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0 text-[#C87955]" />
        <span className={variant === 'header' ? 'hidden sm:inline' : ''}>Instalar App</span>
        {variant === 'header' && <span className="sm:hidden">App</span>}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Instalar en iPhone o iPad"
          className={
            variant === 'drawer'
              ? 'w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs uppercase tracking-wider font-semibold text-[#173B43] bg-white hover:bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm transition-colors cursor-pointer'
              : 'inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[38px] text-[11px] font-semibold text-[#173B43] bg-[#F8F6F1] hover:bg-white border border-[#D5BFA0] rounded-xl transition-colors cursor-pointer shadow-2xs whitespace-nowrap'
          }
        >
          <Download className="w-3.5 h-3.5 shrink-0 text-[#C87955]" />
          <span>Instalar</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F241F]/60 p-4">
            <div className="w-full max-w-sm bg-[#FCFBF7] border border-[#D5BFA0] rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 bg-[#173B43] text-[#FCFBF7]">
                <h3 className="text-base font-serif-display font-semibold text-white">
                  Instalar ClaveHogar en iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-[#D5BFA0] hover:text-white rounded-sm"
                  aria-label="Cerrar guía"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs text-[#303638] leading-relaxed">
                <p>Para instalar ClaveHogar como aplicación en tu iPhone o iPad desde Safari:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Tocá el botón{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-[#173B43]">
                      <Share className="w-3.5 h-3.5" /> Compartir
                    </span>{' '}
                    en la barra de Safari.
                  </li>
                  <li>
                    Deslizá hacia abajo y seleccioná <strong>Agregar a inicio</strong>.
                  </li>
                  <li>
                    Confirmá tocando <strong>Agregar</strong> arriba a la derecha.
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="mt-2 w-full py-2.5 text-xs uppercase tracking-wider font-semibold bg-[#173B43] text-[#FCFBF7] hover:bg-[#122e35] rounded-sm transition-colors cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
