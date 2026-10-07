import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Heart,
  Scale,
  RotateCcw,
  Check,
  Bell,
  Menu,
  X,
  ArrowRight,
  LogOut,
  User,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  UserProfile,
  UserRole,
  PropertyItem,
  VisitItem,
  VisitStatus,
  InquiryItem,
  ChatMessage,
  OperationItem,
  OperationTypeChoice,
  DealStatus,
  ClaimItem,
  ClaimTargetType,
  ClaimStatus,
  CategoryConfigItem,
  AvailabilityStatus,
  PublicationStatus,
  NotificationItem,
  ToastMessage,
  AISmartSearchResponse,
  SCHEMA_LIMITS,
  sanitizeId,
  truncateText,
} from './types';
import {
  HERO_IMAGE,
  INITIAL_CATEGORIES,
  INITIAL_CLAIMS,
  INITIAL_INQUIRIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_OPERATIONS,
  INITIAL_PROPERTIES,
  INITIAL_USERS,
  INITIAL_VISITS,
  resolvePropertyImages,
} from './data/initialData';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { ComparatorView } from './components/ComparatorView';
import { AuthProfileModal, AuthModalMode } from './components/AuthProfileModal';
import { PropertyFormModal } from './components/PropertyFormModal';
import { RoleWorkspaceView, WorkspaceSubView } from './components/RoleWorkspaceView';

type MainSection = 'catalogo' | 'buscador_ia' | 'comparador' | 'panel_rol';

const AI_PROMPT_SUGGESTIONS = [
  'Busco una casa de 3 habitaciones, con pileta, cerca de Quilmes y con un presupuesto máximo de $200.000.',
  'Busco alquilar un departamento luminoso de 3 o 4 ambientes en Palermo o Belgrano con balcón terraza y seguridad 24h, hasta USD 2500.',
  'Quiero comprar una casa minimalista en San Isidro con piscina climatizada, jardín privado y cochera cubierta.',
  'Busco un PH tranquilo con patio propio y parrilla en Colegiales hasta USD 310.000.',
];

