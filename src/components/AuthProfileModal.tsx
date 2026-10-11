import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
} from 'lucide-react';
import { UserProfile, UserRole, SCHEMA_LIMITS, truncateText } from '../types';

export type AuthModalMode = 'login' | 'register' | 'recover' | 'profile';

interface AuthProfileModalProps {
  isOpen: boolean;
  initialMode: AuthModalMode;
  currentUser: UserProfile | null;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
  onLoginSubmit: (email: string, password: string) => Promise<boolean>;
  onRegisterSubmit: (data: {
    displayName: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    dni: string;
  }) => Promise<boolean>;
  onPasswordReset: (email: string) => Promise<void>;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  onEnableOwnerRole: () => Promise<void>;
  onQuickRoleLogin: (role: UserRole) => void;
}

export const AuthProfileModal: React.FC<AuthProfileModalProps> = ({
  isOpen,
  initialMode,
  currentUser,
  onClose,
  onGoogleLogin,
  onLoginSubmit,
  onRegisterSubmit,
  onPasswordReset,
  onUpdateProfile,
  onEnableOwnerRole,
  onQuickRoleLogin,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state (Cliente by default)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDni, setRegDni] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Recover password state
  const [recoverEmail, setRecoverEmail] = useState('');

  // Profile edit state
  const [profName, setProfName] = useState(currentUser?.displayName || '');
  const [profPhone, setProfPhone] = useState(currentUser?.phone || '');
  const [profAddress, setProfAddress] = useState(currentUser?.address || '');
  const [profDni, setProfDni] = useState(currentUser?.dni || '');
  const [profAgency, setProfAgency] = useState(currentUser?.agencyName || '');
  const [profBio, setProfBio] = useState(currentUser?.bio || '');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (currentUser) {
      setProfName(currentUser.displayName);
      setProfPhone(currentUser.phone);
      setProfAddress(currentUser.address);
      setProfDni(currentUser.dni);
      setProfAgency(currentUser.agencyName);
      setProfBio(currentUser.bio);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await onLoginSubmit(loginEmail.trim(), loginPassword);
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const ok = await onRegisterSubmit({
        displayName: truncateText(regName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        email: truncateText(regEmail, SCHEMA_LIMITS.EMAIL_MAX),
        password: regPassword,
        phone: truncateText(regPhone, SCHEMA_LIMITS.PHONE_MAX),
        address: truncateText(regAddress || 'Buenos Aires, Argentina', SCHEMA_LIMITS.ADDRESS_MAX),
        dni: truncateText(regDni, SCHEMA_LIMITS.DNI_MAX),
      });
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail.trim()) return;
    setBusy(true);
    try {
      await onPasswordReset(recoverEmail.trim());
      setRecoverEmail('');
      setMode('login');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdateProfile({
        displayName: truncateText(profName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        phone: truncateText(profPhone, SCHEMA_LIMITS.PHONE_MAX),
        address: truncateText(profAddress, SCHEMA_LIMITS.ADDRESS_MAX),
        dni: truncateText(profDni, SCHEMA_LIMITS.DNI_MAX),
        agencyName: truncateText(profAgency, SCHEMA_LIMITS.AGENCY_MAX),
        bio: truncateText(profBio, SCHEMA_LIMITS.BIO_MAX),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F241F]/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FCFBF7] border border-[#D8C7AA] rounded-md overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-[#39483A] text-[#FCFBF7]">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#D8C7AA] block">
              ClaveHogar
            </span>
            <h2 className="text-xl font-serif-display font-semibold">
              {mode === 'login' && 'Iniciar sesión'}
              {mode === 'register' && 'Crear cuenta'}
              {mode === 'recover' && 'Recuperar contraseña'}
              {mode === 'profile' && 'Mi Perfil Personal'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#D8C7AA] hover:text-[#FCFBF7] rounded-sm hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* SCREEN 1: INICIAR SESIÓN */}
          {mode === 'login' && (
            <div className="space-y-5">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#39483A]">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('recover')}
                      className="text-xs font-medium text-[#B86F52] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#D8C7AA]"></div>
                <span className="flex-shrink mx-3 text-xs text-[#39483A]/60">O acceso rápido:</span>
                <div className="flex-grow border-t border-[#D8C7AA]"></div>
              </div>
{/* 
              <button
                type="button"
                onClick={async () => {
                  await onGoogleLogin();
                  onClose();
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold text-[#39483A] bg-white border border-[#D8C7AA] hover:bg-[#F5F1E8] rounded-sm transition-colors"
              >
                Continuar con Google Auth
              </button> */}

              {/* Quick Demo Credentials helper */}
              <div className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2.5">
                <div className="text-[11px] font-semibold text-[#39483A]">
                  Acceso rápido a cuentas verificadas (según su rol):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onQuickRoleLogin('cliente');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium bg-[#FCFBF7] hover:bg-[#39483A] hover:text-[#FCFBF7] text-[#39483A] border border-[#D8C7AA] rounded-sm transition-colors text-left"
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickRoleLogin('propietario');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium bg-[#FCFBF7] hover:bg-[#39483A] hover:text-[#FCFBF7] text-[#39483A] border border-[#D8C7AA] rounded-sm transition-colors text-left"
                  >
                    Propietario
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickRoleLogin('agente');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium bg-[#FCFBF7] hover:bg-[#39483A] hover:text-[#FCFBF7] text-[#39483A] border border-[#D8C7AA] rounded-sm transition-colors text-left"
                  >
                    Agente Inmobiliario
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onQuickRoleLogin('administrador');
                      onClose();
                    }}
                    className="px-3 py-2 text-xs font-medium bg-[#FCFBF7] hover:bg-[#39483A] hover:text-[#FCFBF7] text-[#39483A] border border-[#D8C7AA] rounded-sm transition-colors text-left"
                  >
                    Administrador
                  </button>
                </div>
              </div>

              <div className="text-center text-xs text-[#39483A]/80 pt-1">
                ¿No tenés una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-[#B86F52] hover:underline"
                >
                  Registrate aquí
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: REGISTRARSE */}
          {mode === 'register' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm text-xs text-[#39483A]">
                Tu cuenta se creará con perfil de <strong>Cliente</strong>.Luego podrás habilitar también funciones de <strong>Propietario</strong> si deseás publicar un inmueble.
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="juan@ejemplo.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#39483A] mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+54 9 11..."
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular focus:outline-none focus:border-[#39483A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#39483A] mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      required
                      value={regDni}
                      onChange={(e) => setRegDni(e.target.value)}
                      placeholder="35.000.000"
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular focus:outline-none focus:border-[#39483A]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Localidad / Dirección
                  </label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Quilmes / CABA / Zona Norte"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Registrando usuario...' : 'Registrarse'}
                </button>
              </form>

              <div className="text-center text-xs text-[#39483A]/80 pt-1">
                ¿Ya tenés una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-[#B86F52] hover:underline"
                >
                  Iniciar sesión
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 3: RECUPERAR CONTRASEÑA */}
          {mode === 'recover' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39483A] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Iniciar sesión
              </button>
              <p className="text-xs text-[#39483A]/80 leading-relaxed">
                Ingresá el correo electrónico de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleRecover} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Correo electrónico registrado
                  </label>
                  <input
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                >
                  Enviar instrucciones
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 4: MI PERFIL */}
          {mode === 'profile' && currentUser && (
            <div className="space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Nombre y Apellido
                  </label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#39483A] mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      required
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#39483A] mb-1">
                      DNI / Documento
                    </label>
                    <input
                      type="text"
                      value={profDni}
                      onChange={(e) => setProfDni(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm font-tabular"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Domicilio
                  </label>
                  <input
                    type="text"
                    value={profAddress}
                    onChange={(e) => setProfAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm"
                  />
                </div>
                {(currentUser.role === 'propietario' ||
                  currentUser.role === 'agente' ||
                  currentUser.isAlsoOwner) && (
                  <div>
                    <label className="block text-xs font-semibold text-[#39483A] mb-1">
                      Inmobiliaria / Firma (opcional)
                    </label>
                    <input
                      type="text"
                      value={profAgency}
                      onChange={(e) => setProfAgency(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Biografía / Preferencias
                  </label>
                  <textarea
                    rows={2}
                    value={profBio}
                    onChange={(e) => setProfBio(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm"
                  />
                </div>

                {currentUser.role === 'cliente' && !currentUser.isAlsoOwner && (
                  <div className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm space-y-2">
                    <div className="text-xs font-semibold text-[#39483A]">
                      ¿Deseás publicar una propiedad?
                    </div>
                    <p className="text-[11px] text-[#39483A]/80">
                      Podés habilitar tu perfil de Propietario manteniendo todas tus funciones de Cliente (favoritos, búsquedas y reservas).
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await onEnableOwnerRole();
                        onClose();
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
                    >
                      Convertirme también en Propietario
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                >
                  Guardar Datos Personales
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
