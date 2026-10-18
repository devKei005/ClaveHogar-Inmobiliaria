import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Sparkles,
  Edit3,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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
  DEMO_ROLE_EMAILS,
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
import {
  RoleWorkspaceView,
  WorkspaceSubView,
  isAgentConfirmedOnProperty,
} from './components/RoleWorkspaceView';
import {
  canUserEditProperty,
  isUserOwnerOfProperty,
  isUserAssignedAgentOfProperty,
  getMinVisitDate,
} from './utils/propertyPermissions';
import {
  buildFlexibleSmartSearch,
  normalizeSearchText,
} from './utils/smartSearchEngine';

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

  // Hamburger Side Drawer state
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Auth & User state
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const usersRef = useRef<UserProfile[]>(INITIAL_USERS);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const isDemoSessionRef = useRef<boolean>(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Core Entities state (synced with Firestore)
  const [properties, setProperties] = useState<PropertyItem[]>(INITIAL_PROPERTIES);
  const [allFavorites, setAllFavorites] = useState<{ userId: string; propertyId: string }[]>([]);
  const [comparedByUser, setComparedByUser] = useState<Record<string, string[]>>({});
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
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AISmartSearchResponse | null>(null);

  // Limpiar los inputs de búsqueda automáticamente al cambiar de sección para que no quede texto viejo sin limpiar
  useEffect(() => {
    setAiQuery('');
    setSearchQuery('');
  }, [activeSection]);

  // Per-user favorites and per-user comparator
  const favoriteIds = useMemo(() => {
    if (!currentUser) return [];
    return Array.from(
      new Set(
        allFavorites
          .filter((f) => f.userId === currentUser.uid)
          .map((f) => f.propertyId)
      )
    );
  }, [allFavorites, currentUser]);

  const compareScopeKey = currentUser?.uid || 'guest';
  const comparedIds = useMemo(
    () => comparedByUser[compareScopeKey] || [],
    [comparedByUser, compareScopeKey]
  );

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
    if (!targetUserId || !targetUserId.trim()) return;
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
    setNotifications((prev) =>
      prev.some((n) => n.id === id) ? prev : [newNotif, ...prev]
    );
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

  const availableAgents = useMemo(
    () => users.filter((u) => u.role === 'agente' && u.active),
    [users]
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

    const getStoredAvatars = (): Record<string, string> => {
      try {
        const raw = localStorage.getItem('clavehogar_user_avatars');
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
      } catch {
        return {};
      }
    };

    const unsubUsers = onSnapshot(
      collection(db, 'app_users'),
      (snap) => {
        if (!mounted || snap.empty) return;
        const storedAvatars = getStoredAvatars();
        const userMap = new Map<string, UserProfile>();

        // 1. Cargamos primero los usuarios reales guardados en Firestore
        snap.docs.forEach((d) => {
          const raw = d.data() as Partial<UserProfile>;
          const uid = raw.uid || d.id;
          const email = (raw.email || '').trim().toLowerCase();
          const cachedPhoto =
            storedAvatars[uid] ?? (email ? storedAvatars[email] : '');

          const profile: UserProfile = {
            uid,
            displayName: raw.displayName || (email ? email.split('@')[0] : 'Usuario'),
            email: raw.email ? raw.email.trim() : `${uid}@clavehogar.com`,
            phone: raw.phone || '+54 9 11 4000-0000',
            address: raw.address || 'Buenos Aires, Argentina',
            dni: raw.dni || '',
            role: (raw.role as UserRole) || 'cliente',
            isAlsoOwner: Boolean(raw.isAlsoOwner),
            active: raw.active !== false,
            agencyName: raw.agencyName || '',
            bio: raw.bio || '',
            photoUrl: raw.photoUrl || cachedPhoto || '',
          };

          if (email) userMap.set(`email:${email}`, profile);
          if (uid) userMap.set(`uid:${uid}`, profile);
        });

        // 2. Solo incorporamos las cuentas demo oficiales si NI su email NI su UID existen en Firestore
        for (const demoUser of INITIAL_USERS) {
          const demoEmail = demoUser.email.trim().toLowerCase();
          const demoUid = demoUser.uid;
          if (!userMap.has(`email:${demoEmail}`) && !userMap.has(`uid:${demoUid}`)) {
            const cachedPhoto =
              storedAvatars[demoUid] ?? storedAvatars[demoEmail];
            const profile: UserProfile = {
              ...demoUser,
              email: demoUser.email.trim(),
              photoUrl: demoUser.photoUrl || cachedPhoto || '',
            };
            userMap.set(`email:${demoEmail}`, profile);
            userMap.set(`uid:${demoUid}`, profile);
          }
        }

        // 3. Extraemos la lista final deduplicada sin repetir ni por email ni por UID
        const seenEmails = new Set<string>();
        const seenUids = new Set<string>();
        const uniqueList: UserProfile[] = [];

        userMap.forEach((user) => {
          const emailNorm = (user.email || '').trim().toLowerCase();
          const uid = user.uid || '';
          if (emailNorm && seenEmails.has(emailNorm)) return;
          if (uid && seenUids.has(uid)) return;
          if (emailNorm) seenEmails.add(emailNorm);
          if (uid) seenUids.add(uid);
          uniqueList.push(user);
        });

        setUsers(uniqueList);
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updated =
            uniqueList.find((u) => u.uid === prev.uid) ||
            uniqueList.find((u) => u.email.toLowerCase() === prev.email.toLowerCase());
          if (!updated) return prev;
          return {
            ...updated,
            photoUrl: updated.photoUrl || prev.photoUrl || '',
          };
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'app_users')
    );

    const unsubProps = onSnapshot(
      collection(db, 'properties'),
      (snap) => {
        if (!mounted || snap.empty) return;
        const uniqueMap = new Map<string, PropertyItem>();
        snap.docs.forEach((d) => {
          const raw = d.data() as PropertyItem;
          const id = raw.id || d.id;
          const resolvedImages = resolvePropertyImages(raw.images, id);

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

          uniqueMap.set(id, {
            ...raw,
            id,
            images: resolvedImages,
          });
        });
        setProperties(Array.from(uniqueMap.values()));
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
        const favList = snap.docs.map(
          (d) => d.data() as { userId: string; propertyId: string }
        );
        setAllFavorites(favList);
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

  // Sync Firebase Auth without wiping out quick-access demo sessions
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!isDemoSessionRef.current) {
          setCurrentUser(null);
        }
        return;
      }
      isDemoSessionRef.current = false;
      const uid = sanitizeId(user.uid);
      const email = truncateText(user.email || 'usuario@clavehogar.com', SCHEMA_LIMITS.EMAIL_MAX);

      const currentList = usersRef.current;
      const existing =
        currentList.find((u) => u.uid === uid) ||
        currentList.find((u) => u.email.toLowerCase() === email.toLowerCase()) ||
        INITIAL_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());

      if (existing) {
        setCurrentUser(existing);
        return;
      }

      const isBootstrapAdmin = email.toLowerCase() === 'programacionkeichi@gmail.com';
      const defaultRole: UserRole = isBootstrapAdmin ? 'administrador' : 'cliente';
      const displayName = truncateText(
        user.displayName || email.split('@')[0] || 'Usuario ClaveHogar',
        SCHEMA_LIMITS.DISPLAY_NAME_MAX
      );

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
        bio: 'Cliente registrado en ClaveHogar.',
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
  }, []);

  // Keep selectedProperty in sync when properties update in Firestore
  useEffect(() => {
    if (!selectedProperty) return;
    const fresh = properties.find((p) => p.id === selectedProperty.id);
    if (fresh) setSelectedProperty(fresh);
  }, [properties, selectedProperty]);

  // Al navegar al Catálogo, nos aseguramos de que el input de búsqueda de texto esté limpio
  useEffect(() => {
    if (activeSection === 'catalogo') {
      setSearchQuery('');
    }
  }, [activeSection]);

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
          const qNorm = normalizeSearchText(searchQuery);
          const propNorm = normalizeSearchText(
            `${p.title} ${p.location} ${p.address} ${p.description} ${p.propertyType}`
          );
          const asksCabaSynonyms =
            qNorm.includes('ciudad de buenos aires') ||
            qNorm.includes('capital federal') ||
            qNorm === 'caba' ||
            qNorm === 'capital';
          const isPropCaba =
            propNorm.includes('caba') ||
            propNorm.includes('ciudad de buenos aires') ||
            propNorm.includes('capital federal') ||
            propNorm.includes('palermo') ||
            propNorm.includes('belgrano') ||
            propNorm.includes('recoleta') ||
            propNorm.includes('colegiales') ||
            propNorm.includes('puerto madero') ||
            propNorm.includes('nunez') ||
            propNorm.includes('caballito');

          const matchText =
            propNorm.includes(qNorm) || (asksCabaSynonyms && isPropCaba);
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
    return notifications.filter((n) => n.userId === currentUser.uid);
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
      isDemoSessionRef.current = false;
      await signInWithPopup(auth, googleProvider);
      notify('success', 'Sesión iniciada con Google', 'Bienvenido a ClaveHogar.');
    } catch {
      notify('error', 'No se pudo iniciar con Google', 'Podés ingresar con correo y contraseña o usar las cuentas demo.');
    }
  };

  const findOfficialDemoProfileByEmail = (emailLower: string): UserProfile | undefined => {
    const isOfficialDemo = Object.values(DEMO_ROLE_EMAILS).some(
      (demoMail) => demoMail.toLowerCase() === emailLower
    );
    if (!isOfficialDemo) return undefined;
    return (
      users.find((u) => u.email.toLowerCase() === emailLower) ||
      INITIAL_USERS.find((u) => u.email.toLowerCase() === emailLower)
    );
  };

  const handleLoginSubmit = async (email: string, password: string): Promise<boolean> => {
    const emailClean = email.trim().toLowerCase();
    const officialDemoProfile = findOfficialDemoProfileByEmail(emailClean);

    try {
      isDemoSessionRef.current = false;
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const profile =
        officialDemoProfile ||
        users.find((u) => u.uid === cred.user.uid) ||
        users.find((u) => u.email.toLowerCase() === emailClean);

      if (!profile) {
        notify('error', 'Perfil no encontrado', 'Tu cuenta existe pero falta el perfil en la base de datos.');
        return false;
      }
      if (!profile.active) {
        notify('error', 'Cuenta suspendida', 'Tu cuenta está desactivada por el administrador.');
        await signOut(auth);
        return false;
      }

      setCurrentUser(profile);
      setActiveSubView(getDefaultSubViewForRole(profile.role));
      notify('success', `¡Bienvenido/a, ${profile.displayName}!`, `Ingresaste con tu cuenta de ${profile.role}.`);
      return true;
    } catch (err: any) {
      // Si el usuario ingresó manualmente una de las 4 cuentas oficiales @clavehogar.com con su clave demo (123456)
      if (officialDemoProfile && password === '123456') {
        if (!officialDemoProfile.active) {
          notify('error', 'Cuenta suspendida', 'Esta cuenta está desactivada por el administrador.');
          return false;
        }
        isDemoSessionRef.current = true;
        setCurrentUser(officialDemoProfile);
        setActiveSubView(getDefaultSubViewForRole(officialDemoProfile.role));
        notify(
          'success',
          `¡Bienvenido/a, ${officialDemoProfile.displayName}!`,
          `Ingresaste con la cuenta oficial ${officialDemoProfile.email} (${officialDemoProfile.role}).`
        );
        return true;
      }

      const msg =
        err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential'
          ? 'Correo o contraseña incorrectos.'
          : err?.code === 'auth/user-not-found'
          ? 'No existe una cuenta con ese correo.'
          : err?.code === 'auth/too-many-requests'
          ? 'Demasiados intentos. Probá más tarde.'
          : 'No se pudo iniciar sesión.';
      notify('error', 'Error al iniciar sesión', msg);
      return false;
    }
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

    const emailLower = data.email.trim().toLowerCase();
    if (Object.values(DEMO_ROLE_EMAILS).some((m) => m.toLowerCase() === emailLower)) {
      notify(
        'error',
        'Correo reservado',
        'Las cuentas oficiales @clavehogar.com ya existen para demostración. Usá otro correo para registrarte.'
      );
      return false;
    }

    try {
      isDemoSessionRef.current = false;
      const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      await updateProfile(cred.user, { displayName: data.displayName });

      const newUser: UserProfile = {
        uid: cred.user.uid,
        displayName: data.displayName,
        email: data.email.trim(),
        phone: data.phone,
        address: data.address,
        dni: data.dni,
        role: 'cliente',
        isAlsoOwner: false,
        active: true,
        agencyName: '',
        bio: 'Cliente registrado en ClaveHogar.',
        photoUrl: '',
      };

      await setDoc(doc(db, 'app_users', cred.user.uid), newUser);
      setUsers((prev) => [newUser, ...prev.filter((u) => u.uid !== newUser.uid)]);
      setCurrentUser(newUser);
      setActiveSubView('cliente_favoritos');
      notify(
        'success',
        'Cuenta creada correctamente',
        'Te registraste como Cliente. Podés convertirte también en Propietario desde tu misma cuenta cuando quieras publicar un inmueble.'
      );
      return true;
    } catch (err: any) {
      const code = err?.code || 'desconocido';
      const humanMsg =
        code === 'auth/operation-not-allowed'
          ? 'El registro con email/contraseña no está habilitado en Firebase. Andá a Authentication → Sign-in method y activá Email/Password.'
          : code === 'auth/email-already-in-use'
          ? 'Ese correo ya está registrado. Probá iniciar sesión.'
          : code === 'auth/weak-password'
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : code === 'auth/invalid-email'
          ? 'El correo no tiene un formato válido.'
          : code === 'permission-denied' || code === 'firestore/permission-denied'
          ? 'Firestore rechazó guardar el perfil. Revisá las reglas de seguridad.'
          : `No se pudo crear la cuenta. (${code})`;

      notify('error', 'Error al registrarte', humanMsg);
      return false;
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      notify('info', 'Enlace enviado', `Revisá la casilla de ${email}.`);
    } catch {
      notify('error', 'No se pudo enviar el enlace', 'Verificá el correo ingresado.');
    }
  };

  /**
   * Acceso rápido: ESTRICTAMENTE las 4 cuentas oficiales con mail @clavehogar.com
   * (cliente@clavehogar.com, propietario@clavehogar.com, agente@clavehogar.com, admin@clavehogar.com)
   */
  const handleQuickRoleLogin = (role: UserRole) => {
    const officialEmail = DEMO_ROLE_EMAILS[role].toLowerCase();
    let cachedPhoto = '';
    try {
      const raw = localStorage.getItem('clavehogar_user_avatars');
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      cachedPhoto = map[officialEmail] || '';
    } catch {
      // ignore
    }

    const baseTarget =
      users.find((u) => u.email.toLowerCase() === officialEmail) ||
      INITIAL_USERS.find((u) => u.email.toLowerCase() === officialEmail) ||
      INITIAL_USERS[0];
    const target: UserProfile = {
      ...baseTarget,
      photoUrl: baseTarget.photoUrl || cachedPhoto || '',
    };

    isDemoSessionRef.current = true;
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
    setCurrentUser(target);
    setActiveSubView(getDefaultSubViewForRole(target.role));
    notify(
      'success',
      `Sesión iniciada: ${target.displayName}`,
      `Ingresaste con la cuenta oficial ${target.email} (${target.role}).`
    );
  };

  const handleLogout = async () => {
    isDemoSessionRef.current = false;
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setIsSideMenuOpen(false);
    setShowNotifDropdown(false);
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
        'Funciones de Propietario habilitadas',
        'Ahora conservás tus funciones de Cliente y podés publicar y administrar tus inmuebles desde "Mis propiedades".'
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
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === updated.uid || u.email.toLowerCase() === updated.email.toLowerCase()
          ? updated
          : u
      )
    );

    if (partial.photoUrl !== undefined) {
      try {
        const raw = localStorage.getItem('clavehogar_user_avatars');
        const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        map[updated.uid] = partial.photoUrl || '';
        map[updated.email.toLowerCase()] = partial.photoUrl || '';
        localStorage.setItem('clavehogar_user_avatars', JSON.stringify(map));
      } catch {
        // ignore storage quota errors
      }
    }

    try {
      await setDoc(doc(db, 'app_users', updated.uid), updated, { merge: true });
      notify(
        'success',
        'Perfil actualizado correctamente',
        'Tu foto y datos personales se guardaron y actualizaron en el icono de perfil y en Mi Espacio.'
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo actualizar tu perfil.');
      handleFirestoreError(err, OperationType.UPDATE, `app_users/${updated.uid}`);
    }
  };

  const handleDeleteOwnProfile = async () => {
    if (!currentUser) return;
    const isOfficialDemo = Object.values(DEMO_ROLE_EMAILS).some(
      (m) => m.toLowerCase() === currentUser.email.toLowerCase()
    );
    if (isOfficialDemo) {
      notify('error', 'Acción no permitida', 'Las cuentas oficiales @clavehogar.com no pueden eliminarse.');
      return;
    }
    const uidToDelete = currentUser.uid;
    try {
      await deleteDoc(doc(db, 'app_users', uidToDelete));
      setUsers((prev) => prev.filter((u) => u.uid !== uidToDelete));
      await handleLogout();
      notify('info', 'Perfil eliminado', 'Tus datos personales fueron eliminados correctamente.');
    } catch (err) {
      notify('error', 'Error al eliminar perfil', 'No se pudo eliminar tu cuenta.');
      handleFirestoreError(err, OperationType.DELETE, `app_users/${uidToDelete}`);
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
      setAllFavorites((prev) =>
        prev.filter((f) => !(f.userId === currentUser.uid && f.propertyId === propertyId))
      );
      try {
        await deleteDoc(doc(db, 'favorites', favDocId));
        notify('info', 'Eliminado de favoritos', 'La propiedad se quitó de tu lista de favoritos.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `favorites/${favDocId}`);
      }
    } else {
      setAllFavorites((prev) => [...prev, { userId: currentUser.uid, propertyId }]);
      try {
        await setDoc(doc(db, 'favorites', favDocId), {
          userId: currentUser.uid,
          propertyId,
          createdAtIso: new Date().toISOString(),
        });
        notify('success', 'Propiedad guardada en favoritos', 'Podés consultarla desde Mis Favoritos.');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `favorites/${favDocId}`);
      }
    }
  };

  const handleToggleCompare = (propertyId: string) => {
    setComparedByUser((prev) => {
      const currentList = prev[compareScopeKey] || [];
      if (currentList.includes(propertyId)) {
        notify('info', 'Quitada del comparador', 'Se retiró la propiedad de tu tabla comparativa.');
        return {
          ...prev,
          [compareScopeKey]: currentList.filter((id) => id !== propertyId),
        };
      }
      if (currentList.length >= 4) {
        notify('error', 'Límite de comparación alcanzado', 'Podés comparar hasta 4 propiedades en simultáneo.');
        return prev;
      }
      notify('success', 'Agregada al comparador', 'Abrí la sección Comparador para contrastar características.');
      return {
        ...prev,
        [compareScopeKey]: [...currentList, propertyId],
      };
    });
  };

  const handleSaveProperty = async (
    data: Omit<PropertyItem, 'id' | 'ownerId' | 'ownerName' | 'publicationStatus' | 'createdAtIso'>,
    existingId?: string
  ) => {
    if (!currentUser) return;
    const isEdit = Boolean(existingId);
    const propId = existingId ? sanitizeId(existingId) : sanitizeId(`prop_${Date.now()}`);
    const existingProp =
      properties.find((p) => p.id === propId || (existingId && p.id === existingId)) ||
      editingProperty;

    // Verificar permisos de edición: propietario dueño, agente confirmado a cargo, o administrador
    if (isEdit && existingProp) {
      const isAuthorized = canUserEditProperty(existingProp, currentUser, users);
      if (!isAuthorized) {
        notify(
          'error',
          'Sin permisos sobre esta publicación',
          'Solo el propietario titular o el agente confirmado a cargo pueden modificar este inmueble.'
        );
        return;
      }
    }

    // Las nuevas publicaciones de propietarios quedan pendientes de revisión del administrador.
    // Si es edición de una publicación ya aprobada, se mantiene aprobada para reflejar los cambios en el catálogo de inmediato.
    const publicationStatus: PublicationStatus = isEdit
      ? existingProp?.publicationStatus === 'rechazada' || existingProp?.publicationStatus === 'suspendida'
        ? 'pendiente'
        : existingProp?.publicationStatus || 'aprobada'
      : currentUser.role === 'administrador'
      ? 'aprobada'
      : 'pendiente';

    const newProp: PropertyItem = {
      ...data,
      id: propId,
      ownerId: existingProp?.ownerId || (editingProperty?.ownerId ?? currentUser.uid),
      ownerName: existingProp?.ownerName || (editingProperty?.ownerName ?? currentUser.displayName),
      agentId: data.agentId !== undefined ? data.agentId : (existingProp?.agentId || (editingProperty?.agentId ?? '')),
      agentName: data.agentName !== undefined ? data.agentName : (existingProp?.agentName || (editingProperty?.agentName ?? '')),
      managementMode: data.managementMode || existingProp?.managementMode || 'directa',
      agentRequestType: data.agentRequestType || existingProp?.agentRequestType || 'ninguna',
      agentAssignmentStatus:
        data.agentAssignmentStatus || existingProp?.agentAssignmentStatus || 'sin_agente',
      requestedAgentId: data.requestedAgentId !== undefined ? data.requestedAgentId : (existingProp?.requestedAgentId || ''),
      requestedAgentName: data.requestedAgentName !== undefined ? data.requestedAgentName : (existingProp?.requestedAgentName || ''),
      agentRejectionReason: data.agentRejectionReason !== undefined ? data.agentRejectionReason : (existingProp?.agentRejectionReason || ''),
      publicationStatus,
      rejectionReason: publicationStatus === 'pendiente' ? '' : existingProp?.rejectionReason || '',
      createdAtIso: existingProp?.createdAtIso || (editingProperty?.createdAtIso ?? new Date().toISOString()),
    };

    try {
      await setDoc(doc(db, 'properties', propId), newProp);
      // Actualizar estado deduplicando por id para que NUNCA aparezca duplicada y se actualice al instante en el catálogo y en Mi Espacio
      setProperties((prev) =>
        prev.some((p) => p.id === propId || (existingId && p.id === existingId))
          ? prev.map((p) => (p.id === propId || (existingId && p.id === existingId) ? newProp : p))
          : [newProp, ...prev]
      );
      if (selectedProperty && (selectedProperty.id === propId || selectedProperty.id === existingId)) {
        setSelectedProperty(newProp);
      }

      // Notificaciones según solicitud de agente y moderación
      const adminUser =
        users.find((u) => u.email.toLowerCase() === DEMO_ROLE_EMAILS.administrador) ||
        INITIAL_USERS.find((u) => u.role === 'administrador');

      if (!isEdit && publicationStatus === 'pendiente') {
        await pushUserNotification(
          newProp.ownerId,
          'Publicación enviada a revisión',
          `Tu propiedad "${newProp.title}" fue registrada en "Mis propiedades" y está pendiente de aprobación del administrador.`,
          'info'
        );
        if (adminUser) {
          await pushUserNotification(
            adminUser.uid,
            'Nueva propiedad pendiente de revisión',
            `${newProp.ownerName} publicó "${newProp.title}" y aguarda tu aprobación.`,
            'info'
          );
        }
      }

      if (
        isEdit &&
        existingProp &&
        publicationStatus === 'pendiente' &&
        existingProp.publicationStatus !== 'pendiente' &&
        adminUser
      ) {
        await pushUserNotification(
          adminUser.uid,
          'Publicación corregida para revisión',
          `${newProp.ownerName} actualizó "${newProp.title}" y la envió nuevamente a revisión.`,
          'info'
        );
      }

      if (
        newProp.agentAssignmentStatus === 'pendiente_agente' &&
        newProp.requestedAgentId &&
        (!existingProp || existingProp.requestedAgentId !== newProp.requestedAgentId)
      ) {
        await pushUserNotification(
          newProp.requestedAgentId,
          'Nueva solicitud de gestión de propiedad',
          `${newProp.ownerName} te eligió como agente para gestionar "${newProp.title}". Ingresá a tu panel para aceptar o rechazar la solicitud.`,
          'info'
        );
      } else if (
        newProp.agentAssignmentStatus === 'pendiente_admin' &&
        (!existingProp || existingProp.agentAssignmentStatus !== 'pendiente_admin') &&
        adminUser
      ) {
        await pushUserNotification(
          adminUser.uid,
          'Solicitud de asignación de agente',
          `${newProp.ownerName} solicitó que le asignes un agente inmobiliario para "${newProp.title}".`,
          'info'
        );
      }

      notify(
        'success',
        isEdit
          ? 'Propiedad actualizada correctamente'
          : publicationStatus === 'pendiente'
          ? 'Propiedad registrada (Pendiente de revisión)'
          : 'Propiedad publicada correctamente',
        isEdit
          ? `Los cambios en "${newProp.title}" se guardaron en Firestore.`
          : `El inmueble "${newProp.title}" se guardó en "Mis propiedades" y quedó pendiente de aprobación del administrador.`
      );
    } catch (err) {
      notify('error', 'Error al guardar los datos', 'No se pudo guardar la propiedad en Firestore.');
      handleFirestoreError(err, OperationType.WRITE, `properties/${propId}`);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    const target = properties.find((p) => p.id === propertyId);
    if (!currentUser || !target) return;
    const canDelete =
      currentUser.role === 'administrador' || isUserOwnerOfProperty(target, currentUser, users);
    if (!canDelete) {
      notify('error', 'Sin permisos', 'Solo el propietario titular o el administrador pueden eliminar esta publicación.');
      return;
    }
    if (!window.confirm(`¿Eliminar la publicación "${target.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

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
    const target = properties.find((p) => p.id === propertyId);
    if (!currentUser || !target) return;
    const canModify = canUserEditProperty(target, currentUser, users);
    if (!canModify) {
      notify('error', 'Sin permisos', 'No tenés permisos para modificar esta propiedad.');
      return;
    }

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

  /**
   * Flujo del Propietario para elegir modalidad de gestión o solicitar agente:
   * - 'directa': Propietario independiente (sin agente)
   * - 'elegir_agente': El propietario elige un agente disponible -> queda 'pendiente_agente' hasta que el agente acepte o el admin confirme
   * - 'asignacion_admin': El propietario pide "Que me asignen uno" -> queda 'pendiente_admin' hasta que el admin le asigne uno
   */
  const handleOwnerRequestAgent = async (
    propertyId: string,
    mode: 'directa' | 'elegir_agente' | 'asignacion_admin',
    chosenAgent?: UserProfile
  ) => {
    const target = properties.find((p) => p.id === propertyId);
    if (!currentUser || !target) return;
    const isOwner = isUserOwnerOfProperty(target, currentUser, users);
    if (currentUser.role !== 'administrador' && !isOwner) {
      notify('error', 'Sin permisos', 'Solo el propietario titular o el administrador pueden cambiar la modalidad de gestión.');
      return;
    }

    const adminUser =
      users.find((u) => u.email.toLowerCase() === DEMO_ROLE_EMAILS.administrador) ||
      INITIAL_USERS.find((u) => u.role === 'administrador');

    let patch: Partial<PropertyItem>;
    if (mode === 'directa') {
      patch = {
        managementMode: 'directa',
        agentRequestType: 'ninguna',
        agentAssignmentStatus: 'sin_agente',
        agentId: '',
        agentName: '',
        requestedAgentId: '',
        requestedAgentName: '',
        agentRejectionReason: '',
      };
    } else if (mode === 'elegir_agente' && chosenAgent) {
      patch = {
        managementMode: 'con_agente',
        agentRequestType: 'elegir_agente',
        agentAssignmentStatus: 'pendiente_agente',
        agentId: '',
        agentName: '',
        requestedAgentId: chosenAgent.uid,
        requestedAgentName: chosenAgent.displayName,
        agentRejectionReason: '',
      };
    } else {
      patch = {
        managementMode: 'con_agente',
        agentRequestType: 'asignacion_admin',
        agentAssignmentStatus: 'pendiente_admin',
        agentId: '',
        agentName: '',
        requestedAgentId: '',
        requestedAgentName: '',
        agentRejectionReason: '',
      };
    }

    try {
      await updateDoc(doc(db, 'properties', propertyId), patch);
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, ...patch } : p))
      );

      if (mode === 'directa') {
        notify(
          'info',
          'Modalidad: Propietario Independiente',
          'Ahora administrás esta propiedad y sus consultas directamente por tu cuenta.'
        );
      } else if (mode === 'elegir_agente' && chosenAgent) {
        await pushUserNotification(
          chosenAgent.uid,
          'Nueva solicitud de propietario',
          `${target.ownerName} te seleccionó para gestionar "${target.title}". Ingresá a tu cartera para aceptar o rechazar la solicitud.`,
          'info'
        );
        if (adminUser) {
          await pushUserNotification(
            adminUser.uid,
            'Solicitud de agente pendiente de confirmación',
            `${target.ownerName} solicitó al agente ${chosenAgent.displayName} para "${target.title}".`,
            'info'
          );
        }
        notify(
          'success',
          'Solicitud enviada al agente',
          `Elegiste a ${chosenAgent.displayName}. La solicitud queda pendiente hasta que el agente la acepte o el administrador confirme la asignación.`
        );
      } else if (mode === 'asignacion_admin') {
        if (adminUser) {
          await pushUserNotification(
            adminUser.uid,
            'Propietario solicita asignación de agente',
            `${target.ownerName} pidió que le asignes un agente inmobiliario para "${target.title}".`,
            'info'
          );
        }
        notify(
          'success',
          'Solicitud enviada al Administrador',
          'Tu solicitud quedó pendiente hasta que el administrador te asigne un agente inmobiliario.'
        );
      }
    } catch (err) {
      notify('error', 'Error al actualizar solicitud', 'No se pudo actualizar la solicitud de agente.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  /**
   * El agente elegido acepta o rechaza la solicitud del propietario
   */
  const handleAgentRespondAssignment = async (
    propertyId: string,
    accept: boolean,
    reason?: string
  ) => {
    const target = properties.find((p) => p.id === propertyId);
    if (!currentUser || !target) return;
    const isAssignedAgent =
      currentUser.role === 'agente' &&
      (target.requestedAgentId === currentUser.uid ||
        target.agentId === currentUser.uid ||
        isUserAssignedAgentOfProperty(target, currentUser, users));
    if (!isAssignedAgent && currentUser.role !== 'administrador') {
      notify('error', 'Sin permisos', 'Esta solicitud no corresponde a tu perfil de agente.');
      return;
    }

    const patch: Partial<PropertyItem> = accept
      ? {
          managementMode: 'con_agente',
          agentAssignmentStatus: 'asignado',
          agentId: currentUser.uid,
          agentName: currentUser.displayName,
          agentRejectionReason: '',
        }
      : {
          agentAssignmentStatus: 'rechazado',
          agentId: '',
          agentName: '',
          agentRejectionReason:
            reason || 'El agente seleccionado no cuenta con disponibilidad en este momento.',
        };

    try {
      await updateDoc(doc(db, 'properties', propertyId), patch);
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, ...patch } : p))
      );

      if (accept) {
        await pushUserNotification(
          target.ownerId,
          'Agente inmobiliario confirmado',
          `${currentUser.displayName} aceptó tu solicitud y ya está gestionando "${target.title}".`,
          'success'
        );
        notify(
          'success',
          'Asignación aceptada',
          `La propiedad "${target.title}" ya forma parte de las propiedades a tu cargo.`
        );
      } else {
        await pushUserNotification(
          target.ownerId,
          'Solicitud de agente rechazada / Sin disponibilidad',
          `${currentUser.displayName} no puede tomar la gestión de "${target.title}" (${patch.agentRejectionReason}). Podés elegir otro agente o pedir que el administrador te asigne uno.`,
          'warning'
        );
        notify(
          'info',
          'Solicitud rechazada',
          'Se notificó al propietario para que pueda elegir otro agente o pedir asignación al administrador.'
        );
      }
    } catch (err) {
      notify('error', 'Error al procesar solicitud', 'No se pudo responder la solicitud.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  /**
   * El Administrador confirma o asigna un agente inmobiliario a la propiedad
   */
  const handleAdminConfirmAgentAssignment = async (
    propertyId: string,
    agentId: string,
    agentName: string
  ) => {
    const target = properties.find((p) => p.id === propertyId);
    if (!currentUser || currentUser.role !== 'administrador' || !target) return;

    const patch: Partial<PropertyItem> = {
      managementMode: 'con_agente',
      agentAssignmentStatus: 'asignado',
      agentId,
      agentName,
      requestedAgentId: agentId,
      requestedAgentName: agentName,
      agentRejectionReason: '',
    };

    try {
      await updateDoc(doc(db, 'properties', propertyId), patch);
      setProperties((prev) =>
        prev.map((p) => (p.id === propertyId ? { ...p, ...patch } : p))
      );

      await pushUserNotification(
        target.ownerId,
        'Agente inmobiliario asignado',
        `El administrador confirmó a ${agentName} como agente a cargo de "${target.title}". Podés consultar sus datos en "Mis propiedades".`,
        'success'
      );
      await pushUserNotification(
        agentId,
        'Nueva propiedad asignada a tu cartera',
        `El administrador te asignó la gestión de "${target.title}" (Propietario: ${target.ownerName}).`,
        'info'
      );

      notify(
        'success',
        'Agente confirmado y asignado',
        `${agentName} ya tiene la propiedad en su panel y puede gestionarla.`
      );
    } catch (err) {
      notify('error', 'Error al asignar agente', 'No se pudo asignar el agente.');
      handleFirestoreError(err, OperationType.UPDATE, `properties/${propertyId}`);
    }
  };

  const handleModerateProperty = async (
    propertyId: string,
    publicationStatus: PublicationStatus,
    rejectionReason?: string
  ) => {
    if (currentUser?.role !== 'administrador') return;
    if (publicationStatus === 'rechazada' && !rejectionReason?.trim()) {
      notify('error', 'Falta el motivo', 'Escribí el motivo antes de rechazar la publicación.');
      return;
    }
    const target = properties.find((p) => p.id === propertyId);
    const reason = rejectionReason?.trim() || '';
    try {
      await updateDoc(doc(db, 'properties', propertyId), {
        publicationStatus,
        rejectionReason: reason,
      });
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, publicationStatus, rejectionReason: reason }
            : p
        )
      );
      if (target) {
        await pushUserNotification(
          target.ownerId,
          publicationStatus === 'aprobada'
            ? 'Publicación aprobada'
            : 'Publicación rechazada',
          publicationStatus === 'aprobada'
            ? `Tu propiedad "${target.title}" fue aprobada y está visible en el catálogo público.`
            : `Tu propiedad "${target.title}" fue rechazada. Motivo: ${reason}`,
          publicationStatus === 'aprobada' ? 'success' : 'warning'
        );
        if (target.agentId && target.agentId !== target.ownerId) {
          await pushUserNotification(
            target.agentId,
            publicationStatus === 'aprobada'
              ? 'Publicación aprobada'
              : 'Publicación rechazada',
            publicationStatus === 'aprobada'
              ? `La propiedad "${target.title}" fue aprobada.`
              : `La propiedad "${target.title}" fue rechazada. Motivo: ${reason}`,
            publicationStatus === 'aprobada' ? 'success' : 'warning'
          );
        }
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
    const minDate = getMinVisitDate();
    if (date < minDate) {
      notify(
        'error',
        'Fecha no permitida para visita',
        'Las visitas deben programarse con al menos 24 horas de anticipación (a partir de mañana).'
      );
      return;
    }
    const visitId = sanitizeId(`vis_${Date.now()}`);
    const confirmedAgentId = isAgentConfirmedOnProperty(property) ? property.agentId || '' : '';

    const newVisit: VisitItem = {
      id: visitId,
      propertyId: property.id,
      propertyTitle: property.title,
      clientId: currentUser.uid,
      clientName: currentUser.displayName,
      ownerId: property.ownerId,
      agentId: confirmedAgentId,
      date,
      timeSlot,
      status: 'pendiente',
      notes: notes || 'Solicitud de visita presencial.',
      createdAtIso: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'visits', visitId), newVisit);
      setVisits((prev) =>
        prev.some((v) => v.id === visitId) ? prev : [newVisit, ...prev]
      );
      await pushUserNotification(
        currentUser.uid,
        'Reserva de visita enviada',
        `Solicitaste visitar "${property.title}" el ${date} (${timeSlot}).`,
        'info'
      );
      await pushUserNotification(
        property.ownerId,
        'Nueva solicitud de visita',
        `${currentUser.displayName} solicitó visitar "${property.title}" el ${date} (${timeSlot}).`,
        'info'
      );
      if (confirmedAgentId) {
        await pushUserNotification(
          confirmedAgentId,
          'Nueva solicitud de visita a propiedad a tu cargo',
          `${currentUser.displayName} solicitó visitar "${property.title}" el ${date} (${timeSlot}).`,
          'info'
        );
      }
      notify(
        'success',
        'Reserva realizada correctamente',
        `Tu solicitud de visita para el ${date} (${timeSlot}) fue registrada.`
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
        `Se actualizaron los datos de la visita.`
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
      const isClientSender = currentUser.uid === targetInquiry.clientId;
      const updatedInquiry: InquiryItem = {
        ...targetInquiry,
        reply: !isClientSender ? newMsg.text : targetInquiry.reply,
        messages: updatedMessages,
        status: !isClientSender ? 'respondida' : 'pendiente',
        updatedAtIso: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'inquiries', targetInquiry.id), updatedInquiry);
        setInquiries((prev) =>
          prev.map((i) => (i.id === targetInquiry.id ? updatedInquiry : i))
        );

        if (!isClientSender) {
          await pushUserNotification(
            targetInquiry.clientId,
            `Nueva respuesta sobre ${property.title}`,
            `${currentUser.displayName} respondió en tu conversación: "${truncateText(newMsg.text, 80)}"`,
            'info'
          );
        } else {
          await pushUserNotification(
            targetInquiry.ownerId,
            `Nuevo mensaje de ${currentUser.displayName}`,
            `Consulta en "${property.title}": "${truncateText(newMsg.text, 80)}"`,
            'info'
          );
          if (targetInquiry.agentId && targetInquiry.agentId.trim()) {
            await pushUserNotification(
              targetInquiry.agentId,
              `Nuevo mensaje de ${currentUser.displayName}`,
              `Consulta en "${property.title}": "${truncateText(newMsg.text, 80)}"`,
              'info'
            );
          }
        }
        notify('success', 'Mensaje enviado correctamente', 'Tu mensaje se agregó a la conversación.');
      } catch (err) {
        notify('error', 'Error al guardar los datos', 'No se pudo enviar el mensaje.');
        handleFirestoreError(err, OperationType.UPDATE, `inquiries/${targetInquiry.id}`);
      }
    } else {
      const inqId = sanitizeId(`inq_${Date.now()}`);
      const hasConfirmedAgent = isAgentConfirmedOnProperty(property);
      const newInquiry: InquiryItem = {
        id: inqId,
        propertyId: property.id,
        propertyTitle: property.title,
        clientId: currentUser.uid,
        clientName: currentUser.displayName,
        ownerId: property.ownerId,
        ownerName: property.ownerName,
        agentId: hasConfirmedAgent ? property.agentId || '' : '',
        agentName: hasConfirmedAgent ? property.agentName || '' : '',
        question: newMsg.text,
        reply: '',
        messages: [newMsg],
        status: 'pendiente',
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'inquiries', inqId), newInquiry);
        setInquiries((prev) =>
          prev.some((i) => i.id === inqId) ? prev : [newInquiry, ...prev]
        );
        await pushUserNotification(
          property.ownerId,
          `Nueva consulta sobre ${property.title}`,
          `${currentUser.displayName}: "${truncateText(newMsg.text, 80)}"`,
          'info'
        );
        if (hasConfirmedAgent && property.agentId) {
          await pushUserNotification(
            property.agentId,
            `Nueva consulta sobre ${property.title}`,
            `${currentUser.displayName}: "${truncateText(newMsg.text, 80)}"`,
            'info'
          );
        }
        notify(
          'success',
          'Consulta enviada correctamente',
          hasConfirmedAgent
            ? `Se inició el chat con el agente asignado (${property.agentName}) y el propietario.`
            : `Se inició el chat directo con el propietario (${property.ownerName}).`
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
    const confirmedAgentId = isAgentConfirmedOnProperty(property) ? property.agentId || '' : '';

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
      agentId: confirmedAgentId,
      status: 'solicitada',
      message,
      createdAtIso: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'operations', opId), newOp);
      setOperations((prev) =>
        prev.some((o) => o.id === opId) ? prev : [newOp, ...prev]
      );
      await pushUserNotification(
        property.ownerId,
        `Nueva oferta de ${operationType} — ${property.title}`,
        `${currentUser.displayName} presentó una propuesta por ${property.currency} ${offeredAmount.toLocaleString()}.`,
        'info'
      );
      if (confirmedAgentId) {
        await pushUserNotification(
          confirmedAgentId,
          `Nueva oferta de ${operationType} — ${property.title}`,
          `${currentUser.displayName} presentó una propuesta por ${property.currency} ${offeredAmount.toLocaleString()}.`,
          'info'
        );
      }
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
      setClaims((prev) =>
        prev.some((c) => c.id === clmId) ? prev : [newClaim, ...prev]
      );
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
      await pushUserNotification(
        uid,
        'Actualización de rol / cuenta',
        `El administrador actualizó tu rol a ${role.toUpperCase()} (${active ? 'Activa' : 'Suspendida'}).`,
        'info'
      );
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
      setCategories((prev) =>
        prev.some((c) => c.id === catId) ? prev : [...prev, newCat]
      );
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
  // AI SMART SEARCH HANDLER (Server API + Flexible Engine for CABA/GBA & Price Ranges)
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
    // Mantenemos visible en el input lo que se buscó para que el usuario pueda ver su consulta y editarla
    setAiQuery(promptToRun);

    try {
      const flexibleLocalResult = buildFlexibleSmartSearch(
        promptToRun,
        approvedProperties
      ) as AISmartSearchResponse;

      // Respuesta instantánea (<1ms) para saludos, chistes, consultas fuera de tema o pedidos de aclaración
      if (flexibleLocalResult.isOffTopic || flexibleLocalResult.needsClarification) {
        setAiResult(flexibleLocalResult);
        setAiLoading(false);
        return;
      }

      let data: AISmartSearchResponse | null = null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const response = await fetch('/api/ai/smart-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: promptToRun,
            properties: approvedProperties,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const serverData = (await response.json()) as AISmartSearchResponse;
          if (serverData && serverData.interpretedPreferences && Array.isArray(serverData.recommendations)) {
            const isOffTopic = Boolean(serverData.isOffTopic || flexibleLocalResult.isOffTopic);
            const needsClarification = Boolean(
              serverData.needsClarification || flexibleLocalResult.needsClarification
            );

            if (isOffTopic || needsClarification) {
              data = {
                ...serverData,
                recommendations: [],
                isOffTopic,
                needsClarification,
                assistantMessage:
                  serverData.assistantMessage || flexibleLocalResult.assistantMessage,
              };
            } else {
              const mergedMap = new Map<string, AISmartSearchResponse['recommendations'][number]>();
              for (const r of serverData.recommendations) {
                if (r && r.propertyId && (r.matchScore || 0) >= 55) {
                  mergedMap.set(r.propertyId, r);
                }
              }
              for (const localRec of flexibleLocalResult.recommendations) {
                if (localRec && (localRec.matchScore || 0) >= 55) {
                  const existing = mergedMap.get(localRec.propertyId);
                  if (!existing || localRec.matchScore > existing.matchScore) {
                    mergedMap.set(localRec.propertyId, localRec);
                  }
                }
              }
              const mergedRecs = Array.from(mergedMap.values()).sort(
                (a, b) => b.matchScore - a.matchScore
              );

              const assistantMessage =
                serverData.assistantMessage ||
                flexibleLocalResult.assistantMessage ||
                (mergedRecs.length > 0
                  ? `Encontré ${mergedRecs.length} ${
                      mergedRecs.length === 1 ? 'inmueble disponible' : 'inmuebles disponibles'
                    } en el catálogo que coinciden con tu búsqueda.`
                  : 'No hay inmuebles que coincidan con esos criterios. Probá ampliar la zona o el rango de precio.');

              data = {
                assistantMessage,
                isOffTopic: false,
                needsClarification: false,
                interpretedPreferences: {
                  ...serverData.interpretedPreferences,
                  summary:
                    flexibleLocalResult.interpretedPreferences.maxPrice > 0
                      ? flexibleLocalResult.interpretedPreferences.summary
                      : serverData.interpretedPreferences.summary ||
                        flexibleLocalResult.interpretedPreferences.summary,
                  maxPrice:
                    flexibleLocalResult.interpretedPreferences.maxPrice > 0
                      ? flexibleLocalResult.interpretedPreferences.maxPrice
                      : serverData.interpretedPreferences.maxPrice || 0,
                  preferredLocations:
                    flexibleLocalResult.interpretedPreferences.preferredLocations.length > 0 &&
                    !flexibleLocalResult.interpretedPreferences.preferredLocations[0]
                      .toLowerCase()
                      .includes('todas las zonas')
                      ? flexibleLocalResult.interpretedPreferences.preferredLocations
                      : serverData.interpretedPreferences.preferredLocations,
                },
                recommendations: mergedRecs,
              };
            }
          }
        }
      } catch {
        // Si el endpoint tarda o está en hosting estático, usamos inmediatamente el motor flexible local
        clearTimeout(timeoutId);
      }

      if (!data) {
        data = flexibleLocalResult;
      }

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
          { id: 'propietario_inmuebles', label: 'Mis propiedades (Propietario)' },
          { id: 'propietario_visitas', label: 'Visitas a mis propiedades' },
          { id: 'propietario_operaciones', label: 'Ofertas Recibidas' },
          { id: 'propietario_consultas', label: 'Chat con Interesados' }
        );
      }
      items.push({ id: 'reclamos_usuario', label: 'Soporte y Reclamos' });
    } else if (currentUser.role === 'propietario') {
      items.push(
        { id: 'propietario_inmuebles', label: 'Mis propiedades' },
        { id: 'propietario_visitas', label: 'Visitas Recibidas' },
        { id: 'propietario_operaciones', label: 'Ofertas y Contratos' },
        { id: 'propietario_consultas', label: 'Chat con Interesados' },
        { id: 'cliente_favoritos', label: `Mis Favoritos (${favoriteIds.length})` },
        { id: 'cliente_visitas', label: 'Mis Visitas como Cliente' },
        { id: 'cliente_operaciones', label: 'Mis Solicitudes como Cliente' },
        { id: 'cliente_consultas', label: 'Mis Consultas como Cliente' },
        { id: 'reclamos_usuario', label: 'Soporte y Reclamos' }
      );
    } else if (currentUser.role === 'agente') {
      items.push(
        { id: 'agente_cartera', label: 'Propiedades Asignadas a Mi Cargo' },
        { id: 'agente_visitas', label: 'Agenda de Visitas' },
        { id: 'agente_operaciones', label: 'Operaciones y Contratos' },
        { id: 'agente_consultas', label: 'Atención de Consultas / Chat' },
        { id: 'reclamos_usuario', label: 'Soporte y Reclamos' }
      );
    } else if (currentUser.role === 'administrador') {
      items.push(
        { id: 'admin_dashboard', label: 'Panel de Control y Métricas' },
        { id: 'admin_publicaciones', label: 'Moderación y Asignación de Agentes' },
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
    setNotifications((prev) =>
      prev.map((n) => (n.userId === currentUser?.uid ? { ...n, read: true } : n))
    );
    for (const item of unread) {
      try {
        await updateDoc(doc(db, 'notifications', item.id), { read: true });
      } catch {
        // ignore
      }
    }
  };

  /**
   * Al apretar cualquier cartel de notificación, lleva directamente a la sección
   * correspondiente según el contenido de la notificación y el rol del usuario.
   */
  const handleNotificationClick = (n: NotificationItem) => {
    if (!currentUser) return;
    setShowNotifDropdown(false);
    setSelectedProperty(null);

    if (!n.read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
    }

    const text = `${n.title} ${n.message}`.toLowerCase();
    const isOwnerCapable =
      currentUser.role === 'propietario' ||
      (currentUser.role === 'cliente' && Boolean(currentUser.isAlsoOwner));

    let destinationSubView: WorkspaceSubView = getDefaultSubViewForRole(currentUser.role);

    if (n.targetSubView) {
      destinationSubView = n.targetSubView as WorkspaceSubView;
    } else if (text.includes('reclamo')) {
      destinationSubView =
        currentUser.role === 'administrador' ? 'admin_reclamos' : 'reclamos_usuario';
    } else if (text.includes('visita') || text.includes('agenda')) {
      if (currentUser.role === 'agente') {
        destinationSubView = 'agente_visitas';
      } else if (
        text.includes('nueva solicitud de visita') &&
        isOwnerCapable
      ) {
        destinationSubView = 'propietario_visitas';
      } else if (currentUser.role === 'propietario' && !text.includes('tu reserva')) {
        destinationSubView = 'propietario_visitas';
      } else {
        destinationSubView = 'cliente_visitas';
      }
    } else if (
      text.includes('consulta') ||
      text.includes('mensaje') ||
      text.includes('respuesta') ||
      text.includes('conversación') ||
      text.includes('chat')
    ) {
      if (currentUser.role === 'agente') {
        destinationSubView = 'agente_consultas';
      } else if (
        (text.includes('nueva consulta') || text.includes('nuevo mensaje de')) &&
        isOwnerCapable
      ) {
        destinationSubView = 'propietario_consultas';
      } else if (currentUser.role === 'propietario' && !text.includes('tu conversación')) {
        destinationSubView = 'propietario_consultas';
      } else {
        destinationSubView = 'cliente_consultas';
      }
    } else if (
      text.includes('oferta') ||
      text.includes('operación') ||
      text.includes('contrato') ||
      text.includes('propuesta') ||
      text.includes('solicitud aprobada') ||
      text.includes('solicitud rechazada') ||
      text.includes('solicitud en_revision')
    ) {
      if (currentUser.role === 'agente') {
        destinationSubView = 'agente_operaciones';
      } else if (text.includes('nueva oferta') && isOwnerCapable) {
        destinationSubView = 'propietario_operaciones';
      } else if (currentUser.role === 'propietario' && text.includes('oferta')) {
        destinationSubView = 'propietario_operaciones';
      } else {
        destinationSubView = 'cliente_operaciones';
      }
    } else if (
      text.includes('publicación') ||
      text.includes('propiedad') ||
      text.includes('agente') ||
      text.includes('asignación') ||
      text.includes('revisión') ||
      text.includes('moderación') ||
      text.includes('cartera')
    ) {
      if (currentUser.role === 'administrador') {
        destinationSubView = 'admin_publicaciones';
      } else if (currentUser.role === 'agente') {
        destinationSubView = 'agente_cartera';
      } else if (isOwnerCapable) {
        destinationSubView = 'propietario_inmuebles';
      } else {
        destinationSubView = 'cliente_favoritos';
      }
    } else if (text.includes('rol') || text.includes('usuario')) {
      destinationSubView =
        currentUser.role === 'administrador'
          ? 'admin_usuarios'
          : getDefaultSubViewForRole(currentUser.role);
    }

    setActiveSection('panel_rol');
    setActiveSubView(destinationSubView);
  };

  // Reclamos según rol
  const scopedClaims = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'administrador') return claims;
    return claims.filter((c) => c.reporterId === currentUser.uid);
  }, [claims, currentUser]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFBF7] text-[#1F241F]">
      {/* =====================================================================
          TOAST NOTIFICATIONS (Capa principal superior sobre cualquier modal)
         ===================================================================== */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-[99999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-2 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-sm border-2 shadow-2xl backdrop-blur-md animate-fade-slide ${
              t.type === 'success'
                ? 'bg-[#EBF9ED] text-[#0F4A1E] border-emerald-500 shadow-emerald-950/15 ring-2 ring-emerald-500/20'
                : t.type === 'error'
                ? 'bg-[#FDF2F2] text-[#691C1C] border-red-500 shadow-red-950/15 ring-2 ring-red-500/20'
                : 'bg-[#FEF9EE] text-[#5C3B00] border-amber-500 shadow-amber-950/15 ring-2 ring-amber-500/20'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && (
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
              {t.type === 'error' && (
                <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <XCircle className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
              {t.type === 'info' && (
                <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Info className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
            </div>

            <div className="flex-1 text-xs">
              <div className="font-bold text-sm leading-snug">{t.title}</div>
              {t.description && (
                <p className="opacity-90 mt-1 leading-relaxed text-[12px]">{t.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              title="Cerrar aviso"
              className="p-1 rounded-sm text-current/60 hover:text-current hover:bg-black/5 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        ))}
      </div>

      {/* =====================================================================
          MINIMALIST ARCHITECTURAL HEADER WITH INTEGRATED HAMBURGER MENU
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
                Alquileres &amp; Ventas
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
              Buscador
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

          {/* Right: Auth & User Actions */}
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
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold flex items-center justify-center text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-[#FCFBF7] text-[#1F241F] border border-[#D8C7AA] rounded-sm shadow-xl p-4 z-50 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#D8C7AA] pb-2.5">
                        <div>
                          <span className="text-xs uppercase tracking-wider font-bold text-[#39483A] block">
                            Mis Notificaciones ({myNotifications.length})
                          </span>
                          <span className="text-[10px] text-[#39483A]/70">
                            Tocá cualquier cartel para ir directamente a esa sección
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNotifDropdown(false)}
                          aria-label="Cerrar notificaciones"
                          title="Cerrar notificaciones"
                          className="p-1.5 rounded-sm bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-300 transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                      {myNotifications.length === 0 ? (
                        <p className="text-xs text-[#39483A]/70 py-4 text-center">
                          No tenés notificaciones recientes.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {myNotifications.slice(0, 12).map((n) => {
                            const lowerTitle = n.title.toLowerCase();
                            const isRejectedOrError =
                              n.type === 'warning' ||
                              lowerTitle.includes('rechaza') ||
                              lowerTitle.includes('cancel');
                            const isPendingOrReview =
                              lowerTitle.includes('pendiente') ||
                              lowerTitle.includes('revisión') ||
                              lowerTitle.includes('solicitud');
                            const isSuccess =
                              n.type === 'success' ||
                              lowerTitle.includes('aprobada') ||
                              lowerTitle.includes('confirmada') ||
                              lowerTitle.includes('asignado');

                            const cardColorClass = isRejectedOrError
                              ? 'bg-red-50 border-red-300 hover:border-red-500'
                              : isSuccess
                              ? 'bg-emerald-50/80 border-emerald-300 hover:border-emerald-600'
                              : isPendingOrReview
                              ? 'bg-amber-50 border-amber-300 hover:border-amber-500'
                              : 'bg-[#F5F1E8] border-[#D8C7AA] hover:border-[#39483A]';

                            const titleColorClass = isRejectedOrError
                              ? 'text-red-800'
                              : isSuccess
                              ? 'text-emerald-900'
                              : isPendingOrReview
                              ? 'text-amber-900'
                              : 'text-[#39483A]';

                            return (
                              <button
                                key={n.id}
                                type="button"
                                onClick={() => handleNotificationClick(n)}
                                className={`w-full text-left p-3 rounded-sm border text-xs space-y-1.5 transition-all cursor-pointer group ${cardColorClass}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className={`font-bold leading-snug ${titleColorClass}`}>
                                    {n.title}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[#39483A]/60 group-hover:text-[#1F241F] group-hover:translate-x-0.5 transition-all mt-0.5" />
                                </div>
                                <p className="text-[#1F241F]/85 leading-snug">{n.message}</p>
                                <div className="flex items-center justify-between pt-0.5 text-[10px]">
                                  <span className="text-[#39483A]/65 font-tabular">
                                    {n.createdAtIso.slice(0, 16).replace('T', ' ')}
                                  </span>
                                  <span className="font-semibold text-[#39483A] group-hover:underline">
                                    Ir a la sección →
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Profile Button */}
                <button
                  type="button"
                  onClick={() => openAuthModal('profile')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F1E8] hover:bg-[#D8C7AA]/40 border border-[#D8C7AA] rounded-sm text-left transition-colors"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0">
                    {currentUser.photoUrl ? (
                      <img
                        src={currentUser.photoUrl}
                        alt={currentUser.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#FCFBF7]" />
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-[#1F241F] leading-none">
                      {currentUser.displayName.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[#B86F52] uppercase tracking-wider leading-none mt-0.5">
                      {currentUser.role === 'cliente' && currentUser.isAlsoOwner
                        ? 'cliente / prop.'
                        : currentUser.role}
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
          SLIDE-OVER HAMBURGER LATERAL MENU PANEL
         ===================================================================== */}
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            onClick={() => setIsSideMenuOpen(false)}
            className="fixed inset-0 bg-[#1F241F]/50 transition-opacity"
            aria-hidden="true"
          />

          <aside className="relative z-10 w-80 max-w-[85vw] bg-[#FCFBF7] border-r border-[#D8C7AA] h-full flex flex-col justify-between overflow-y-auto p-6">
            <div className="space-y-8">
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

              {currentUser ? (
                <div className="space-y-2 pt-2 border-t border-[#D8C7AA]">
                  <div className="px-2 py-1 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0">
                      {currentUser.photoUrl ? (
                        <img
                          src={currentUser.photoUrl}
                          alt={currentUser.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-[#FCFBF7]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[#B86F52] font-semibold block">
                        {currentUser.role === 'cliente' && currentUser.isAlsoOwner
                          ? 'Cliente y Propietario'
                          : `Opciones de ${currentUser.role}`}
                      </span>
                      <span className="text-sm font-serif-display font-semibold text-[#39483A] truncate block">
                        {currentUser.displayName}
                      </span>
                    </div>
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
                        + Convertirme en Propietario (Vender / Alquilar mi propiedad)
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
                  Mi Perfil Personal y Foto
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
            <section className="bg-[#F5F1E8] border-b border-[#D8C7AA] py-12 lg:py-20">
              <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
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
                      <div className="sm:text-right shrink-0 flex flex-col items-start sm:items-end gap-1">
                        <span className="text-xl font-semibold font-tabular text-[#39483A] block">
                          {heroFeaturedProperty.currency} {heroFeaturedProperty.price.toLocaleString()}
                        </span>
                        <span className="text-xs text-[#39483A]/75 font-tabular">
                          {heroFeaturedProperty.bedrooms} dorm. · {heroFeaturedProperty.surface} m²
                        </span>
                        {canUserEditProperty(heroFeaturedProperty, currentUser, users) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProperty(heroFeaturedProperty);
                              setIsPropertyFormOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-[#B86F52] text-[#FCFBF7] rounded-sm hover:bg-[#a35e42] transition-colors mt-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            Editar ficha
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

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
                  {currentUser && currentUser.role === 'cliente' && !currentUser.isAlsoOwner && (
                    <button
                      type="button"
                      onClick={handleEnableOwnerRole}
                      className="px-4 py-2.5 text-xs uppercase tracking-wider font-semibold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors"
                    >
                      Quiero publicar mi propiedad
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

                          <div className="p-6 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="uppercase tracking-wider text-[#B86F52] font-semibold truncate">
                                {prop.location}
                              </span>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border ${
                                  prop.availability === 'disponible'
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                                    : prop.availability === 'reservada'
                                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                                    : 'bg-red-100 text-red-800 border-red-400'
                                }`}
                              >
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

                          {canUserEditProperty(prop, currentUser, users) ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedProperty(prop)}
                                className="flex-1 py-2 px-3 text-xs uppercase tracking-wider font-semibold text-[#39483A] bg-[#F5F1E8] hover:bg-[#39483A] hover:text-[#FCFBF7] border border-[#D8C7AA] rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Ver
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProperty(prop);
                                  setIsPropertyFormOpen(true);
                                }}
                                className="flex-1 py-2 px-3 text-xs uppercase tracking-wider font-bold text-[#FCFBF7] bg-[#B86F52] hover:bg-[#a35e42] rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                title="Editar ficha de esta propiedad"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Editar ficha
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedProperty(prop)}
                              className="w-full py-2.5 px-4 text-xs uppercase tracking-widest font-semibold text-[#39483A] bg-[#F5F1E8] hover:bg-[#39483A] hover:text-[#FCFBF7] border border-[#D8C7AA] rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                              Ver Propiedad
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                  Buscador de Propiedades 
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
                {/* Cuadro de Respuesta del Asistente Virtual ClaveHogar */}
                {aiResult.assistantMessage && (
                  <div
                    className={`rounded-sm p-6 border-2 flex items-start gap-4 transition-all ${
                      aiResult.isOffTopic
                        ? 'bg-amber-50/90 border-amber-400'
                        : aiResult.needsClarification
                        ? 'bg-blue-50/90 border-blue-400'
                        : 'bg-[#F5F1E8] border-[#39483A]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#39483A] text-[#FCFBF7] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-5 h-5 text-[#D8C7AA]" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-[#39483A]">
                          Asistente Virtual de Búsqueda Inmobiliaria
                        </span>
                        {aiResult.isOffTopic && (
                          <span className="text-[10px] uppercase font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-sm border border-amber-400">
                            Consulta fuera del catálogo
                          </span>
                        )}
                        {aiResult.needsClarification && (
                          <span className="text-[10px] uppercase font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded-sm border border-blue-400">
                            Aclaración requerida
                          </span>
                        )}
                      </div>
                      <p className="text-base text-[#1F241F] font-medium leading-relaxed">
                        {aiResult.assistantMessage}
                      </p>
                    </div>
                  </div>
                )}

                {!aiResult.isOffTopic && !aiResult.needsClarification && (
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
                )}

                {aiResult.recommendations.length === 0 && !aiResult.isOffTopic && !aiResult.needsClarification ? (
                  <div className="bg-[#F5F1E8] border border-[#D8C7AA] rounded-sm p-10 text-center space-y-3">
                    <h3 className="text-2xl font-serif-display font-semibold text-[#39483A]">
                      No encontramos propiedades que coincidan con todos esos requisitos
                    </h3>
                    <p className="text-sm text-[#39483A]/80 max-w-lg mx-auto">
                      Ninguna de las propiedades activas en Firestore cumple simultáneamente con la zona, presupuesto o comodidades solicitadas. Probá ampliando el rango de búsqueda o ajustando los filtros.
                    </p>
                  </div>
                ) : null}

                {aiResult.recommendations.length > 0 && (
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
            VIEW 3: COMPARADOR DE PROPIEDADES (PROPIO DE CADA USUARIO)
           =================================================================== */}
        {activeSection === 'comparador' && (
          <ComparatorView
            comparedProperties={comparedProperties}
            allFeatures={activeFeatures}
            onRemoveFromCompare={handleToggleCompare}
            onClearCompare={() =>
              setComparedByUser((prev) => ({ ...prev, [compareScopeKey]: [] }))
            }
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
            allProperties={properties}
            favoriteIds={favoriteIds}
            allVisits={visits}
            allInquiries={inquiries}
            allOperations={operations}
            claims={scopedClaims}
            categories={categories}
            onEnableOwnerRole={handleEnableOwnerRole}
            onOpenProfileModal={() => openAuthModal('profile')}
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
            onOwnerRequestAgent={handleOwnerRequestAgent}
            onAgentRespondAssignment={handleAgentRespondAssignment}
            onAdminConfirmAgentAssignment={handleAdminConfirmAgentAssignment}
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
          users={users}
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
          onOpenEditProperty={(prop) => {
            setSelectedProperty(null);
            setEditingProperty(prop);
            setIsPropertyFormOpen(true);
          }}
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
        currentUser={currentUser}
        availableAgents={availableAgents}
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
        onDeleteOwnProfile={handleDeleteOwnProfile}
        onEnableOwnerRole={handleEnableOwnerRole}
        onQuickRoleLogin={handleQuickRoleLogin}
      />
    </div>
  );
}
