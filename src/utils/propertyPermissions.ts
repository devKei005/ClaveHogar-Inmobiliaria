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

/** Determina si el usuario actual es el propietario titular por UID exacto. */
export function isUserOwnerOfProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  return Boolean(user.uid?.trim() && prop.ownerId?.trim() && user.uid.trim() === prop.ownerId.trim());
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
