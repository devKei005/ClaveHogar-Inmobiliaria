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

  // 1. Administrador siempre tiene autorización completa
  if (user.role === 'administrador') return true;

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
 * Determina si el usuario actual es el agente a cargo de la propiedad.
 * Contempla agente asignado confirmado, solicitud pendiente de agente, cuenta demo de Valentina Alvear,
 * y coincidencia por UID, email o nombre.
 */
export function isUserAssignedAgentOfProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return true;
  if (user.role !== 'agente') return false;

  const userUid = (user.uid || '').trim();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userName = (user.displayName || '').trim().toLowerCase();
  const propAgentName = (prop.agentName || '').trim().toLowerCase();
  const propReqAgentName = (prop.requestedAgentName || '').trim().toLowerCase();
  const propAgentId = (prop.agentId || '').trim();
  const propReqAgentId = (prop.requestedAgentId || '').trim();

  // 1. Verificación por UID directo del agente (tanto en agentId como en requestedAgentId)
  if (userUid && (propAgentId === userUid || propReqAgentId === userUid)) {
    return true;
  }

  // 2. Verificación si el usuario es la cuenta oficial de agente Valentina Alvear
  if (
    userEmail === 'agente@clavehogar.com' &&
    (propAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' ||
      propReqAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' ||
      propAgentName.includes('alvear') ||
      propReqAgentName.includes('alvear') ||
      propAgentName.includes('valentina') ||
      propReqAgentName.includes('valentina') ||
      prop.managementMode === 'con_agente')
  ) {
    return true;
  }

  // 3. Si la propiedad tiene asignada a Valentina Alvear ('SysykUHU5FVubQzrSHOBi3JnhQs2')
  // y el usuario actual tiene rol de agente (p. ej. en sesión demo o agente activo probando la cartera)
  if (
    user.role === 'agente' &&
    (propAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' ||
      propReqAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' ||
      propAgentName.includes('alvear') ||
      propReqAgentName.includes('alvear'))
  ) {
    return true;
  }

  // 4. Coincidencia por correo en la lista de usuarios
  if (userEmail && allUsers && allUsers.length > 0) {
    const assignedAgentUser = allUsers.find(
      (u) =>
        (propAgentId && u.uid === propAgentId) ||
        (propReqAgentId && u.uid === propReqAgentId)
    );
    if (
      assignedAgentUser &&
      (assignedAgentUser.email || '').trim().toLowerCase() === userEmail
    ) {
      return true;
    }
  }

  // 5. Coincidencia por nombre del agente
  if (
    userName &&
    ((propAgentName && (propAgentName === userName || propAgentName.includes(userName) || userName.includes(propAgentName))) ||
      (propReqAgentName && (propReqAgentName === userName || propReqAgentName.includes(userName) || userName.includes(propReqAgentName))))
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un usuario tiene permisos para editar la propiedad:
 * - Administrador
 * - Propietario titular
 * - Agente asignado o solicitado a cargo
 */
export function canUserEditProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return true;
  if (isUserOwnerOfProperty(prop, user, allUsers)) return true;
  if (isUserAssignedAgentOfProperty(prop, user, allUsers)) return true;
  return false;
}
