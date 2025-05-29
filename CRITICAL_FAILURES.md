# Critical Failures and Code Quality Concerns

This document lists notable issues found during a static review of the repository. The goal is to highlight potential null pointer problems, unbounded loops, and general practices that could be improved.

## Potential Null Pointer Issues

1. **OAuth Server Address Retrieval**
   - In `backend/ipc/oauthServer.ts`, the server's address is cast to `{ port: number }` without checking for `null`. If the HTTP server fails to start, `server.address()` can return `null`, which would cause a runtime error.
2. **Automation Job Context Access**
   - `backend/ipc/automationIpc.ts` accesses `activeJobs[jobId].context` during cleanup. If a job entry is removed elsewhere, this may lead to `undefined` access and throw an exception.
3. **Vault Initialization Checks**
   - Methods in `frontend/src/utils/credentialVault.ts` rely on `this.encryptionKey` and `this.vaultData`. Although initialization routines set these fields, extra guards would help prevent accidental usage before initialization.

## Loop and Resource Concerns

1. **Recursive Directory Scanning**
   - `backend/utils/securityAudit.ts` performs recursive scans without depth limits or symlink checks. Large directories or circular links could cause long-running operations.
2. **Interval Cleanup**
   - Both OAuth and automation modules start `setInterval` timers for cleanup. Ensure these are cleared when the app quits to avoid dangling timers.
3. **Browser Automation**
   - `backend/ipc/automationIpc.ts` keeps completed jobs for one minute before removal. If many jobs finish quickly, the `activeJobs` object could grow temporarily, leading to memory pressure.

## Other Practices to Improve

- **Missing Test/Lint Scripts** – The repository root lacks standard `lint` and `test` scripts. `npm test` fails because no script is defined.
- **Placeholder Documentation** – Files in the `docs/` directory contain placeholders like `[Name]` and `[Date]`, which should be replaced with real information.
- **Security Headers** – The Content Security Policy in `backend/config/security.ts` allows `'unsafe-inline'` scripts. Consider removing this to reduce XSS risk.
- **Error Handling Consistency** – Some IPC handlers log errors but return generic messages. Standardizing error responses would improve debugging.

Refer to the `MIGRATION.md` guide for reorganization recommendations and see `CURSOR.md` for tasks requiring additional tooling or environment setup.
