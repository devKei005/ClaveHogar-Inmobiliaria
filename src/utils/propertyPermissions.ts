import { PropertyItem, UserProfile, OperationItem } from '../types';

/**
 * Normaliza el estado de una operación para saber si está concretada.
 */
export function isDealConcretada(status?: string): boolean {
  const s = (status || '').toString().toLowerCase().trim().replace(/[\s-]+/g, '_');
  return ['concretada', 'cerrada', 'finalizada', 'completada'].includes(s);
}

/**
 * Verifica si una propiedad ya está concretada (alquilada o vendida),
 * ya sea por su disponibilidad o por contar con una operación concretada.
 */
export function isPropertyConcretada(
  prop?: PropertyItem | null,
  allOperations?: OperationItem[]
): boolean {
  if (!prop) return false;
  if (prop.availability === 'vendida' || prop.availability === 'alquilada') {
    return true;
  }
  if (allOperations && allOperations.length > 0) {
    return allOperations.some(
      (op) => op.propertyId === prop.id && isDealConcretada(op.status)
    );
  }
  return false;
}

/**
 * Verifica si una propiedad es una VENTA y ya está CONCRETADA (vendida).
 */
export function isPropertySoldConcretada(
  prop?: PropertyItem | null,
  allOperations?: OperationItem[]
): boolean {
  if (!prop) return false;
  if (prop.operationType === 'venta' && prop.availability === 'vendida') {
    return true;
  }
  if (allOperations && allOperations.length > 0) {
    return allOperations.some(
      (op) =>
        op.propertyId === prop.id &&
        op.operationType === 'venta' &&
        isDealConcretada(op.status)
    );
  }
  return false;
}

/**
 * Determina si el propietario o agente pueden administrar/hacer CRUD sobre la publicación.
 * Regla: Cuando la propiedad ya está concretada (en operaciones de alquiler o venta),
 * el propietario y el agente a cargo no pueden modificar el estado ni editar los datos.
 */
export function canUserManageProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allOperations?: OperationItem[],
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;
  // Si la propiedad está concretada (alquiler o venta), el propietario y el agente NO pueden administrar ni hacer CRUD
  if (isPropertyConcretada(prop, allOperations)) {
    return false;
  }
  return canUserEditProperty(prop, user, allUsers, allOperations);
}

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
 * Compara por UID, coincidencia con cuenta oficial demo, email del usuario o nombre del titular.
 */
export function isUserOwnerOfProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[]
): boolean {
  if (!user) return false;

  const userUid = (user.uid || '').trim();
  const propOwnerId = (prop.ownerId || '').trim();

  // 1. Coincidencia directa por UID
  if (userUid && propOwnerId && userUid === propOwnerId) {
    return true;
  }

  // 2. Coincidencia para la cuenta oficial demo de propietario
  const userEmail = (user.email || '').trim().toLowerCase();
  if (
    userEmail === 'propietario@clavehogar.com' &&
    (propOwnerId === 'kKqp7VS3xhPYfy6RvCh0SWJIqi12' || (prop.ownerName && prop.ownerName.toLowerCase().includes('santamarina')))
  ) {
    return true;
  }

  // 3. Coincidencia por correo en la lista de usuarios
  if (userEmail && allUsers && allUsers.length > 0) {
    const ownerUser = allUsers.find((u) => propOwnerId && u.uid === propOwnerId);
    if (ownerUser && (ownerUser.email || '').trim().toLowerCase() === userEmail) {
      return true;
    }
  }

  // 4. Coincidencia por nombre completo del titular
  const userName = (user.displayName || '').trim().toLowerCase();
  const propOwnerName = (prop.ownerName || '').trim().toLowerCase();
  if (userName && propOwnerName && userName === propOwnerName) {
    return true;
  }

  return false;
}

/**
 * Determina si el usuario actual es el agente asignado a la propiedad.
 * Valida por rol de agente, UID, correo de agente o nombre de agente confirmado.
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

  // 1. Coincidencia directa por UID del agente
  if (userUid && propAgentId && propAgentId === userUid) {
    return true;
  }

  // 2. Demo oficial agente
  if (
    userEmail === 'agente@clavehogar.com' &&
    (propAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' || propAgentName.includes('alvear'))
  ) {
    return true;
  }

  // 3. Coincidencia por correo en la lista de usuarios
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

  // 4. Coincidencia por nombre de agente asignado
  if (
    userName &&
    propAgentName &&
    (propAgentName === userName || propAgentName.includes(userName) || userName.includes(propAgentName))
  ) {
    return true;
  }

  return false;
}

/**
 * Determina si un usuario tiene permisos para editar la propiedad:
 * - Propietario titular del inmueble
 * - Agente inmobiliario confirmado a cargo
 * Si la propiedad ya está concretada (alquiler o venta), ni el propietario ni el agente pueden editarla.
 * Nota: El administrador modera, aprueba, rechaza o suspende publicaciones, pero no edita directamente los datos del inmueble.
 */
export function canUserEditProperty(
  prop: PropertyItem,
  user: UserProfile | null,
  allUsers?: UserProfile[],
  allOperations?: OperationItem[]
): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return false;
  // Cuando la propiedad está concretada (alquiler o venta), el propietario y el agente a cargo no pueden editar los datos de la propiedad
  if (isPropertyConcretada(prop, allOperations)) return false;
  if (isUserOwnerOfProperty(prop, user, allUsers)) return true;
  if (isUserAssignedAgentOfProperty(prop, user, allUsers)) return true;
  return false;
}
