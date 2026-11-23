import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-50 border-b border-amber-300 text-amber-950 px-3 sm:px-6 py-2 text-[11px] sm:text-xs font-medium"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
        <span>
          <strong>Modo sin conexión:</strong> estás viendo la interfaz y los datos guardados. Para iniciar sesión, publicar propiedades o usar el chat con IA necesitás internet.
        </span>
      </div>
    </div>
  );
};
