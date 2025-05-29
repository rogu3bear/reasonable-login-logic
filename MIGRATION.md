# Migration Guide

This guide provides recommendations for reorganizing and migrating the repository to a new structure or IDE. It highlights key directories, suggested improvements, and references to documentation.

## Current Structure Overview

- `backend/` – Electron application handling credential storage, OAuth, browser automation, and security middleware.
- `frontend/` – React application containing flows, utilities, and UI components.
- `plugins/` – JSON definitions of service-specific credential flows (e.g., `openai.json`).
- `docs/` – Security documentation such as audit reports, incident response plans, and compliance checklists.

## Suggested Directory Changes

1. **Separate Build Artifacts**
   - Create a dedicated `dist/` folder for compiled backend and frontend builds. Keep source files in `src/` directories.
2. **Consolidate Security Docs**
   - Move all security-related Markdown files into `docs/security/` to keep them organized.
3. **Plugin Source and Builds**
   - If plugins include TypeScript or automation scripts, store source under `plugins/src/` and compile to `plugins/dist/`.
4. **Test and Lint Scripts**
   - Add a `tests/` directory for unit tests of both backend and frontend code.
   - Provide root-level `lint` and `test` npm scripts to enforce quality checks.
5. **Configuration Files**
   - Store shared TypeScript config in `tsconfig.base.json` and extend from it in frontend and backend.

## Migration Steps

1. **Prepare Dependencies**
   - Ensure Node.js 16+ and npm are installed.
   - Install project dependencies with `npm run install:all`.
2. **Build Process**
   - Run `npm run build` to compile the frontend.
   - Inside `backend/`, run `npm run build` to compile TypeScript to JavaScript.
3. **Development Mode**
   - Use `npm run start:electron` from the repository root to launch the Electron app with the React dev server.
4. **Packaging**
   - Execute `npm run package` inside `backend/` to generate installable binaries for Windows, macOS, and Linux.
5. **Security Audits**
   - Follow guidelines in `docs/SECURITY_AUDIT_REPORT.md` and `docs/SECURITY_COMPLIANCE.md` before releasing new versions.

## Notes About Documentation

Some documentation files contain placeholders (e.g., `[Name]`, `[Date]`). Update these with accurate information during the migration. Refer to `SECURITY.md` for encryption and session policies.

## Next Steps

After migrating, review the `CRITICAL_FAILURES.md` file to address code issues and consult `CURSOR.md` for tasks that require additional tooling.
