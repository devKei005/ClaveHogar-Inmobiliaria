import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowLeft,
  Camera,
  Trash2,
  User,
} from 'lucide-react';
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
            onClick={() => {
              clearAuthForms();
              onClose();
            }}
            className="p-1.5 text-[#D8C7AA] hover:text-[#FCFBF7] rounded-sm hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[82vh] overflow-y-auto">
          {/* SCREEN 1: INICIAR SESIÓN */}
          {mode === 'login' && (
            <div className="space-y-5">
              <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
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

              <div className="text-center text-xs text-[#39483A]/80 pt-2 border-t border-[#D8C7AA]">
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
              <div className="p-3 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm text-xs text-[#39483A]">
                Tu cuenta se creará con perfil de <strong>Cliente</strong>. Desde la misma cuenta podrás convertirte también en <strong>Propietario</strong> cuando quieras publicar y administrar tus inmuebles.
              </div>

              <form onSubmit={handleRegister} autoComplete="off" className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
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
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
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
                      name="clavehogar_reg_phone"
                      autoComplete="off"
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
                      name="clavehogar_reg_dni"
                      autoComplete="off"
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
                    name="clavehogar_reg_address"
                    autoComplete="off"
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
                    name="clavehogar_reg_password"
                    autoComplete="new-password"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#39483A] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver a Iniciar sesión
              </button>
              <p className="text-xs text-[#39483A]/80 leading-relaxed">
                Ingresá el correo electrónico de tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleRecover} autoComplete="off" className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Correo electrónico registrado
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
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

          {/* SCREEN 4: MI PERFIL PERSONAL (Foto propia + CRUD Datos Personales) */}
          {mode === 'profile' && currentUser && (
            <div className="space-y-4">
              {/* Foto de perfil propia */}
              <div className="p-4 bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] border-2 border-[#D8C7AA] flex items-center justify-center shrink-0">
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-[#39483A] text-[#FCFBF7] rounded-sm hover:bg-[#2c382d] transition-colors cursor-pointer"
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
                  <label className="block text-xs font-semibold text-[#39483A] mb-1">
                    Nombre y Apellido *
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
                      Teléfono *
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
                    Domicilio / Localidad
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
                      ¿Querés vender o alquilar tu propia propiedad?
                    </div>
                    <p className="text-[11px] text-[#39483A]/80">
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
                    className="w-full py-3 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                  >
                    {busy ? 'Guardando...' : 'Guardar Datos Personales'}
                  </button>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D8C7AA]">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleClearOptionalProfileData}
                      className="px-3 py-1.5 text-[11px] font-semibold text-[#39483A] bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm hover:bg-[#D8C7AA]/40 transition-colors"
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
                              className="px-2 py-1 text-[11px] text-[#39483A] underline"
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
