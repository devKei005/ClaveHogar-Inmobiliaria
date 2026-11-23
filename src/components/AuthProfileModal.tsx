import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Camera,
  Trash2,
  User,
  WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  UserProfile,
  UserRole,
  DEMO_ROLE_EMAILS,
  SCHEMA_LIMITS,
  truncateText,
} from '../types';

export type AuthModalMode = 'login' | 'register' | 'recover' | 'profile';

interface AuthProfileModalProps {
  isOpen: boolean;
  initialMode: AuthModalMode;
  currentUser: UserProfile | null;
  onClose: () => void;
  onGoogleLogin: (intent: 'login' | 'register') => Promise<{
    ok: boolean;
    reason?: 'not_registered' | 'already_registered' | 'suspended' | 'cancelled' | 'error';
    message?: string;
  }>;
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
  onDeleteOwnProfile?: () => Promise<void>;
  onEnableOwnerRole: () => Promise<void>;
  onQuickRoleLogin: (role: UserRole) => void;
}

function processAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 320;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(event.target?.result || ''));
          return;
        }
        // Center crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('No se pudo procesar la foto de perfil.'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo del dispositivo.'));
    reader.readAsDataURL(file);
  });
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
  onDeleteOwnProfile,
  onEnableOwnerRole,
  onQuickRoleLogin,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

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
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profDni, setProfDni] = useState('');
  const [profAgency, setProfAgency] = useState('');
  const [profBio, setProfBio] = useState('');
  const [profPhotoUrl, setProfPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const isOnline = useOnlineStatus();
  const [authFeedback, setAuthFeedback] = useState<{
    type: 'error' | 'info';
    message: string;
    actionLabel?: string;
    actionMode?: AuthModalMode;
  } | null>(null);

  const clearAuthForms = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegPhone('');
    setRegDni('');
    setRegAddress('');
    setRecoverEmail('');
    setConfirmDeleteAccount(false);
    setAuthFeedback(null);
  };

  useEffect(() => {
    setMode(initialMode);
    clearAuthForms();
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (currentUser && isOpen) {
      setProfName(currentUser.displayName || '');
      setProfPhone(currentUser.phone || '');
      setProfAddress(currentUser.address || '');
      setProfDni(currentUser.dni || '');
      setProfAgency(currentUser.agencyName || '');
      setProfBio(currentUser.bio || '');
      setProfPhotoUrl(currentUser.photoUrl || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthModalMode) => {
    clearAuthForms();
    setMode(nextMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    setBusy(true);
    try {
      const ok = await onLoginSubmit(loginEmail.trim(), loginPassword);
      if (ok) {
        clearAuthForms();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleAuth = async (intent: 'login' | 'register') => {
    setAuthFeedback(null);
    setGoogleBusy(true);
    try {
      const res = await onGoogleLogin(intent);
      if (res.ok) {
        clearAuthForms();
        onClose();
      } else if (res.message) {
        setAuthFeedback({
          type: res.reason === 'already_registered' ? 'info' : 'error',
          message: res.message,
          actionLabel:
            res.reason === 'not_registered'
              ? 'Ir a Registrarse'
              : res.reason === 'already_registered'
              ? 'Ir a Iniciar sesión'
              : undefined,
          actionMode:
            res.reason === 'not_registered'
              ? 'register'
              : res.reason === 'already_registered'
              ? 'login'
              : undefined,
        });
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
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
      if (ok) {
        clearAuthForms();
        onClose();
      }
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
      clearAuthForms();
      setMode('login');
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploadingPhoto(true);
    try {
      const dataUrl = await processAvatarFile(file);
      if (dataUrl) {
        setProfPhotoUrl(dataUrl);
        await onUpdateProfile({ photoUrl: dataUrl });
      }
    } finally {
      setUploadingPhoto(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setProfPhotoUrl('');
    setUploadingPhoto(true);
    try {
      await onUpdateProfile({ photoUrl: '' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim() || !profPhone.trim()) return;
    setBusy(true);
    try {
      await onUpdateProfile({
        displayName: truncateText(profName, SCHEMA_LIMITS.DISPLAY_NAME_MAX),
        phone: truncateText(profPhone, SCHEMA_LIMITS.PHONE_MAX),
        address: truncateText(profAddress, SCHEMA_LIMITS.ADDRESS_MAX),
        dni: truncateText(profDni, SCHEMA_LIMITS.DNI_MAX),
        agencyName: truncateText(profAgency, SCHEMA_LIMITS.AGENCY_MAX),
        bio: truncateText(profBio, SCHEMA_LIMITS.BIO_MAX),
        photoUrl: profPhotoUrl,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleClearOptionalProfileData = async () => {
    setProfAddress('');
    setProfDni('');
    setProfAgency('');
    setProfBio('');
    setProfPhotoUrl('');
    setBusy(true);
    try {
      await onUpdateProfile({
        address: '',
        dni: '',
        agencyName: '',
        bio: '',
        photoUrl: '',
      });
    } finally {
      setBusy(false);
    }
  };

  const isOfficialDemoUser = currentUser
    ? Object.values(DEMO_ROLE_EMAILS).includes(currentUser.email.toLowerCase())
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F241F]/60 p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FCFBF7] border border-[#D5BFA0] rounded-md overflow-hidden my-4 sm:my-8 max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 bg-[#173B43] text-[#FCFBF7] shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#D5BFA0] font-semibold block">
              ClaveHogar
            </span>
            <h2 className="text-lg sm:text-xl font-serif-display font-semibold text-white truncate">
              {mode === 'login' && 'Iniciar sesión'}
              {mode === 'register' && 'Crear cuenta'}
              {mode === 'recover' && 'Recuperar contraseña'}
              {mode === 'profile' && 'Mi Perfil Personal'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAuthForms();
              onClose();
            }}
            className="p-1.5 text-[#D5BFA0] hover:text-[#FCFBF7] rounded-sm hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!isOnline && (
            <div
              role="status"
              className="mb-4 p-3 rounded-sm border border-amber-300 bg-amber-50 text-amber-950 text-xs flex items-start gap-2"
            >
              <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Sin conexión a internet:</strong> necesitás estar conectado para iniciar sesión, registrarte o guardar cambios en tu cuenta.
              </span>
            </div>
          )}

          {/* SCREEN 1: INICIAR SESIÓN */}
          {mode === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    name="clavehogar_login_email"
                    autoComplete="off"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#173B43]">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('recover')}
                      className="text-xs font-medium text-[#B86F52] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input
                    type="password"
                    name="clavehogar_login_password"
                    autoComplete="new-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || googleBusy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </button>
              </form>

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-[#D5BFA0]" />
                <span className="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-[#173B43]/65 font-semibold">
                  o continuá con
                </span>
                <div className="flex-grow border-t border-[#D5BFA0]" />
              </div>

              {authFeedback && (
                <div
                  role="alert"
                  className={`p-3 rounded-sm border text-xs space-y-2 ${
                    authFeedback.type === 'error'
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <p className="font-medium leading-relaxed">{authFeedback.message}</p>
                  {authFeedback.actionLabel && authFeedback.actionMode && (
                    <button
                      type="button"
                      onClick={() => switchMode(authFeedback.actionMode!)}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold bg-[#173B43] text-[#FCFBF7] rounded-sm hover:bg-[#2c382d] transition-colors cursor-pointer"
                    >
                      {authFeedback.actionLabel}
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleGoogleAuth('login')}
                disabled={busy || googleBusy}
                className="w-full py-2.5 px-4 text-xs sm:text-sm font-semibold text-[#303638] bg-white hover:bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm transition-colors flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleBusy ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
              </button>

              <div className="text-center text-xs text-[#173B43]/80 pt-2 border-t border-[#D5BFA0]">
                ¿No tenés una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-semibold text-[#B86F52] hover:underline cursor-pointer"
                >
                  Registrate aquí
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: REGISTRARSE */}
          {mode === 'register' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm text-xs text-[#173B43]">
                Tu cuenta se creará con perfil de <strong>Cliente</strong>. Desde la misma cuenta podrás convertirte también en <strong>Propietario</strong> cuando quieras publicar y administrar tus inmuebles.
              </div>

              <form onSubmit={handleRegister} autoComplete="off" className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    name="clavehogar_reg_name"
                    autoComplete="off"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Correo electrónico *
                  </label>
                  <input
                    type="email"
                    name="clavehogar_reg_email"
                    autoComplete="off"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="juan@ejemplo.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#173B43] mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      name="clavehogar_reg_phone"
                      autoComplete="off"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+54 9 11..."
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#173B43] mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      name="clavehogar_reg_dni"
                      autoComplete="off"
                      required
                      value={regDni}
                      onChange={(e) => setRegDni(e.target.value)}
                      placeholder="35.000.000"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular focus:outline-none focus:border-[#173B43]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Localidad / Dirección
                  </label>
                  <input
                    type="text"
                    name="clavehogar_reg_address"
                    autoComplete="off"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Quilmes / CABA / Zona Norte"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    name="clavehogar_reg_password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || googleBusy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors disabled:opacity-50"
                >
                  {busy ? 'Registrando usuario...' : 'Registrarse'}
                </button>
              </form>

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-[#D5BFA0]" />
                <span className="shrink-0 mx-3 text-[11px] uppercase tracking-wider text-[#173B43]/65 font-semibold">
                  o registrate con
                </span>
                <div className="flex-grow border-t border-[#D5BFA0]" />
              </div>

              {authFeedback && (
                <div
                  role="alert"
                  className={`p-3 rounded-sm border text-xs space-y-2 ${
                    authFeedback.type === 'error'
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <p className="font-medium leading-relaxed">{authFeedback.message}</p>
                  {authFeedback.actionLabel && authFeedback.actionMode && (
                    <button
                      type="button"
                      onClick={() => switchMode(authFeedback.actionMode!)}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold bg-[#173B43] text-[#FCFBF7] rounded-sm hover:bg-[#2c382d] transition-colors cursor-pointer"
                    >
                      {authFeedback.actionLabel}
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleGoogleAuth('register')}
                disabled={busy || googleBusy}
                className="w-full py-2.5 px-4 text-xs sm:text-sm font-semibold text-[#303638] bg-white hover:bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm transition-colors flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>{googleBusy ? 'Conectando con Google...' : 'Registrarse con Google'}</span>
              </button>

              <div className="text-center text-xs text-[#173B43]/80 pt-1">
                ¿Ya tenés una cuenta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
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
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#173B43] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Iniciar sesión
              </button>
              <p className="text-xs text-[#173B43]/80 leading-relaxed">
                Ingresá el correo electrónico de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleRecover} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Correo electrónico registrado
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D5BFA0] rounded-sm focus:outline-none focus:border-[#173B43]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors"
                >
                  Enviar instrucciones
                </button>
              </form>
            </div>
          )}

          {/* SCREEN 4: MI PERFIL PERSONAL (Foto propia + CRUD Datos Personales) */}
          {mode === 'profile' && currentUser && (
            <div className="space-y-4">
              {/* Foto de perfil propia */}
              <div className="p-4 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#173B43] text-[#FCFBF7] border-0 sm:border-2 sm:border-[#D5BFA0] flex items-center justify-center shrink-0">
                  {profPhotoUrl ? (
                    <img
                      src={profPhotoUrl}
                      alt={profName || currentUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-[#FCFBF7]" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="text-xs font-semibold text-[#1F241F] truncate">
                    {currentUser.email}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-[#B86F52] font-semibold">
                    Rol: {currentUser.role === 'cliente' && currentUser.isAlsoOwner ? 'Cliente y Propietario' : currentUser.role}
                  </div>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelection}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-[#173B43] text-[#FCFBF7] rounded-sm hover:bg-[#2c382d] transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {uploadingPhoto ? 'Guardando foto...' : profPhotoUrl ? 'Cambiar foto' : 'Subir foto propia'}
                    </button>
                    {profPhotoUrl && (
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#173B43] mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={profPhone}
                      onChange={(e) => setProfPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#173B43] mb-1">
                      DNI / Documento
                    </label>
                    <input
                      type="text"
                      value={profDni}
                      onChange={(e) => setProfDni(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm font-tabular"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Domicilio / Localidad
                  </label>
                  <input
                    type="text"
                    value={profAddress}
                    onChange={(e) => setProfAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm"
                  />
                </div>
                {(currentUser.role === 'propietario' ||
                  currentUser.role === 'agente' ||
                  currentUser.isAlsoOwner) && (
                  <div>
                    <label className="block text-xs font-semibold text-[#173B43] mb-1">
                      Inmobiliaria / Firma (opcional)
                    </label>
                    <input
                      type="text"
                      value={profAgency}
                      onChange={(e) => setProfAgency(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-[#173B43] mb-1">
                    Biografía / Preferencias
                  </label>
                  <textarea
                    rows={2}
                    value={profBio}
                    onChange={(e) => setProfBio(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D5BFA0] rounded-sm"
                  />
                </div>

                {currentUser.role === 'cliente' && !currentUser.isAlsoOwner && (
                  <div className="p-4 bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm space-y-2">
                    <div className="text-xs font-semibold text-[#173B43]">
                      ¿Querés vender o alquilar tu propia propiedad?
                    </div>
                    <p className="text-[11px] text-[#173B43]/80">
                      Podés convertirte en <strong>Propietario</strong> desde esta misma cuenta manteniendo todas tus funciones de Cliente (favoritos, búsquedas y reservas).
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        await onEnableOwnerRole();
                        onClose();
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
                    >
                      Convertirme en Propietario
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#173B43] hover:bg-[#2c382d] rounded-sm transition-colors"
                  >
                    {busy ? 'Guardando...' : 'Guardar Datos Personales'}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D5BFA0]">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleClearOptionalProfileData}
                      className="px-3 py-1.5 text-[11px] font-semibold text-[#173B43] bg-[#F8F6F1] border border-[#D5BFA0] rounded-sm hover:bg-[#D5BFA0]/40 transition-colors"
                    >
                      Limpiar datos opcionales
                    </button>

                    {!isOfficialDemoUser && onDeleteOwnProfile && (
                      <>
                        {!confirmDeleteAccount ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAccount(true)}
                            className="px-3 py-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-300 rounded-sm hover:bg-red-100 transition-colors"
                          >
                            Eliminar mi perfil
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await onDeleteOwnProfile();
                                  onClose();
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-sm"
                            >
                              Confirmar baja
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAccount(false)}
                              className="px-2 py-1 text-[11px] text-[#173B43] underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
