import { PropertyItem, UserProfile } from '../types';

/**
 * Verifica si un agente está confirmado o solicitado en una propiedad.
 */
export function isAgentConfirmedOnProperty(
  prop: PropertyItem,
  agentUid?: string
): boolean {
  const agentId = (prop.agentId || '').trim();
  const reqAgentId = (prop.requestedAgentId || '').trim();
  const hasAgent = Boolean(agentId || reqAgentId);
  if (!hasAgent) return false;

  if (agentUid) {
    const cleanUid = agentUid.trim();
    return agentId === cleanUid || reqAgentId === cleanUid;
  }
  return true;
}

/**
 * Retorna la fecha mínima para solicitar visitas (al menos 24 horas de anticipación).
 * No permite fechas pasadas ni la fecha de hoy (mínimo mañana).
 * Formato string YYYY-MM-DD para atributos 'min' en inputs de tipo date.
 */
export function getMinVisitDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Determina si el usuario actual es el propietario titular del inmueble.
 * Contempla coincidencias por UID, cuenta demo oficial de propietario,
 * coincidencia por email o coincidencia de nombre.
 */
export function isUserOwnerOfProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;

  const userUid = (user.uid || '').trim();
  const propOwnerId = (prop.ownerId || '').trim();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userName = (user.displayName || '').trim().toLowerCase();
  const propOwnerName = (prop.ownerName || '').trim().toLowerCase();
  const isOwnerRole = user.role === 'propietario' || Boolean(user.isAlsoOwner);

  // 2. Coincidencia directa por UID
  if (userUid && propOwnerId && userUid === propOwnerId) {
    return true;
  }

  // 3. Coincidencia por cuenta oficial demo de propietario (propietario@clavehogar.com)
  if (
    userEmail === 'propietario@clavehogar.com' &&
    (propOwnerId === 'kKqp7VS3xhPYfy6RvCh0SWJIqi12' ||
      propOwnerName.includes('santamarina') ||
      propOwnerName.includes('alejandro') ||
      !propOwnerId)
  ) {
    return true;
  }

  // 4. Si la propiedad pertenece a la cuenta demo de Alejandro Santamarina ('kKqp7VS3xhPYfy6RvCh0SWJIqi12')
  // y el usuario actual está operando en rol de propietario (p. ej. explorando o probando en modo propietario)
  if (
    isOwnerRole &&
    (propOwnerId === 'kKqp7VS3xhPYfy6RvCh0SWJIqi12' ||
      propOwnerName.includes('santamarina') ||
      propOwnerName.includes('alejandro'))
  ) {
    return true;
  }

  // 5. Coincidencia por correo electrónico buscando en la lista de usuarios de Firestore
  if (userEmail && allUsers && allUsers.length > 0) {
    const ownerUser = allUsers.find((u) => (u.uid || '').trim() === propOwnerId);
    if (ownerUser && (ownerUser.email || '').trim().toLowerCase() === userEmail) {
      return true;
    }
  }

  // 6. Coincidencia por nombre completo del titular
  if (
    isOwnerRole &&
    propOwnerName &&
    userName &&
    (propOwnerName === userName ||
      userName.includes(propOwnerName) ||
      propOwnerName.includes(userName))
  ) {
    return true;
  }

  // 7. Si el usuario tiene rol de propietario y la propiedad no tiene ownerId asignado
  if (isOwnerRole && !propOwnerId) {
    return true;
  }

  return false;
}

/**
 * Determina si el usuario actual es el agente asignado a la propiedad.
 * Las solicitudes pendientes no habilitan la edición.
 */
export function isUserAssignedAgentOfProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  if (user.role !== 'agente') return false;

  const userUid = (user.uid || '').trim();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userName = (user.displayName || '').trim().toLowerCase();
  const propAgentName = (prop.agentName || '').trim().toLowerCase();
  const propAgentId = (prop.agentId || '').trim();

  // Solo el agente confirmado en agentId puede editar la publicación.
  if (userUid && propAgentId === userUid) {
    return true;
  }

  // La cuenta demo se vincula únicamente con su UID asignado.
  if (
    userEmail === 'agente@clavehogar.com' &&
    propAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2'
  ) {
    return true;
  }

  // Coincidencia por correo en la lista de usuarios.
  if (userEmail && allUsers && allUsers.length > 0) {
    const assignedAgentUser = allUsers.find(
      (u) => propAgentId && u.uid === propAgentId
    );
    if (
      assignedAgentUser &&
      (assignedAgentUser.email || '').trim().toLowerCase() === userEmail
    ) {
      return true;
    }
  }

  // Compatibilidad con asignaciones antiguas sin UID, por nombre completo exacto.
  if (
    !propAgentId &&
    prop.agentAssignmentStatus === 'asignado' &&
    userName &&
    propAgentName &&
    propAgentName === userName
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un usuario tiene permisos para editar la propiedad:
 * - Propietario titular
 * - Agente confirmado a cargo
 */
export function canUserEditProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return false;
  if (isUserOwnerOfProperty(prop, user, allUsers)) return true;
  if (isUserAssignedAgentOfProperty(prop, user, allUsers)) return true;
  return false;
}
