import { PropertyItem, UserProfile } from '../types';

export function isAgentConfirmedOnProperty(
  prop: PropertyItem,
  agentUid?: string
): boolean {
  const agentId = (prop.agentId || '').trim();
  const reqAgentId = (prop.requestedAgentId || '').trim();
  const hasAgent = Boolean(
    agentId || (reqAgentId && prop.agentAssignmentStatus === 'asignado')
  );
  if (!hasAgent) return false;
  const statusOk =
    !prop.agentAssignmentStatus || prop.agentAssignmentStatus === 'asignado';
  if (!statusOk) return false;
  if (agentUid) {
    return (
      agentId === agentUid ||
      (reqAgentId === agentUid && prop.agentAssignmentStatus === 'asignado')
    );
  }
  return true;
}

export function isUserOwnerOfProperty(
  prop: PropertyItem,
  user: UserProfile | null
): boolean {
  if (!user) return false;
  if (prop.ownerId && prop.ownerId === user.uid) return true;

  const userEmail = (user.email || '').trim().toLowerCase();
  // Caso de enlace de cuenta demo o UID persistente de Alejandro Santamarina
  if (
    userEmail === 'propietario@clavehogar.com' &&
    prop.ownerId === 'kKqp7VS3xhPYfy6RvCh0SWJIqi12'
  ) {
    return true;
  }

  // Coincidencia por nombre de titular en roles propietario o cliente-propietario
  if (
    prop.ownerName &&
    user.displayName &&
    prop.ownerName.trim().toLowerCase() === user.displayName.trim().toLowerCase() &&
    (user.role === 'propietario' || user.isAlsoOwner)
  ) {
    return true;
  }

  return false;
}

export function isUserAssignedAgentOfProperty(
  prop: PropertyItem,
  user: UserProfile | null
): boolean {
  if (!user || user.role !== 'agente') return false;

  if (isAgentConfirmedOnProperty(prop, user.uid)) return true;

  const userEmail = (user.email || '').trim().toLowerCase();
  // Caso de enlace de cuenta demo o UID de Valentina Alvear
  if (
    userEmail === 'agente@clavehogar.com' &&
    isAgentConfirmedOnProperty(prop) &&
    (prop.agentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2' ||
      prop.requestedAgentId === 'SysykUHU5FVubQzrSHOBi3JnhQs2')
  ) {
    return true;
  }

  // Coincidencia por nombre de agente registrado en la propiedad
  if (
    prop.agentName &&
    user.displayName &&
    prop.agentName.trim().toLowerCase() === user.displayName.trim().toLowerCase() &&
    isAgentConfirmedOnProperty(prop)
  ) {
    return true;
  }

  return false;
}

export function canUserEditProperty(
  prop: PropertyItem,
  user: UserProfile | null
): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return true;
  if (isUserOwnerOfProperty(prop, user)) return true;
  if (isUserAssignedAgentOfProperty(prop, user)) return true;
  return false;
}