function getDefaultSubViewForRole(role: UserRole): WorkspaceSubView {
  switch (role) {
    case 'cliente':
      return 'cliente_favoritos';
    case 'propietario':
      return 'propietario_inmuebles';
    case 'agente':
      return 'agente_cartera';
    case 'administrador':
      return 'admin_dashboard';
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<MainSection>('catalogo');
  const [activeSubView, setActiveSubView] = useState<WorkspaceSubView>('cliente_favoritos');

  // Hamburger Side Drawer state (Requirement 1 & 2)
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Auth & User state
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(INITIAL_USERS[0]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Core Entities state (synced with Firestore)
  const [properties, setProperties] = useState<PropertyItem[]>(INITIAL_PROPERTIES);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(['prop_casa_quilmes_pileta']);
  const [comparedIds, setComparedIds] = useState<string[]>([
    'prop_casa_quilmes_pileta',
    'prop_chalet_quilmes_parque',
  ]);
  const [visits, setVisits] = useState<VisitItem[]>(INITIAL_VISITS);
  const [inquiries, setInquiries] = useState<InquiryItem[]>(INITIAL_INQUIRIES);
  const [operations, setOperations] = useState<OperationItem[]>(INITIAL_OPERATIONS);
  const [claims, setClaims] = useState<ClaimItem[]>(INITIAL_CLAIMS);
  const [categories, setCategories] = useState<CategoryConfigItem[]>(INITIAL_CATEGORIES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Toast Notification Queue
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Hero Carousel state
  const [heroShowcaseIdx, setHeroShowcaseIdx] = useState(0);

  // Selected property detail & form modals
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyItem | null>(null);

  // Search, Filters & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOperation, setFilterOperation] = useState<'todos' | 'alquiler' | 'venta'>('todos');
  const [filterPropertyType, setFilterPropertyType] = useState<string>('todos');
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>('');
  const [filterMinRooms, setFilterMinRooms] = useState<number>(0);
  const [filterMinSurface, setFilterMinSurface] = useState<string>('');
  const [filterFeatures, setFilterFeatures] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'fecha_desc' | 'precio_asc' | 'precio_desc'>('fecha_desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // AI Smart Search
  const [aiQuery, setAiQuery] = useState(AI_PROMPT_SUGGESTIONS[0]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AISmartSearchResponse | null>(null);

  const notify = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const pushUserNotification = async (
    targetUserId: string,
    title: string,
    message: string,
    type: 'success' | 'info' | 'warning' = 'info'
  ) => {
    const id = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`);
    const newNotif: NotificationItem = {
      id,
      userId: targetUserId,
      title: truncateText(title, 150),
      message: truncateText(message, 450),
      type,
      read: false,
      createdAtIso: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);
    try {
      await setDoc(doc(db, 'notifications', id), newNotif);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
    }
  };

  const approvedProperties = useMemo(
    () => properties.filter((p) => p.publicationStatus === 'aprobada'),
    [properties]
  );

  useEffect(() => {
    if (approvedProperties.length <= 1) return;
    const interval = setInterval(() => {
      setHeroShowcaseIdx((prev) => (prev + 1) % Math.min(5, approvedProperties.length));
    }, 6000);
    return () => clearInterval(interval);
  }, [approvedProperties.length]);

  // Seed initial data into Firestore if collections are empty & attach real-time listeners
  useEffect(() => {
    let mounted = true;

    async function bootstrapFirestore() {
      try {
        const propsSnap = await getDocs(collection(db, 'properties'));
        if (propsSnap.empty) {
          for (const u of INITIAL_USERS) {
            await setDoc(doc(db, 'app_users', u.uid), u);
          }
          for (const p of INITIAL_PROPERTIES) {
            await setDoc(doc(db, 'properties', p.id), p);
          }
          for (const v of INITIAL_VISITS) {
            await setDoc(doc(db, 'visits', v.id), v);
          }
          for (const inq of INITIAL_INQUIRIES) {
            await setDoc(doc(db, 'inquiries', inq.id), inq);
          }
          for (const op of INITIAL_OPERATIONS) {
            await setDoc(doc(db, 'operations', op.id), op);
          }
          for (const clm of INITIAL_CLAIMS) {
            await setDoc(doc(db, 'claims', clm.id), clm);
          }
          for (const cat of INITIAL_CATEGORIES) {
            await setDoc(doc(db, 'categories', cat.id), cat);
          }
          for (const notif of INITIAL_NOTIFICATIONS) {
            await setDoc(doc(db, 'notifications', notif.id), notif);
          }
        }
      } catch (err) {
        console.warn('Firestore initial seed check:', err);
      }
    }

    bootstrapFirestore();

    const unsubUsers = onSnapshot(
      collection(db, 'app_users'),
      (snap) => {
        if (!mounted || snap.empty) return;
        const list = snap.docs.map((d) => d.data() as UserProfile);
        setUsers(list);
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updated = list.find((u) => u.uid === prev.uid);
          return updated || prev;
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'app_users')
    );

    const unsubProps = onSnapshot(
      collection(db, 'properties'),
      (snap) => {
        if (!mounted || snap.empty) return;
        const list = snap.docs.map((d) => {
          const raw = d.data() as PropertyItem;
          const resolvedImages = resolvePropertyImages(raw.images, raw.id || d.id);

          // Si en Firestore quedaron guardadas rutas locales (/src/assets/... o /assets/...),
          // actualizarlas automáticamente en Firestore con las URLs HTTPS permanentes
          const hasLegacyLocalPath =
            Array.isArray(raw.images) &&
            raw.images.some(
              (img) =>
                typeof img === 'string' &&
                !img.startsWith('http://') &&
                !img.startsWith('https://') &&
                !img.startsWith('data:image/')
            );
          if (hasLegacyLocalPath) {
            updateDoc(doc(db, 'properties', d.id), { images: resolvedImages }).catch(() => {});
          }

          return {
            ...raw,
            id: raw.id || d.id,
            images: resolvedImages,
          };
        });
        setProperties(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'properties')
    );

    const unsubVisits = onSnapshot(
      collection(db, 'visits'),
      (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setVisits(snap.docs.map((d) => d.data() as VisitItem));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'visits')
    );

    const unsubInquiries = onSnapshot(
      collection(db, 'inquiries'),
      (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setInquiries(snap.docs.map((d) => d.data() as InquiryItem));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'inquiries')
    );

    const unsubOperations = onSnapshot(
      collection(db, 'operations'),
      (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setOperations(snap.docs.map((d) => d.data() as OperationItem));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'operations')
    );

    const unsubClaims = onSnapshot(
      collection(db, 'claims'),
      (snap) => {
        if (!mounted) return;
        if (!snap.empty) {
          setClaims(snap.docs.map((d) => d.data() as ClaimItem));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'claims')
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!mounted || snap.empty) return;
        setCategories(snap.docs.map((d) => d.data() as CategoryConfigItem));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'categories')
    );

    const unsubNotifs = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        if (!mounted || snap.empty) return;
        const sorted = snap.docs
          .map((d) => d.data() as NotificationItem)
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setNotifications(sorted);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'notifications')
    );

    const unsubFavs = onSnapshot(
      collection(db, 'favorites'),
      (snap) => {
        if (!mounted) return;
        setFavoriteIds((prev) => {
          if (snap.empty) return prev;
          const allFavs = snap.docs.map((d) => d.data() as { userId: string; propertyId: string });
          return allFavs.map((f) => f.propertyId);
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'favorites')
    );

    return () => {
      mounted = false;
      unsubUsers();
      unsubProps();
      unsubVisits();
      unsubInquiries();
      unsubOperations();
      unsubClaims();
      unsubCategories();
      unsubNotifs();
      unsubFavs();
    };
  }, []);

  // Sync Firebase Google Auth if used
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const uid = sanitizeId(user.uid);
      const isBootstrapAdmin = user.email === 'programacionkeichi@gmail.com';
      const defaultRole: UserRole = isBootstrapAdmin ? 'administrador' : 'cliente';
      const displayName = truncateText(
        user.displayName || user.email?.split('@')[0] || 'Usuario ClaveHogar',
        SCHEMA_LIMITS.DISPLAY_NAME_MAX
      );
      const email = truncateText(user.email || 'usuario@clavehogar.com', SCHEMA_LIMITS.EMAIL_MAX);

      const existing = users.find((u) => u.uid === uid || u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        setCurrentUser(existing);
        setActiveSubView(getDefaultSubViewForRole(existing.role));
        return;
      }

      const newProfile: UserProfile = {
        uid,
        displayName,
        email,
        phone: '+54 9 11 4500-1200',
        address: 'Buenos Aires, Argentina',
        dni: '35.100.200',
        role: defaultRole,
        isAlsoOwner: isBootstrapAdmin,
        active: true,
        agencyName: isBootstrapAdmin ? 'ClaveHogar Administración' : '',
        bio: 'Cuenta autenticada con Google.',
      };

      setCurrentUser(newProfile);
      setActiveSubView(getDefaultSubViewForRole(newProfile.role));
      try {
        await setDoc(doc(db, 'app_users', uid), newProfile, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `app_users/${uid}`);
      }
    });
    return () => unsubAuth();
  }, [users]);

  // Keep selectedProperty in sync when properties update in Firestore
  useEffect(() => {
    if (!selectedProperty) return;
    const fresh = properties.find((p) => p.id === selectedProperty.id);
    if (fresh) setSelectedProperty(fresh);
  }, [properties, selectedProperty]);

  // Derived Catalog Lists
  const activePropertyTypes = useMemo(
    () => categories.filter((c) => c.kind === 'tipo_inmueble' && c.active).map((c) => c.name),
    [categories]
  );

  const activeFeatures = useMemo(
    () => categories.filter((c) => c.kind === 'caracteristica' && c.active).map((c) => c.name),
    [categories]
  );

  const filteredProperties = useMemo(() => {
    return properties
      .filter((p) => p.publicationStatus === 'aprobada')
      .filter((p) => {
        if (filterOperation !== 'todos' && p.operationType !== filterOperation) return false;
        if (filterPropertyType !== 'todos' && p.propertyType !== filterPropertyType) return false;
        if (filterMaxPrice && p.price > Number(filterMaxPrice)) return false;
        if (filterMinRooms > 0 && p.rooms < filterMinRooms) return false;
        if (filterMinSurface && p.surface < Number(filterMinSurface)) return false;
        if (filterFeatures.length > 0) {
          const hasAll = filterFeatures.every((f) => p.features.includes(f));
          if (!hasAll) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchText =
            p.title.toLowerCase().includes(q) ||
            p.location.toLowerCase().includes(q) ||
            p.address.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.propertyType.toLowerCase().includes(q);
          if (!matchText) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'precio_asc') return a.price - b.price;
        if (sortBy === 'precio_desc') return b.price - a.price;
        return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
      });
  }, [
    properties,
    filterOperation,
    filterPropertyType,
    filterMaxPrice,
    filterMinRooms,
    filterMinSurface,
    filterFeatures,
    searchQuery,
    sortBy,
  ]);

  const comparedProperties = useMemo(
    () => properties.filter((p) => comparedIds.includes(p.id)),
    [properties, comparedIds]
  );

  const myNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter(
      (n) => n.userId === currentUser.uid || n.userId === 'usr_cliente_demo'
    );
  }, [notifications, currentUser]);

  const unreadCount = myNotifications.filter((n) => !n.read).length;

  // ============================================================================
  // AUTHENTICATION & ROLE HANDLERS
  // ============================================================================
  const openAuthModal = (mode: AuthModalMode) => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      notify('success', 'Sesión iniciada con Google', 'Bienvenido a ClaveHogar.');
    } catch {
      notify('error', 'No se pudo iniciar con Google', 'Podés ingresar con correo y contraseña o usar las cuentas demo.');
    }
  };

  const handleLoginSubmit = async (email: string, password: string): Promise<boolean> => {
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && (!u.password || u.password === password)
    );
    if (!found) {
      notify('error', 'Credenciales incorrectas', 'Verificá tu correo electrónico y contraseña o registrate.');
      return false;
    }
    if (!found.active) {
      notify('error', 'Cuenta suspendida', 'Tu cuenta se encuentra desactivada por el administrador.');
      return false;
    }
    setCurrentUser(found);
    setActiveSubView(getDefaultSubViewForRole(found.role));
    notify('success', `¡Bienvenido/a, ${found.displayName}!`, `Ingresaste con tu cuenta de ${found.role}.`);
    return true;
  };

  const handleRegisterSubmit = async (data: {
    displayName: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    dni: string;
  }): Promise<boolean> => {
    if (!data.displayName || !data.email || !data.password || !data.phone || !data.dni) {
      notify('error', 'Error: faltan completar campos', 'Completá todos los campos obligatorios del registro.');
      return false;
    }
    const exists = users.some((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (exists) {
      notify('error', 'El correo ya está registrado', 'Intentá iniciar sesión con ese correo electrónico.');
      return false;
    }

    const uid = sanitizeId(`usr_${Date.now()}`);
    const newUser: UserProfile = {
      uid,
      displayName: data.displayName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      address: data.address,
      dni: data.dni,
      role: 'cliente',
      isAlsoOwner: false,
      active: true,
      agencyName: '',
      bio: 'Cliente registrado en ClaveHogar.',
    };

    try {
      await setDoc(doc(db, 'app_users', uid), newUser);
      setUsers((prev) => [newUser, ...prev]);
      setCurrentUser(newUser);
      setActiveSubView('cliente_favoritos');
      notify(
        'success',
        'Cuenta creada correctamente',
        'Te registraste como Cliente. Podés buscar inmuebles o habilitar tu perfil de Propietario.'
      );
      return true;
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo registrar el usuario en Firestore.');
      handleFirestoreError(err, OperationType.CREATE, `app_users/${uid}`);
    }
  };

  const handlePasswordReset = async (email: string) => {
    notify(
      'info',
      'Enlace de recuperación enviado',
      `Se enviaron las instrucciones de restablecimiento a ${email}.`
    );
  };

  const handleQuickRoleLogin = (role: UserRole) => {
    const target = users.find((u) => u.role === role) || INITIAL_USERS.find((u) => u.role === role) || INITIAL_USERS[0];
    setCurrentUser(target);
    setActiveSubView(getDefaultSubViewForRole(target.role));
    notify(
      'success',
      `Sesión iniciada: ${target.displayName}`,
      `Accediste a la cuenta correspondiente al perfil ${target.role}.`
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsSideMenuOpen(false);
    setActiveSection('catalogo');
    notify('info', 'Sesión cerrada correctamente', 'Has salido de tu cuenta.');
  };

  const handleEnableOwnerRole = async () => {
    if (!currentUser) return;
    const updated: UserProfile = {
      ...currentUser,
      isAlsoOwner: true,
    };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));
    try {
      await setDoc(doc(db, 'app_users', updated.uid), updated, { merge: true });
      setActiveSection('panel_rol');
      setActiveSubView('propietario_inmuebles');
      setIsSideMenuOpen(false);
      notify(
        'success',
        'Perfil de Propietario habilitado',
        'Ahora conservás tus funciones de Cliente y además podés publicar y administrar tus propios inmuebles.'
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar tu perfil en Firestore.');
      handleFirestoreError(err, OperationType.UPDATE, `app_users/${updated.uid}`);
    }
  };

  const handleUpdateProfile = async (partial: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated: UserProfile = { ...currentUser, ...partial };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.uid === updated.uid ? updated : u)));
    try {
      await setDoc(doc(db, 'app_users', updated.uid), updated, { merge: true });
      notify('success', 'Perfil actualizado correctamente', 'Tus datos personales se guardaron en Firestore.');
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar tu perfil.');
      handleFirestoreError(err, OperationType.UPDATE, `app_users/${updated.uid}`);
    }
  };

  // ============================================================================
  // FIRESTORE CRUD OPERATIONS
  // ============================================================================
  const handleToggleFavorite = async (propertyId: string) => {
    if (!currentUser) {
      notify('info', 'Iniciá sesión para guardar favoritos', 'Ingresá con tu cuenta para guardar propiedades.');
      openAuthModal('login');
      return;
    }
    const isFav = favoriteIds.includes(propertyId);
    const favDocId = sanitizeId(`${currentUser.uid}_${propertyId}`);

    if (isFav) {
      setFavoriteIds((prev) => prev.filter((id) => id !== propertyId));
      try {
        await deleteDoc(doc(db, 'favorites', favDocId));
        notify('info', 'Eliminado de favoritos', 'La propiedad se quitó de tu lista de favoritos.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `favorites/${favDocId}`);
      }
    } else {
      setFavoriteIds((prev) => [...prev, propertyId]);
      try {
        await setDoc(doc(db, 'favorites', favDocId), {
          userId: currentUser.uid,
          propertyId,
          createdAtIso: new Date().toISOString(),
        });
        notify('success', 'Propiedad guardada en favoritos', 'Podés consultarla desde el menú lateral.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `favorites/${favDocId}`);
      }
    }
  };

  const handleToggleCompare = (propertyId: string) => {
    setComparedIds((prev) => {
      if (prev.includes(propertyId)) {
        notify('info', 'Quitada del comparador', 'Se retiró la propiedad de la tabla comparativa.');
        return prev.filter((id) => id !== propertyId);
      }
      if (prev.length >= 4) {
        notify('error', 'Límite de comparación alcanzado', 'Podés comparar hasta 4 propiedades en simultáneo.');
        return prev;
      }
      notify('success', 'Agregada al comparador', 'Abrí la sección Comparador para contrastar características.');
      return [...prev, propertyId];
    });
  };

  const handleSaveProperty = async (
    data: Omit<PropertyItem, 'id' | 'ownerId' | 'ownerName' | 'publicationStatus' | 'createdAtIso'>,
    existingId?: string
  ) => {
    if (!currentUser) return;
    const isEdit = Boolean(existingId);
    const propId = existingId ? sanitizeId(existingId) : sanitizeId(`prop_${Date.now()}`);
    const existingProp = properties.find((p) => p.id === propId);

    const newProp: PropertyItem = {
      ...data,
      id: propId,
      ownerId: existingProp?.ownerId || currentUser.uid,
      ownerName: existingProp?.ownerName || currentUser.displayName,
      agentId: data.agentId || existingProp?.agentId || 'usr_agente_demo',
      agentName: data.agentName || existingProp?.agentName || 'Valentina Alvear',
      publicationStatus: existingProp?.publicationStatus || 'aprobada',
      createdAtIso: existingProp?.createdAtIso || new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'properties', propId), newProp);
      setProperties((prev) =>
        isEdit ? prev.map((p) => (p.id === propId ? newProp : p)) : [newProp, ...prev]
      );
      notify(
        'success',
        isEdit ? 'Propiedad actualizada correctamente' : 'Propiedad publicada correctamente',
        `El inmueble "${newProp.title}" se guardó en Firebase Firestore.`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo guardar la propiedad en Firestore.');
      handleFirestoreError(err, OperationType.WRITE, `properties/${propId}`);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      await deleteDoc(doc(db, 'properties', propertyId));
      setProperties((prev) => prev.filter((p) => p.id !== propertyId));
      if (selectedProperty?.id === propertyId) {
        setSelectedProperty(null);
      }
      notify('success', 'Propiedad eliminada correctamente', 'El inmueble fue eliminado de Firebase Firestore.');
    } catch (err) {
      notify('error', 'Error al eliminar la propiedad', 'No se pudo eliminar el documento de Firestore.');
      handleFirestoreError(err, OperationType.DELETE, `properties/${propertyId}`);
    }
  };

  const handleUpdateAvailability = async (propertyId: string, availability: AvailabilityStatus) => {
    try {
      await updateDoc(doc(db, 'properties', propertyId), { availability });
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, availability } : p))
      );
      notify('success', 'Disponibilidad actualizada', `El estado del inmueble cambió a "${availability.toUpperCase()}".`);
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar la disponibilidad.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  const handleAssignAgent = async (propertyId: string, agentId: string, agentName: string) => {
    try {
      await updateDoc(doc(db, 'properties', propertyId), { agentId, agentName });
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, agentId, agentName } : p))
      );
      await pushUserNotification(
        agentId,
        'Nueva propiedad asignada',
        `Se te asignó la gestión inmobiliaria de una propiedad en ClaveHogar.`,
        'info'
      );
      notify('success', 'Agente inmobiliario asignado', `${agentName} gestionará esta propiedad.`);
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo asignar el agente.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  const handleModerateProperty = async (
    propertyId: string,
    publicationStatus: PublicationStatus,
    rejectionReason?: string
  ) => {
    const target = properties.find((p) => p.id === propertyId);
    try {
      await updateDoc(doc(db, 'properties', propertyId), {
        publicationStatus,
        rejectionReason: rejectionReason || '',
      });
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, publicationStatus, rejectionReason: rejectionReason || '' }
            : p
        )
      );
      if (target) {
        await pushUserNotification(
          target.ownerId,
          publicationStatus === 'aprobada' ? 'Publicación aprobada' : 'Publicación rechazada',
          publicationStatus === 'aprobada'
            ? `Tu propiedad "${target.title}" fue aprobada y está visible en el catálogo.`
            : `Tu propiedad "${target.title}" fue rechazada: ${rejectionReason || 'Revisar datos'}`,
          publicationStatus === 'aprobada' ? 'success' : 'warning'
        );
      }
      notify(
        'success',
        publicationStatus === 'aprobada'
          ? 'Publicación aprobada correctamente'
          : 'Publicación rechazada',
        'El estado de moderación se actualizó en Firestore.'
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo moderar la publicación.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  const handleRequestVisit = async (
    property: PropertyItem,
    date: string,
    timeSlot: string,
    notes: string
  ) => {
    if (!currentUser) return;
    const visitId = sanitizeId(`vis_${Date.now()}`);
    const newVisit: VisitItem = {
      id: visitId,
      propertyId: property.id,
      propertyTitle: property.title,
      clientId: currentUser.uid,
      clientName: currentUser.displayName,
      ownerId: property.ownerId,
      agentId: property.agentId || 'usr_agente_demo',
      date,
      timeSlot,
      status: 'pendiente',
      notes: notes || 'Solicitud de visita presencial.',
      createdAtIso: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'visits', visitId), newVisit);
      setVisits((prev) => [newVisit, ...prev]);
      await pushUserNotification(
        currentUser.uid,
        'Reserva de visita enviada',
        `Solicitaste visitar "${property.title}" el ${date} (${timeSlot}).`,
        'info'
      );
      notify(
        'success',
        'Reserva realizada correctamente',
        `Tu solicitud de visita para el ${date} (${timeSlot}) fue registrada en Firestore.`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo registrar la visita.');
      handleFirestoreError(err, OperationType.CREATE, `visits/${visitId}`);
    }
  };

  const handleUpdateVisit = async (
    visitId: string,
    status: VisitStatus,
    newDate?: string,
    newSlot?: string,
    notes?: string
  ) => {
    const existing = visits.find((v) => v.id === visitId);
    if (!existing) return;

    const updated: VisitItem = {
      ...existing,
      status,
      date: newDate || existing.date,
      timeSlot: newSlot || existing.timeSlot,
      notes: notes ? truncateText(notes, SCHEMA_LIMITS.VISIT_NOTES_MAX) : existing.notes,
    };

    try {
      await setDoc(doc(db, 'visits', visitId), updated);
      setVisits((prev) => prev.map((v) => (v.id === visitId ? updated : v)));

      const statusLabel =
        status === 'confirmada'
          ? 'confirmada'
          : status === 'reprogramada'
          ? `reprogramada para el ${updated.date} (${updated.timeSlot})`
          : status === 'rechazada'
          ? 'rechazada'
          : status;

      await pushUserNotification(
        existing.clientId,
        `Visita ${status.toUpperCase()} — ${existing.propertyTitle}`,
        `El estado de tu reserva de visita fue actualizado a: ${statusLabel}.`,
        status === 'confirmada' ? 'success' : status === 'rechazada' ? 'warning' : 'info'
      );

      notify(
        'success',
        status === 'confirmada'
          ? 'Reserva confirmada correctamente'
          : status === 'rechazada'
          ? 'Reserva rechazada'
          : 'Estado de visita actualizado',
        `El cliente ${existing.clientName} ha recibido una notificación.`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar la visita.');
      handleFirestoreError(err, OperationType.UPDATE, `visits/${visitId}`);
    }
  };

  const handleSendChatMessage = async (
    property: PropertyItem,
    messageText: string,
    existingInquiryId?: string
  ) => {
    if (!currentUser) return;
    const nowDisplay = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderRole: currentUser.role,
      text: truncateText(messageText, SCHEMA_LIMITS.INQUIRY_MAX),
      timestamp: nowDisplay,
    };

    const targetInquiry = existingInquiryId
      ? inquiries.find((i) => i.id === existingInquiryId)
      : inquiries.find(
          (i) => i.propertyId === property.id && i.clientId === currentUser.uid
        );

    if (targetInquiry) {
      const updatedMessages = [...(targetInquiry.messages || []), newMsg];
      const isStaff = currentUser.role !== 'cliente';
      const updatedInquiry: InquiryItem = {
        ...targetInquiry,
        reply: isStaff ? newMsg.text : targetInquiry.reply,
        messages: updatedMessages,
        status: isStaff ? 'respondida' : 'pendiente',
        updatedAtIso: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'inquiries', targetInquiry.id), updatedInquiry);
        setInquiries((prev) =>
          prev.map((i) => (i.id === targetInquiry.id ? updatedInquiry : i))
        );

        if (isStaff) {
          await pushUserNotification(
            targetInquiry.clientId,
            `Nueva respuesta sobre ${property.title}`,
            `${currentUser.displayName} respondió en tu conversación: "${truncateText(newMsg.text, 80)}"`,
            'info'
          );
        }
        notify('success', 'Consulta enviada correctamente', 'Tu mensaje se agregó a la conversación en Firestore.');
      } catch (err) {
        notify('error', 'Error al guardar los datos', 'No se pudo enviar el mensaje.');
        handleFirestoreError(err, OperationType.UPDATE, `inquiries/${targetInquiry.id}`);
      }
    } else {
      const inqId = sanitizeId(`inq_${Date.now()}`);
      const newInquiry: InquiryItem = {
        id: inqId,
        propertyId: property.id,
        propertyTitle: property.title,
        clientId: currentUser.uid,
        clientName: currentUser.displayName,
        ownerId: property.ownerId,
        ownerName: property.ownerName,
        agentId: property.agentId || 'usr_agente_demo',
        agentName: property.agentName || 'Valentina Alvear',
        question: newMsg.text,
        reply: '',
        messages: [newMsg],
        status: 'pendiente',
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'inquiries', inqId), newInquiry);
        setInquiries((prev) => [newInquiry, ...prev]);
        notify(
          'success',
          'Consulta enviada correctamente',
          'Se inició el chat con el propietario y agente inmobiliario.'
        );
      } catch (err) {
        notify('error', 'Error al guardar los datos', 'No se pudo crear la consulta.');
        handleFirestoreError(err, OperationType.CREATE, `inquiries/${inqId}`);
      }
    }
  };

  const handleRequestOperation = async (
    property: PropertyItem,
    operationType: OperationTypeChoice,
    offeredAmount: number,
    message: string
  ) => {
    if (!currentUser) return;
    const opId = sanitizeId(`op_${Date.now()}`);
    const newOp: OperationItem = {
      id: opId,
      propertyId: property.id,
      propertyTitle: property.title,
      operationType,
      offeredAmount,
      currency: property.currency,
      clientId: currentUser.uid,
      clientName: currentUser.displayName,
      ownerId: property.ownerId,
      agentId: property.agentId || 'usr_agente_demo',
      status: 'solicitada',
      message,
      createdAtIso: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'operations', opId), newOp);
      setOperations((prev) => [newOp, ...prev]);
      notify(
        'success',
        'Solicitud enviada correctamente',
        `Tu propuesta de ${operationType} por ${property.currency} ${offeredAmount.toLocaleString()} fue registrada.`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo registrar la solicitud.');
      handleFirestoreError(err, OperationType.CREATE, `operations/${opId}`);
    }
  };

  const handleUpdateOperation = async (
    operationId: string,
    status: DealStatus,
    contractData?: {
      contractCode: string;
      contractTerms: string;
      contractStartDate: string;
      contractEndDate: string;
    }
  ) => {
    const existing = operations.find((o) => o.id === operationId);
    if (!existing) return;

    const updated: OperationItem = {
      ...existing,
      status,
      ...(contractData || {}),
    };

    try {
      await setDoc(doc(db, 'operations', operationId), updated);
      setOperations((prev) => prev.map((o) => (o.id === operationId ? updated : o)));

      if (status === 'aprobada') {
        await handleUpdateAvailability(existing.propertyId, 'reservada');
      } else if (status === 'concretada') {
        await handleUpdateAvailability(
          existing.propertyId,
          existing.operationType === 'alquiler' ? 'alquilada' : 'vendida'
        );
      }

      await pushUserNotification(
        existing.clientId,
        `Solicitud ${status.toUpperCase()} — ${existing.propertyTitle}`,
        status === 'aprobada'
          ? `Tu solicitud para "${existing.propertyTitle}" fue ACEPTADA.`
          : status === 'rechazada'
          ? `Tu solicitud para "${existing.propertyTitle}" fue RECHAZADA.`
          : `Tu operación cambió al estado: ${status.toUpperCase()}.`,
        status === 'aprobada' || status === 'concretada'
          ? 'success'
          : status === 'rechazada'
          ? 'warning'
          : 'info'
      );

      notify(
        'success',
        status === 'aprobada'
          ? 'Solicitud aprobada correctamente'
          : status === 'rechazada'
          ? 'Solicitud rechazada'
          : 'Operación actualizada correctamente',
        'Los cambios y notificaciones se guardaron en Firestore.'
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar la operación.');
      handleFirestoreError(err, OperationType.UPDATE, `operations/${operationId}`);
    }
  };

  const handleCreateClaim = async (
    targetType: ClaimTargetType,
    targetReference: string,
    subject: string,
    description: string
  ) => {
    if (!currentUser) return;
    const clmId = sanitizeId(`clm_${Date.now()}`);
    const newClaim: ClaimItem = {
      id: clmId,
      reporterId: currentUser.uid,
      reporterName: currentUser.displayName,
      targetType,
      targetReference,
      subject,
      description,
      status: 'abierto',
      adminResolution: '',
      createdAtIso: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'claims', clmId), newClaim);
      setClaims((prev) => [newClaim, ...prev]);
      notify('success', 'Reclamo enviado correctamente', 'Administración revisará tu caso a la brevedad.');
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo registrar el reclamo.');
      handleFirestoreError(err, OperationType.CREATE, `claims/${clmId}`);
    }
  };

  const handleResolveClaim = async (
    claimId: string,
    status: ClaimStatus,
    adminResolution: string
  ) => {
    const existing = claims.find((c) => c.id === claimId);
    if (!existing) return;
    const updated: ClaimItem = { ...existing, status, adminResolution };

    try {
      await setDoc(doc(db, 'claims', claimId), updated);
      setClaims((prev) => prev.map((c) => (c.id === claimId ? updated : c)));
      await pushUserNotification(
        existing.reporterId,
        `Resolución de reclamo: ${existing.subject}`,
        adminResolution,
        'info'
      );
      notify('success', 'Reclamo resuelto correctamente', 'Se guardó la resolución en Firestore.');
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar el reclamo.');
      handleFirestoreError(err, OperationType.UPDATE, `claims/${claimId}`);
    }
  };

  const handleUpdateUserAdmin = async (uid: string, role: UserRole, active: boolean) => {
    const target = users.find((u) => u.uid === uid);
    if (!target) return;
    const updated: UserProfile = { ...target, role, active };
    try {
      await setDoc(doc(db, 'app_users', uid), updated, { merge: true });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? updated : u)));
      if (currentUser?.uid === uid) {
        setCurrentUser(updated);
      }
      notify(
        'success',
        'Usuario actualizado correctamente',
        `${updated.displayName}: Rol ${role.toUpperCase()} (${active ? 'Activa' : 'Inactiva'}).`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar el usuario.');
      handleFirestoreError(err, OperationType.UPDATE, `app_users/${uid}`);
    }
  };

  const handleAddCategory = async (name: string, kind: 'tipo_inmueble' | 'caracteristica') => {
    const catId = sanitizeId(`cat_${Date.now()}`);
    const newCat: CategoryConfigItem = { id: catId, name, kind, active: true };
    try {
      await setDoc(doc(db, 'categories', catId), newCat);
      setCategories((prev) => [...prev, newCat]);
      notify('success', 'Categoría agregada correctamente', `Se incorporó "${name}" al catálogo.`);
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo crear la categoría.');
      handleFirestoreError(err, OperationType.CREATE, `categories/${catId}`);
    }
  };

  const handleToggleCategory = async (categoryId: string, active: boolean) => {
    const target = categories.find((c) => c.id === categoryId);
    if (!target) return;
    const updated = { ...target, active };
    try {
      await setDoc(doc(db, 'categories', categoryId), updated);
      setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
      notify('info', 'Catálogo actualizado', `"${target.name}" ahora está ${active ? 'activo' : 'inactivo'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `categories/${categoryId}`);
    }
  };

  // ============================================================================
  // AI SMART SEARCH HANDLER
  // ============================================================================
  const handleRunAISearch = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToRun = (customPrompt ?? aiQuery).trim();
    if (!promptToRun) {
      notify('error', 'Error: faltan completar campos', 'Describí qué propiedad estás buscando para consultar a la IA.');
      return;
    }

    setAiLoading(true);
    setActiveSection('buscador_ia');
    try {
      const response = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: promptToRun,
          properties: approvedProperties,
        }),
      });
      if (!response.ok) {
        throw new Error('Error en la respuesta del buscador inteligente');
      }
      const data = (await response.json()) as AISmartSearchResponse;
      setAiResult(data);
      if (data.recommendations.length > 0) {
        notify(
          'success',
          `IA encontró ${data.recommendations.length} ${
            data.recommendations.length === 1 ? 'propiedad compatible' : 'propiedades compatibles'
          }`,
          'Resultados obtenidos analizando las propiedades reales en Firestore.'
        );
      } else {
        notify(
          'info',
          'Sin coincidencias exactas',
          'No se encontraron propiedades que cumplan todos esos criterios. Probá ajustando tu búsqueda.'
        );
      }
    } catch (err) {
      console.error(err);
      notify('error', 'Error al ejecutar la búsqueda con IA', 'Intentá nuevamente en unos segundos.');
    } finally {
      setAiLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterOperation('todos');
    setFilterPropertyType('todos');
    setFilterMaxPrice('');
    setFilterMinRooms(0);
    setFilterMinSurface('');
    setFilterFeatures([]);
    setSortBy('fecha_desc');
  };

  // Role-specific menu items strictly for the logged-in user (inside Hamburger Drawer)
  const roleNavButtons = useMemo(() => {
    if (!currentUser) return [];
    const items: { id: WorkspaceSubView; label: string }[] = [];

    if (currentUser.role === 'cliente') {
      items.push(
        { id: 'cliente_favoritos', label: `Mis Favoritos (${favoriteIds.length})` },
        { id: 'cliente_visitas', label: 'Mis Visitas Programadas' },
        { id: 'cliente_operaciones', label: 'Mis Solicitudes y Reservas' },
        { id: 'cliente_consultas', label: 'Mis Consultas / Chat' }
      );
      if (currentUser.isAlsoOwner) {
        items.push(
          { id: 'propietario_inmuebles', label: 'Mis Inmuebles Publicados' },
          { id: 'propietario_visitas', label: 'Visitas a mis Inmuebles' },
          { id: 'propietario_operaciones', label: 'Ofertas Recibidas' },
          { id: 'propietario_consultas', label: 'Chat con Interesados' }
        );
      }
      items.push({ id: 'reclamos_usuario', label: 'Soporte y Reclamos' });
    } else if (currentUser.role === 'propietario') {
      items.push(
        { id: 'propietario_inmuebles', label: 'Mis Inmuebles Publicados' },
        { id: 'propietario_visitas', label: 'Visitas Solicitadas' },
        { id: 'propietario_operaciones', label: 'Ofertas y Contratos' },
        { id: 'propietario_consultas', label: 'Consultas / Chat' },
        { id: 'cliente_favoritos', label: `Mis Favoritos (${favoriteIds.length})` },
        { id: 'reclamos_usuario', label: 'Soporte y Reclamos' }
      );
    } else if (currentUser.role === 'agente') {
      items.push(
        { id: 'agente_cartera', label: 'Propiedades Asignadas' },
        { id: 'agente_visitas', label: 'Agenda de Visitas' },
        { id: 'agente_operaciones', label: 'Operaciones y Contratos' },
        { id: 'agente_consultas', label: 'Atención de Consultas / Chat' },
        { id: 'reclamos_usuario', label: 'Soporte y Reclamos' }
      );
    } else if (currentUser.role === 'administrador') {
      items.push(
        { id: 'admin_dashboard', label: 'Panel de Control y Métricas' },
        { id: 'admin_publicaciones', label: 'Moderación de Publicaciones' },
        { id: 'admin_usuarios', label: 'Gestión de Usuarios y Roles' },
        { id: 'admin_categorias', label: 'Tipos y Características' },
        { id: 'admin_reclamos', label: 'Centro de Reclamos' }
      );
    }
    return items;
  }, [currentUser, favoriteIds.length]);

  const heroFeaturedProperty =
    approvedProperties[heroShowcaseIdx % Math.max(1, approvedProperties.length)] ||
    INITIAL_PROPERTIES[0];

  const markAllNotificationsRead = async () => {
    const unread = myNotifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    for (const item of unread) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), { read: true });
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFBF7] text-[#1F241F]">
      {/* =====================================================================
          TOAST NOTIFICATIONS
         ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-sm border shadow-md animate-fade-slide ${
              t.type === 'success'
                ? 'bg-[#39483A] text-[#FCFBF7] border-[#A8B5A0]'
                : t.type === 'error'
                ? 'bg-[#B86F52] text-[#FCFBF7] border-[#D8C7AA]'
                : 'bg-[#F5F1E8] text-[#1F241F] border-[#D8C7AA]'
            }`}
          >
            <div className="flex-1 text-xs">
              <div className="font-semibold text-sm">{t.title}</div>
              {t.description && <p className="opacity-90 mt-0.5 leading-relaxed">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* =====================================================================
          MINIMALIST ARCHITECTURAL HEADER WITH INTEGRATED HAMBURGER MENU
          (No second horizontal bar; no role switcher dropdown)
         ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#FCFBF7]/95 backdrop-blur-xs border-b border-[#D8C7AA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Left: Hamburger Menu Button + Brand Wordmark */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSideMenuOpen((prev) => !prev)}
              className="p-2.5 text-[#39483A] hover:bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm transition-colors flex items-center gap-2"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
              <span className="hidden sm:inline text-xs uppercase tracking-widest font-semibold">
                Menú
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('catalogo')}
              className="text-left"
            >
              <span className="text-2xl sm:text-3xl font-serif-display font-semibold tracking-tight text-[#39483A] block leading-none">
                ClaveHogar
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#B86F52] block mt-1">
                Arquitectura &amp; Propiedades
              </span>
            </button>
          </div>

          {/* Center: Clean Editorial Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveSection('catalogo')}
              className={`text-xs uppercase tracking-[0.16em] font-semibold pb-1 border-b-2 transition-colors ${
                activeSection === 'catalogo'
                  ? 'border-[#39483A] text-[#39483A]'
                  : 'border-transparent text-[#39483A]/70 hover:text-[#39483A]'
              }`}
            >
              Catálogo
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('buscador_ia')}
              className={`text-xs uppercase tracking-[0.16em] font-semibold pb-1 border-b-2 transition-colors ${
                activeSection === 'buscador_ia'
                  ? 'border-[#B86F52] text-[#B86F52]'
                  : 'border-transparent text-[#39483A]/70 hover:text-[#39483A]'
              }`}
            >
              Buscador IA
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('comparador')}
              className={`text-xs uppercase tracking-[0.16em] font-semibold pb-1 border-b-2 transition-colors ${
                activeSection === 'comparador'
                  ? 'border-[#39483A] text-[#39483A]'
                  : 'border-transparent text-[#39483A]/70 hover:text-[#39483A]'
              }`}
            >
              Comparador ({comparedIds.length})
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveSection('panel_rol')}
                className={`text-xs uppercase tracking-[0.16em] font-semibold pb-1 border-b-2 transition-colors ${
                  activeSection === 'panel_rol'
                    ? 'border-[#39483A] text-[#39483A]'
                    : 'border-transparent text-[#39483A]/70 hover:text-[#39483A]'
                }`}
              >
                Mi Espacio
              </button>
            )}
          </nav>

          {/* Right: Auth & User Actions (Without role selector dropdown) */}
          <div className="flex items-center gap-3">
            {!currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-[#39483A] border border-[#D8C7AA] hover:bg-[#F5F1E8] rounded-sm transition-colors"
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="px-4 py-2 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                >
                  Registrarse
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotifDropdown((prev) => !prev);
                      if (!showNotifDropdown && unreadCount > 0) {
                        markAllNotificationsRead();
                      }
                    }}
                    className="relative p-2.5 text-[#39483A] hover:bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm transition-colors"
                    title="Notificaciones"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#B86F52] text-[10px] font-bold flex items-center justify-center text-[#FCFBF7]">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-[#FCFBF7] text-[#1F241F] border border-[#D8C7AA] rounded-sm shadow-lg p-4 z-50 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#D8C7AA] pb-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#39483A]">
                          Notificaciones
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNotifDropdown(false)}
                          className="text-xs text-[#39483A]/70 hover:text-[#1F241F]"
                        >
                          Cerrar
                        </button>
                      </div>
                      {myNotifications.length === 0 ? (
                        <p className="text-xs text-[#39483A]/70 py-4 text-center">
                          No tenés notificaciones recientes.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {myNotifications.slice(0, 8).map((n) => (
                            <div
                              key={n.id}
                              className="p-2.5 rounded-sm bg-[#F5F1E8] border border-[#D8C7AA] text-xs space-y-1"
                            >
                              <div className="font-semibold text-[#39483A]">{n.title}</div>
                              <p className="text-[#1F241F]/80 leading-snug">{n.message}</p>
                              <div className="text-[10px] text-[#39483A]/60 font-tabular">
                                {n.createdAtIso.slice(0, 16).replace('T', ' ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Profile Button */}
                <button
                  type="button"
                  onClick={() => openAuthModal('profile')}
                  className="flex items-center gap-2 px-3 py-2 bg-[#F5F1E8] hover:bg-[#D8C7AA]/40 border border-[#D8C7AA] rounded-sm text-left transition-colors"
                >
                  <User className="w-4 h-4 text-[#39483A] shrink-0" />
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-[#1F241F] leading-none">
                      {currentUser.displayName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[#B86F52] uppercase tracking-wider leading-none mt-0.5">
                      {currentUser.role}
                    </div>
                  </div>
                </button>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2.5 text-[#39483A] hover:text-[#B86F52] hover:bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          SLIDE-OVER HAMBURGER LATERAL MENU PANEL (Requirement 2)
          Closes when clicking outside backdrop, close button, or any option
         ===================================================================== */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop (click outside to close) */}
          <div
            onClick={() => setIsSideMenuOpen(false)}
            className="fixed inset-0 bg-[#1F241F]/50 transition-opacity"
            aria-hidden="true"
          />

          {/* Side Panel */}
          <aside className="relative z-10 w-80 max-w-[85vw] bg-[#FCFBF7] border-r border-[#D8C7AA] h-full flex flex-col justify-between overflow-y-auto p-6">
            <div className="space-y-8">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#D8C7AA] pb-4">
                <div>
                  <span className="text-xl font-serif-display font-semibold text-[#39483A] block">
                    ClaveHogar
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#B86F52]">
                    Navegación General
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSideMenuOpen(false)}
                  className="p-2 text-[#39483A] hover:bg-[#F5F1E8] rounded-sm"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Sections */}
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#39483A]/60 font-semibold px-2 mb-2">
                  Explorar Plataforma
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('catalogo');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm font-medium rounded-sm transition-colors ${
                    activeSection === 'catalogo'
                      ? 'bg-[#39483A] text-[#FCFBF7]'
                      : 'text-[#1F241F] hover:bg-[#F5F1E8]'
                  }`}
                >
                  Catálogo de Propiedades
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('buscador_ia');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm font-medium rounded-sm transition-colors ${
                    activeSection === 'buscador_ia'
                      ? 'bg-[#39483A] text-[#FCFBF7]'
                      : 'text-[#1F241F] hover:bg-[#F5F1E8]'
                  }`}
                >
                  Buscador Inteligente con IA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('comparador');
                    setIsSideMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-sm font-medium rounded-sm transition-colors ${
                    activeSection === 'comparador'
                      ? 'bg-[#39483A] text-[#FCFBF7]'
                      : 'text-[#1F241F] hover:bg-[#F5F1E8]'
                  }`}
                >
                  Comparador de Inmuebles ({comparedIds.length})
                </button>
              </div>

              {/* Current User Role Options */}
              {currentUser ? (
                <div className="space-y-2 pt-2 border-t border-[#D8C7AA]">
                  <div className="px-2 py-1">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
                      Opciones de {currentUser.role}
                    </span>
                    <span className="text-sm font-serif-display font-semibold text-[#39483A]">
                      {currentUser.displayName}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {roleNavButtons.map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setActiveSection('panel_rol');
                          setActiveSubView(btn.id);
                          setIsSideMenuOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold rounded-sm transition-colors ${
                          activeSection === 'panel_rol' && activeSubView === btn.id
                            ? 'bg-[#39483A] text-[#FCFBF7]'
                            : 'text-[#39483A] hover:bg-[#F5F1E8]'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {currentUser.role === 'cliente' && !currentUser.isAlsoOwner && (
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={handleEnableOwnerRole}
                        className="w-full py-2.5 px-3.5 text-xs font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors text-left"
                      >
                        + Publicar una propiedad (Habilitar Propietario)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-4 border-t border-[#D8C7AA]">
                  <p className="text-xs text-[#39483A]/80 px-1">
                    Iniciá sesión para acceder a tus favoritos, reservas, publicaciones y chat.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideMenuOpen(false);
                      openAuthModal('login');
                    }}
                    className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideMenuOpen(false);
                      openAuthModal('register');
                    }}
                    className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#39483A] border border-[#D8C7AA] bg-[#F5F1E8] rounded-sm"
                  >
                    Registrarse
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {currentUser && (
              <div className="pt-4 border-t border-[#D8C7AA] space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSideMenuOpen(false);
                    openAuthModal('profile');
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#39483A] hover:bg-[#F5F1E8] rounded-sm"
                >
                  Editar Mi Perfil Personal
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#B86F52] hover:bg-[#F5F1E8] rounded-sm"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* =====================================================================
          MAIN VIEWPORT CONTENT
         ===================================================================== */}
      <main className="flex-1">
        {/* ===================================================================
            VIEW 1: CATÁLOGO PRINCIPAL + HERO EDITORIAL ARQUITECTÓNICO
           =================================================================== */}
        {activeSection === 'catalogo' && (
          <div>
            {/* Editorial Architectural Hero */}
            <section className="bg-[#F5F1E8] border-b border-[#D8C7AA] py-12 lg:py-20">
              <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                {/* Left Column: Editorial Typography & AI Search */}
                <div className="lg:col-span-6 space-y-6 animate-fade-slide">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#B86F52] font-semibold">
                    Curaduría Inmobiliaria · Alquiler &amp; Venta
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-serif-display font-semibold tracking-tight leading-[1.06] text-[#39483A]">
                    Arquitectura pensada para ser habitada.
                  </h1>

                  <p className="text-base text-[#1F241F]/80 max-w-xl leading-relaxed">
                    Explorá residencias, casas con jardín y departamentos seleccionados. Describí con tus propias palabras el espacio que buscás y dejá que nuestra búsqueda inteligente te recomiende las mejores opciones reales.
                  </p>

                  {/* Clean Editorial AI Search Box */}
                  <form
                    onSubmit={(e) => handleRunAISearch(e)}
                    className="bg-[#FCFBF7] p-4 rounded-sm border border-[#D8C7AA] space-y-3"
                  >
                    <label className="block text-[11px] uppercase tracking-widest text-[#39483A] font-semibold">
                      Buscador Inteligente con IA
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                        placeholder="Ej: Busco una casa de 3 habitaciones, con pileta, cerca de Quilmes..."
                        className="flex-1 px-4 py-3 text-sm bg-white text-[#1F241F] placeholder:text-[#39483A]/50 rounded-sm border border-[#D8C7AA] focus:outline-none focus:border-[#39483A]"
                      />
                      <button
                        type="submit"
                        disabled={aiLoading}
                        className="px-6 py-3 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors shrink-0 cursor-pointer"
                      >
                        {aiLoading ? 'Analizando...' : 'Buscar con IA'}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#39483A]/80">
                      <span className="font-semibold text-[#B86F52]">Sugerencias:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAiQuery(AI_PROMPT_SUGGESTIONS[0]);
                          handleRunAISearch(undefined, AI_PROMPT_SUGGESTIONS[0]);
                        }}
                        className="underline hover:text-[#39483A] transition-colors text-left"
                      >
                        Casa 3 hab. con pileta en Quilmes
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAiQuery(AI_PROMPT_SUGGESTIONS[1]);
                          handleRunAISearch(undefined, AI_PROMPT_SUGGESTIONS[1]);
                        }}
                        className="underline hover:text-[#39483A] transition-colors text-left"
                      >
                        Depto en Palermo con terraza
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Large Architectural Photography Feature */}
                <div className="lg:col-span-6">
                  <div
                    onClick={() => setSelectedProperty(heroFeaturedProperty)}
                    className="group cursor-pointer bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm overflow-hidden transition-colors hover:border-[#39483A]"
                  >
                    <div className="relative aspect-[16/11] overflow-hidden bg-[#D8C7AA]">
                      <img
                        src={heroFeaturedProperty.images[0] || HERO_IMAGE}
                        alt={heroFeaturedProperty.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== HERO_IMAGE) {
                            e.currentTarget.src = HERO_IMAGE;
                          }
                        }}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4 bg-[#FCFBF7]/95 text-[#39483A] px-3 py-1 text-[11px] uppercase tracking-widest font-semibold border border-[#D8C7AA]">
                        {heroFeaturedProperty.operationType === 'alquiler' ? 'Alquiler' : 'Venta'} · {heroFeaturedProperty.propertyType}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FCFBF7]">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider text-[#B86F52] font-semibold">
                          {heroFeaturedProperty.location}
                        </div>
                        <h3 className="text-2xl font-serif-display font-semibold text-[#1F241F] line-clamp-1">
                          {heroFeaturedProperty.title}
                        </h3>
                      </div>
                      <div className=" sm:text-right shrink-0">
                        <span className="text-xl font-semibold font-tabular text-[#39483A] block">
                          {heroFeaturedProperty.currency} {heroFeaturedProperty.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-[#39483A]/75 font-tabular">
                          {heroFeaturedProperty.bedrooms} dorm. · {heroFeaturedProperty.surface} m²
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subtle Editorial Pagination */}
                  <div className="flex items-center justify-end gap-2 mt-3">
                    {approvedProperties.slice(0, 5).map((prop, idx) => (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => setHeroShowcaseIdx(idx)}
                        className={`h-1.5 transition-all ${
                          idx === heroShowcaseIdx % Math.min(5, approvedProperties.length)
                            ? 'w-8 bg-[#39483A]'
                            : 'w-3 bg-[#D8C7AA] hover:bg-[#A8B5A0]'
                        }`}
                        aria-label={`Ver destacada ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Editorial Filter & Search Bar */}
            <section className="max-w-7xl mx-auto px-6 pt-10">
              <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                  <div className="lg:col-span-4 relative">
                    <Search className="w-4 h-4 text-[#39483A]/60 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por localidad (Quilmes, Palermo...), dirección o título"
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <select
                      value={filterOperation}
                      onChange={(e) => setFilterOperation(e.target.value as 'todos' | 'alquiler' | 'venta')}
                      className="w-full px-3 py-2.5 text-xs font-medium bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                    >
                      <option value="todos">Operación: Todas</option>
                      <option value="venta">En Venta</option>
                      <option value="alquiler">En Alquiler</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <select
                      value={filterPropertyType}
                      onChange={(e) => setFilterPropertyType(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-medium bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                    >
                      <option value="todos">Inmueble: Todos</option>
                      {activePropertyTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as 'fecha_desc' | 'precio_asc' | 'precio_desc')
                      }
                      className="w-full px-3 py-2.5 text-xs font-medium bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm focus:outline-none focus:border-[#39483A]"
                    >
                      <option value="fecha_desc">Orden: Más recientes</option>
                      <option value="precio_asc">Precio: Menor a mayor</option>
                      <option value="precio_desc">Precio: Mayor a menor</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-sm border flex items-center justify-center gap-1.5 transition-colors ${
                        showAdvancedFilters
                          ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                          : 'bg-[#FCFBF7] text-[#39483A] border-[#D8C7AA] hover:bg-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Filtros
                    </button>
                    <button
                      type="button"
                      onClick={resetFilters}
                      title="Limpiar filtros"
                      className="p-2.5 text-[#39483A] hover:text-[#B86F52] bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showAdvancedFilters && (
                  <div className="pt-4 border-t border-[#D8C7AA] space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#39483A] mb-1">
                          Precio Máximo
                        </label>
                        <input
                          type="number"
                          value={filterMaxPrice}
                          onChange={(e) => setFilterMaxPrice(e.target.value)}
                          placeholder="Ej. 200000"
                          className="w-full px-3 py-2 text-xs bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm font-tabular"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#39483A] mb-1">
                          Mínimo de Ambientes
                        </label>
                        <select
                          value={filterMinRooms}
                          onChange={(e) => setFilterMinRooms(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm"
                        >
                          <option value={0}>Sin mínimo</option>
                          <option value={2}>2+ ambientes</option>
                          <option value={3}>3+ ambientes</option>
                          <option value={4}>4+ ambientes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#39483A] mb-1">
                          Superficie Mínima (m²)
                        </label>
                        <input
                          type="number"
                          value={filterMinSurface}
                          onChange={(e) => setFilterMinSurface(e.target.value)}
                          placeholder="Ej. 100"
                          className="w-full px-3 py-2 text-xs bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm font-tabular"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-[#39483A] mb-2">
                        Filtrar por comodidades:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {activeFeatures.map((feat) => {
                          const selected = filterFeatures.includes(feat);
                          return (
                            <button
                              key={feat}
                              type="button"
                              onClick={() =>
                                setFilterFeatures((prev) =>
                                  selected ? prev.filter((f) => f !== feat) : [...prev, feat]
                                )
                              }
                              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors flex items-center gap-1.5 ${
                                selected
                                  ? 'bg-[#39483A] text-[#FCFBF7] border-[#39483A]'
                                  : 'bg-[#FCFBF7] text-[#39483A] border-[#D8C7AA] hover:bg-white'
                              }`}
                            >
                              {selected && <Check className="w-3.5 h-3.5" />}
                              {feat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Editorial Properties Catalog Grid */}
            <section className="max-w-7xl mx-auto px-6 py-14 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D8C7AA] pb-5">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block mb-1">
                    Colección Residencial
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-serif-display font-semibold text-[#39483A]">
                    Propiedades Disponibles
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#39483A]/75 font-tabular">
                    {filteredProperties.length} {filteredProperties.length === 1 ? 'inmueble' : 'inmuebles'}
                  </span>
                  {currentUser &&
                    (currentUser.role === 'propietario' ||
                      currentUser.role === 'administrador' ||
                      currentUser.isAlsoOwner) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProperty(null);
                          setIsPropertyFormOpen(true);
                        }}
                        className="px-4 py-2.5 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                      >
                        + Publicar Propiedad
                      </button>
                    )}
                </div>
              </div>

              {filteredProperties.length === 0 ? (
                <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm p-12 text-center space-y-4">
                  <p className="text-lg font-serif-display font-semibold text-[#39483A]">
                    No se encontraron propiedades con los filtros seleccionados.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-5 py-2.5 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] rounded-sm hover:bg-[#2c382d]"
                  >
                    Restablecer filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                  {filteredProperties.map((prop) => {
                    const isFav = favoriteIds.includes(prop.id);
                    const isComp = comparedIds.includes(prop.id);
                    return (
                      <article
                        key={prop.id}
                        className="group flex flex-col justify-between bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm overflow-hidden hover:border-[#39483A] transition-colors"
                      >
                        <div>
                          {/* Prominent Photography */}
                          <div
                            onClick={() => setSelectedProperty(prop)}
                            className="relative aspect-[4/3] bg-[#F5F1E8] overflow-hidden cursor-pointer"
                          >
                            <img
                              src={prop.images[0] || HERO_IMAGE}
                              alt={prop.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.currentTarget.src !== HERO_IMAGE) {
                                  e.currentTarget.src = HERO_IMAGE;
                                }
                              }}
                              className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-700"
                            />

                            <div className="absolute top-3 left-3 bg-[#FCFBF7]/95 text-[#39483A] px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold border border-[#D8C7AA]">
                              {prop.operationType === 'alquiler' ? 'Alquiler' : 'Venta'} · {prop.propertyType}
                            </div>

                            <div
                              className="absolute top-3 right-3 flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleCompare(prop.id)}
                                title="Comparar propiedad"
                                className={`p-2 rounded-sm transition-colors ${
                                  isComp
                                    ? 'bg-[#39483A] text-[#FCFBF7]'
                                    : 'bg-[#FCFBF7]/90 text-[#39483A] hover:bg-[#FCFBF7]'
                                }`}
                              >
                                <Scale className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(prop.id)}
                                title="Guardar en favoritos"
                                className={`p-2 rounded-sm transition-colors ${
                                  isFav
                                    ? 'bg-[#B86F52] text-[#FCFBF7]'
                                    : 'bg-[#FCFBF7]/90 text-[#39483A] hover:bg-[#FCFBF7]'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* Editorial Card Content */}
                          <div className="p-6 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="uppercase tracking-wider text-[#B86F52] font-semibold truncate">
                                {prop.location}
                              </span>
                              <span className="text-[11px] uppercase tracking-wider text-[#39483A]/70">
                                {prop.availability}
                              </span>
                            </div>

                            <h3
                              onClick={() => setSelectedProperty(prop)}
                              className="text-2xl font-serif-display font-semibold text-[#1F241F] group-hover:text-[#39483A] transition-colors line-clamp-2 cursor-pointer leading-snug"
                            >
                              {prop.title}
                            </h3>

                            <p className="text-xs text-[#39483A]/80 line-clamp-2 leading-relaxed">
                              {prop.description}
                            </p>
                          </div>
                        </div>

                        <div className="px-6 pb-6 pt-3 border-t border-[#D8C7AA]/60 space-y-4">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xl font-semibold font-tabular text-[#39483A]">
                              {prop.currency} {prop.price.toLocaleString()}
                            </span>
                            <span className="text-xs text-[#39483A]/80 font-tabular">
                              {prop.bedrooms} dorm. · {prop.bathrooms} baños · {prop.surface} m²
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedProperty(prop)}
                            className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#39483A] bg-[#F5F1E8] hover:bg-[#39483A] hover:text-[#FCFBF7] border border-[#D8C7AA] rounded-sm transition-colors flex items-center justify-center gap-2"
                          >
                            Ver Propiedad
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            VIEW 2: BUSCADOR INTELIGENTE CON IA
           =================================================================== */}
        {activeSection === 'buscador_ia' && (
          <section className="max-w-7xl mx-auto px-6 py-12 space-y-10">
            <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm p-8 sm:p-10 space-y-6">
              <div className="max-w-3xl space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B86F52] block">
                  Asesoramiento Inteligente
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif-display font-semibold text-[#39483A]">
                  Buscador de Propiedades en Lenguaje Natural
                </h1>
                <p className="text-sm text-[#1F241F]/80 leading-relaxed">
                  Describí qué tipo de propiedad buscás (ubicación, dormitorios, jardín o pileta, presupuesto máximo y operación). El sistema interpreta tu pedido y selecciona los inmuebles reales almacenados en Firestore.
                </p>
              </div>

              <form onSubmit={(e) => handleRunAISearch(e)} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Ej: Busco una casa de 3 habitaciones, con pileta, cerca de Quilmes y con un presupuesto máximo de $200.000."
                    className="flex-1 px-4 py-3.5 text-sm bg-[#FCFBF7] text-[#1F241F] rounded-sm border border-[#D8C7AA] focus:outline-none focus:border-[#39483A]"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="px-7 py-3.5 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors shrink-0 disabled:opacity-50"
                  >
                    {aiLoading ? 'Analizando catálogo...' : 'Analizar y Recomendar'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {AI_PROMPT_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setAiQuery(sug);
                        handleRunAISearch(undefined, sug);
                      }}
                      className="text-xs bg-[#FCFBF7] hover:bg-[#39483A] hover:text-[#FCFBF7] text-[#39483A] px-3 py-1.5 rounded-sm border border-[#D8C7AA] transition-colors text-left"
                    >
                      “{sug}”
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {aiLoading && (
              <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-12 text-center space-y-2">
                <div className="text-lg font-serif-display font-semibold text-[#39483A]">
                  Evaluando inmuebles compatibles en Firestore...
                </div>
              </div>
            )}

            {!aiLoading && aiResult && (
              <div className="space-y-8 animate-fade-slide">
                <div className="bg-[#FCFBF7] border border-[#D8C7AA] rounded-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#D8C7AA] pb-3">
                    <h2 className="text-xl font-serif-display font-semibold text-[#39483A]">
                      Síntesis de Búsqueda
                    </h2>
                    <span className="text-xs font-semibold text-[#B86F52]">
                      {aiResult.recommendations.length} coincidencias encontradas
                    </span>
                  </div>
                  <p className="text-sm text-[#1F241F]/85">{aiResult.interpretedPreferences.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-sm bg-[#F5F1E8] border border-[#D8C7AA]">
                      <span className="text-[#39483A]/70 block">Operación</span>
                      <strong className="text-[#1F241F] capitalize">
                        {aiResult.interpretedPreferences.operationType}
                      </strong>
                    </div>
                    <div className="p-3 rounded-sm bg-[#F5F1E8] border border-[#D8C7AA]">
                      <span className="text-[#39483A]/70 block">Zonas</span>
                      <strong className="text-[#1F241F]">
                        {aiResult.interpretedPreferences.preferredLocations.join(', ')}
                      </strong>
                    </div>
                    <div className="p-3 rounded-sm bg-[#F5F1E8] border border-[#D8C7AA]">
                      <span className="text-[#39483A]/70 block">Presupuesto máximo</span>
                      <strong className="text-[#1F241F] font-tabular">
                        {aiResult.interpretedPreferences.maxPrice > 0
                          ? `USD ${aiResult.interpretedPreferences.maxPrice.toLocaleString()}`
                          : 'Flexible'}
                      </strong>
                    </div>
                    <div className="p-3 rounded-sm bg-[#F5F1E8] border border-[#D8C7AA]">
                      <span className="text-[#39483A]/70 block">Atributos buscados</span>
                      <strong className="text-[#1F241F]">
                        {aiResult.interpretedPreferences.keyFeatures.join(', ')}
                      </strong>
                    </div>
                  </div>
                </div>

                {aiResult.recommendations.length === 0 ? (
                  <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm p-10 text-center space-y-3">
                    <h3 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                      No encontramos propiedades que coincidan con todos esos requisitos
                    </h3>
                    <p className="text-sm text-[#39483A]/80 max-w-lg mx-auto">
                      Ninguna de las propiedades activas en Firestore cumple simultáneamente con la zona, presupuesto o comodidades solicitadas. Probá ampliando el rango de búsqueda.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {aiResult.recommendations.map((rec) => {
                      const prop = properties.find((p) => p.id === rec.propertyId);
                      if (!prop) return null;
                      return (
                        <div
                          key={rec.propertyId}
                          className="bg-[#FCFBF7] border border-[#D8C7AA] hover:border-[#39483A] rounded-sm overflow-hidden flex flex-col justify-between transition-colors"
                        >
                          <div>
                            <div className="relative aspect-[4/3] bg-[#F5F1E8]">
                              <img
                                src={prop.images[0] || HERO_IMAGE}
                                alt={prop.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  if (e.currentTarget.src !== HERO_IMAGE) {
                                    e.currentTarget.src = HERO_IMAGE;
                                  }
                                }}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 left-3 px-3 py-1 bg-[#39483A] text-[#FCFBF7] text-xs font-semibold font-tabular">
                                {rec.matchScore}% Compatibilidad
                              </div>
                            </div>

                            <div className="p-6 space-y-3">
                              <div className="text-xs uppercase tracking-wider font-semibold text-[#B86F52]">
                                {prop.location} · {prop.currency} {prop.price.toLocaleString()}
                              </div>
                              <h3 className="text-2xl font-serif-display font-semibold text-[#1F241F]">
                                {prop.title}
                              </h3>
                              <div className="p-3.5 bg-[#F5F1E8] border-l-2 border-[#B86F52] text-xs text-[#1F241F]/85 leading-relaxed">
                                {rec.explanation}
                              </div>
                              <div className="text-xs text-[#39483A]/80 font-tabular">
                                {prop.bedrooms} dormitorios · {prop.bathrooms} baños · {prop.surface} m²
                              </div>
                            </div>
                          </div>

                          <div className="p-6 pt-0">
                            <button
                              type="button"
                              onClick={() => setSelectedProperty(prop)}
                              className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#FCFBF7] bg-[#39483A] hover:bg-[#2c382d] rounded-sm transition-colors"
                            >
                              Ver Ficha Completa
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================================================================
            VIEW 3: COMPARADOR DE PROPIEDADES
           =================================================================== */}
        {activeSection === 'comparador' && (
          <ComparatorView
            comparedProperties={comparedProperties}
            allFeatures={activeFeatures}
            onRemoveFromCompare={handleToggleCompare}
            onClearCompare={() => setComparedIds([])}
            onSelectProperty={(prop) => setSelectedProperty(prop)}
            onGoToCatalog={() => setActiveSection('catalogo')}
          />
        )}

        {/* ===================================================================
            VIEW 4: PANEL ESPECÍFICO DEL USUARIO LOGUEADO
           =================================================================== */}
        {activeSection === 'panel_rol' && currentUser && (
          <RoleWorkspaceView
            currentUser={currentUser}
            activeSubView={activeSubView}
            onChangeSubView={setActiveSubView}
            users={users}
            properties={properties}
            favoriteIds={favoriteIds}
            visits={visits}
            inquiries={inquiries}
            operations={operations}
            claims={claims}
            categories={categories}
            onEnableOwnerRole={handleEnableOwnerRole}
            onOpenNewProperty={() => {
              setEditingProperty(null);
              setIsPropertyFormOpen(true);
            }}
            onOpenEditProperty={(prop) => {
              setEditingProperty(prop);
              setIsPropertyFormOpen(true);
            }}
            onSelectProperty={(prop) => setSelectedProperty(prop)}
            onDeleteProperty={handleDeleteProperty}
            onUpdateAvailability={handleUpdateAvailability}
            onAssignAgent={handleAssignAgent}
            onModerateProperty={handleModerateProperty}
            onToggleFavorite={handleToggleFavorite}
            onUpdateVisit={handleUpdateVisit}
            onSendChatMessage={handleSendChatMessage}
            onUpdateOperation={handleUpdateOperation}
            onCreateClaim={handleCreateClaim}
            onResolveClaim={handleResolveClaim}
            onUpdateUserAdmin={handleUpdateUserAdmin}
            onAddCategory={handleAddCategory}
            onToggleCategory={handleToggleCategory}
          />
        )}
      </main>

      {/* =====================================================================
          MODALS
         ===================================================================== */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          currentUser={currentUser}
          isFavorite={favoriteIds.includes(selectedProperty.id)}
          isCompared={comparedIds.includes(selectedProperty.id)}
          aiReason={
            aiResult?.recommendations.find((r) => r.propertyId === selectedProperty.id)?.explanation
          }
          aiScore={
            aiResult?.recommendations.find((r) => r.propertyId === selectedProperty.id)?.matchScore
          }
          inquiries={inquiries}
          onClose={() => setSelectedProperty(null)}
          onRequireLogin={() => openAuthModal('login')}
          onToggleFavorite={handleToggleFavorite}
          onToggleCompare={handleToggleCompare}
          onRequestVisit={handleRequestVisit}
          onSendChatMessage={handleSendChatMessage}
          onRequestOperation={handleRequestOperation}
          onNotify={notify}
        />
      )}

      <PropertyFormModal
        isOpen={isPropertyFormOpen}
        editingProperty={editingProperty}
        categories={categories}
        onClose={() => {
          setIsPropertyFormOpen(false);
          setEditingProperty(null);
        }}
        onSave={handleSaveProperty}
        onNotify={notify}
      />

      <AuthProfileModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        currentUser={currentUser}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleLogin={handleGoogleLogin}
        onLoginSubmit={handleLoginSubmit}
        onRegisterSubmit={handleRegisterSubmit}
        onPasswordReset={handlePasswordReset}
        onUpdateProfile={handleUpdateProfile}
        onEnableOwnerRole={handleEnableOwnerRole}
        onQuickRoleLogin={handleQuickRoleLogin}
      />
    </div>
  );
}
