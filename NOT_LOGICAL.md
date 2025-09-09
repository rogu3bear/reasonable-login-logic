# Potential Logic Issues

This file summarizes functions that may have questionable logic or inconsistencies across the repository. Files that were reviewed include all TypeScript/JavaScript sources in the `backend/` and `frontend/` directories.

## IndexedDB Store Creation

Two different helper functions create the same IndexedDB database `credential_vault` but define different object stores:

- `CredentialVault.openIndexedDB` in `frontend/src/utils/credentialVault.ts` creates a `vault` store.
- `openIndexedDB` in `frontend/src/utils/encryption.ts` creates a `keys` store.

Both use database version `1`. If the database is created by one module first, the other module will not receive an upgrade event to add its object store. Later transactions against the missing store will fail. ~~These functions should coordinate database versioning or share a single initialization routine.~~

**Resolved:** Added a shared `openCredentialDB` helper (`frontend/src/utils/indexedDb.ts`) that creates both `vault` and `keys` stores. Both `credentialVault.ts` and `encryption.ts` now use this helper.

## PBKDF2 Iteration Comment

In `frontend/src/utils/encryption.ts`, the constant `PBKDF2_ITERATIONS` is set to `100000` with a comment “Increased from 100000 for better security.” The comment does not match the value and likely meant a different previous number.

```ts
const PBKDF2_ITERATIONS = 100000; // PBKDF2 iteration count
```

## Unused Import

`backend/ipc/oauthServer.ts` imported `querystring` but never used it.

**Resolved:** Removed the unused import.

```ts
import * as querystring from 'querystring';
```

## Possible Playwright Context Parameter

In `backend/ipc/automationIpc.ts`, `createSecureContext` passed a `userDataDir` option to `browser.newContext()`. Playwright only supports `userDataDir` when launching a persistent context.

**Resolved:** The option was removed from the context options.

## Other Observations

No other major logic problems were identified. Most functions have clear responsibilities and consistent control flow.
