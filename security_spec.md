# Security Specifications for NotesBazaar Database & Admin Vault

This document details the zero-trust security model, strict invariants, "Dirty Dozen" penetration vectors, and client/server safeguards protecting NotesBazaar.

## 1. Data Invariants & Access Tiers

- **User profile (`/users/{userId}`)**:
  - Single-document `get`: allowed only for profile owner (`request.auth.uid == userId`) or verified Admin.
  - Collection `list`: allowed strictly for bootstrapped founder Admin (no O(n) `exists()` queries inside `allow list`).
  - `create`: only if document ID matches `request.auth.uid`, valid schema, and `role == 'user'` (unless bootstrapped verified founder email).
  - `update`: owner may only update allowed profile/purchase keys (`displayName`, `purchasedNotes`, `membershipType`, `membershipExpiry`, `updatedAt`) and CANNOT escalate `role`.

- **Products (`/products/{productId}`)**:
  - Publicly readable (`get`, `list`) for storefront browsing.
  - Creatable, updatable, deletable strictly by verified Admin users with strict type and size bounds.

- **Orders (`/orders/{orderId}`)**:
  - Single-doc `get`: only authenticated buyer matching `user_email` or `uid`, or Admin.
  - Query `list`: enforces `resource.data.user_email == request.auth.token.email` or `resource.data.uid == request.auth.uid` or bootstrapped founder Admin.
  - `create`: requires authenticated, email-verified user whose token email matches `user_email` (or Admin), with `amount >= 0` and valid payment status.
  - `update`, `delete`: Admin only.

- **Reviews (`/reviews/{reviewId}`)**:
  - Publicly readable (`get`, `list`).
  - `create`: authenticated, email-verified buyer whose `uid == request.auth.uid` and who owns the product (or Admin).
  - `update`: review author may update only `rating`, `comment`, `updatedAt` (cannot reassign `uid` or `productId`).
  - `delete`: author or Admin.

- **Contacts (`/contacts/{contactId}`)**:
  - `create`: validated public/user inquiry submission (`name`, `email`, `subject`, `message`, `created_at`) with strict character length caps to prevent payload exhaustion.
  - `get`, `list`, `update`, `delete`: Admin only.

- **Settings (`/settings/{settingId}`)**:
  - `settings/main` (public payment Key ID, hero text, support links): publicly readable `get`.
  - `settings/admin_security` (salted SHA-256 hash of Admin Vault password): strictly Admin ONLY (`get`, `list`, `create`, `update`, `delete` blocked for all non-admin users).

- **Managed Files (`/managed_files/{fileId}`)**:
  - Admin-only storage metadata registry for PDFs and preview assets.

- **Coupons (`/coupons/{couponId}`)**:
  - Single-doc `get` allowed by exact uppercase coupon code ID for checkout validation; `list`, `create`, `update`, `delete` restricted strictly to Admin.

- **Campaigns (`/campaigns/{campaignId}`)**:
  - Publicly readable for live countdown banner; writes strictly Admin-only.

- **Entitlements & Downloads (`/entitlements/{id}`, `/downloads/{id}`)**:
  - Strictly scoped to `uid == request.auth.uid` or Admin. Prevents unauthorized cross-user access and enforces download counter bounds.

- **Activity Logs (`/activity_logs/{logId}`)**:
  - `create`: authenticated user logging real action with matching `uid`.
  - `get`, `list`: Admin only.
  - `update`, `delete`: forbidden (`false`) to preserve an immutable compliance audit trail.

- **Admin Vault Gate (Client + Session Hardening)**:
  - No email-substring privilege escalation (`email.includes('admin')` completely removed).
  - Entering `/admin` requires unlocking the SHA-256 Password-Protected Admin Vault (5-attempt brute-force rate limit with 60-second lockout cooldown + founder Google re-authentication recovery).

---

## 2. The "Dirty Dozen" Malicious Payloads (Must Return PERMISSION_DENIED)

1. **Unauthorized Profile Read**: `get /users/victim_123` authenticated as `attacker_456`.
2. **Self-Promotion on Register**: `create /users/attacker_456` with `role: "admin"`.
3. **Privilege Escalation Update**: `update /users/attacker_456` attempting to change `role` from `"user"` to `"admin"`.
4. **Shadow Ghost Field Injection**: `create /reviews/rev_1` with an undeclared field `isVerifiedAdmin: true`.
5. **Anonymous Product Creation / Price Tampering**: `create` or `update /products/prod_1` setting `price: 0` as non-admin.
6. **Admin Passcode Hash Scraping**: `get /settings/admin_security` or `list /settings` by non-admin user.
7. **Email Spoofing Attack**: `create /orders/ord_1` as admin email with `email_verified: false`.
8. **Order Hijack / Scraping**: `list /orders` by user querying another user's email.
9. **Fake Verification Review**: `create /reviews/rev_2` by user who has not purchased `productId`.
10. **Review Author Hijack**: `update /reviews/rev_1` changing `uid` or `productId`.
11. **Oversized Resource Poisoning**: `create /contacts/c_1` with a 50KB `message` or invalid `contactId` path.
12. **Audit Log Deletion / Tampering**: Non-admin or admin attempting `delete` or `update` on `/activity_logs/log_1`.
