/**
 * Firestore Security Rules Test Suite — Dirty Dozen Verification
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Property Creation',
    collection: 'properties/prop_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { ownerId: 'spoofed_owner_uid' },
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Property Update',
    collection: 'properties/prop_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { isFeaturedHack: true },
  },
  {
    id: 3,
    name: 'Unverified Email Write Attempt',
    collection: 'users_public/user_A',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Cross-User Read on users_private',
    collection: 'users_private/user_A',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Privilege Escalation to Administrador Role',
    collection: 'users_public/user_A',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { role: 'administrador' },
  },
  {
    id: 6,
    name: 'Timestamp Forgery on Visit Creation',
    collection: 'visits/visit_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 7,
    name: 'Immortal Field Mutation (ownerId / createdAt)',
    collection: 'properties/prop_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { ownerId: 'another_uid' },
  },
  {
    id: 8,
    name: 'Denial-of-Wallet Oversized String in Inquiry',
    collection: 'inquiries/inq_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { question: 'A'.repeat(5000) },
  },
  {
    id: 9,
    name: 'Unbounded Array Injection in Property Features',
    collection: 'properties/prop_1',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    payload: { features: Array.from({ length: 25 }, (_, i) => `feat_${i}`) },
  },
  {
    id: 10,
    name: 'Unauthorized Visit Confirmation by Client',
    collection: 'visits/visit_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { status: 'confirmada' },
  },
  {
    id: 11,
    name: 'Terminal State Mutation on Rejected Operation',
    collection: 'operations/op_1',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    payload: { status: 'aprobada' },
  },
  {
    id: 12,
    name: 'Unauthorized Blanket List Scraping on Favorites',
    collection: 'favorites',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
  },
];
