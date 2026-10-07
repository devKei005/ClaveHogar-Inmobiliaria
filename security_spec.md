# Security Specification — claveHogar (`security_spec.md`)

## 1. Data Invariants

1. **Identity & Authentication Invariant**: All write operations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **PII Split-Collection Isolation**: User personal identifiable information (`email`, `phone`, `address`, `dni`) is strictly isolated in `/users_private/{userId}` and can only be read or modified by the document owner (`request.auth.uid == userId`) or a verified system Administrator (`isAdmin()`).
3. **Immutable Ownership & Temporal Integrity**: Every entity's `createdAt` timestamp must equal `request.time` on creation and remain immutable on update (`incoming().createdAt == existing().createdAt`). Every update must set `updatedAt == request.time`. Author/owner fields (`uid`, `ownerId`, `clientId`, `reporterId`, `userId`) must match `request.auth.uid` on creation and remain immutable during updates.
4. **Strict Key & Size Boundaries**: Every write operation is guarded by `isValid[Entity](incoming())`, which validates exact required and optional keys (`hasAll` and `hasOnly`), string length limits (`.size() <= maxLength`), numeric bounds, and bounded list sizes.
5. **Query Enforcer (No Blanket List)**: Every `allow list` rule restricts access via `resource.data` (or verified admin email) without invoking `get()` or `exists()` lookups inside `list`.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Property Creation)**: Authenticated user `user_A` attempts to create `/properties/prop_1` with `ownerId: "user_B"`. -> `PERMISSION_DENIED`.
2. **Payload 2 (Shadow Field Injection on Property Update)**: Owner `user_A` updates `/properties/prop_1` with an undeclared field `"isFeaturedHack": true`. -> `PERMISSION_DENIED`.
3. **Payload 3 (Unverified Email Write Attempt)**: Authenticated user with `email_verified: false` attempts to create `/users_public/user_A`. -> `PERMISSION_DENIED`.
4. **Payload 4 (PII Cross-User Read)**: Authenticated user `user_B` attempts `get` on `/users_private/user_A`. -> `PERMISSION_DENIED`.
5. **Payload 5 (Privilege Escalation via Self-Admin Assignment)**: Non-admin user `user_A` attempts to create or update `/users_public/user_A` with `role: "administrador"`. -> `PERMISSION_DENIED`.
6. **Payload 6 (Timestamp Forgery on Creation)**: Client attempts to create `/visits/visit_1` with a past or future `createdAt` timestamp not matching `request.time`. -> `PERMISSION_DENIED`.
7. **Payload 7 (Immortal Field Mutation on Update)**: Owner `user_A` attempts to update `/properties/prop_1` while changing `createdAt` or `ownerId`. -> `PERMISSION_DENIED`.
8. **Payload 8 (Denial-of-Wallet Oversized String)**: Client attempts to create `/inquiries/inq_1` with a `question` string of 5,000 characters (`maxLength: 1000`). -> `PERMISSION_DENIED`.
9. **Payload 9 (Unbounded Array Injection)**: Owner attempts to create `/properties/prop_1` with 25 items in `features` (`max: 15`). -> `PERMISSION_DENIED`.
10. **Payload 10 (Unauthorized Visit Confirmation by Client)**: Client `user_C` who requested `/visits/visit_1` attempts to update `status` to `"confirmada"` (reserved for `ownerId` or `agentId`). -> `PERMISSION_DENIED`.
11. **Payload 11 (Terminal State Mutation on Operation)**: Non-admin user attempts to modify `/operations/op_1` after `status` has already reached terminal state `"rechazada"`. -> `PERMISSION_DENIED`.
12. **Payload 12 (Unauthorized Blanket List Scraping)**: Authenticated user `user_B` attempts to `list` `/favorites` without filtering `where("userId", "==", "user_B")`. -> `PERMISSION_DENIED`.
