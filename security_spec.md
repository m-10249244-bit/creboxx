# Security Specification for CRE Mystery Box Platform

## Data Invariants
1. A user can only access their own inventory.
2. A user can only modify their own display name (not balance or isAdmin status).
3. Draw records are immutable and can only be created by an authenticated user during a valid draw (though in a real server-authoritative app, a Cloud Function would handle the logic; for this client-side demo, we'll implement strict validation).
4. Boxes and Prizes can only be modified by admins.
5. Balance can only be incremented via "Top Up" (simulated for now) or Admin action.

## The Dirty Dozen (Attack Payloads)

1. **Identity Theft (Inventory)**: User A attempts to read User B's inventory item.
2. **Identity Spoofing (Write)**: User A attempts to create an inventory item for User B.
3. **Privilege Escalation (Admin)**: User A attempts to update their own profile set `isAdmin: true`.
4. **Denial of Wallet (ID Poisoning)**: User A attempts to create a document with a 1MB string ID.
5. **Money Glitch (Balance)**: User A attempts to update their own balance to `9999999`.
6. **Shadow Update (Ghost Fields)**: User A attempts to update a Box with `discount: 99%` (a field that doesn't exist but might be picked up by naive logic).
7. **Orphaned Record**: User A attempts to create an InventoryItem for a non-existent Box ID.
8. **PII Leak**: Unauthenticated user attempts to list all users.
9. **Draw Spoofing**: User A attempts to create a DrawRecord with `rarity: 'Secret'` for a common prize.
10. **Terminal State Bypass**: User A attempts to change an InventoryItem status from `shipped` back to `in_storage`.
11. **Timestamp Manipulation**: User A attempts to set `wonAt` to a future date.
12. **Box Vandalism**: Authenticated non-admin user attempts to delete a Box.

## Security Rules Plan (Draft)

- `match /users/{userId}`: `read` if `isOwner(userId)`, `create` if `isOwner(userId)` and `balance == 0`, `update` if `isOwner(userId)` but allow only `displayName`, `photoURL`.
- `match /boxes/{boxId}`: `read` for everyone, `write` only `isAdmin()`.
- `match /boxes/{boxId}/prizes/{prizeId}`: `read` for everyone, `write` only `isAdmin()`.
- `match /inventory/{itemId}`: `read`, `write` if `isOwner(resource.data.userId)` and `isValidInventoryItem()`.
- `match /draws/{drawId}`: `read` for everyone (real-time feed), `create` if `isSignedIn()` and `isValidDraw()`.
