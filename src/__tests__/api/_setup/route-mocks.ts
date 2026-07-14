/**
 * Shared test setup for API route tests under src/__tests__/api/**.
 *
 * Centralises the canonical mock bodies required by the systemic
 * 401-vs-404 route repair (Slice 1):
 *  - @/core/modules/manifest: enable the module-under-test so the
 *    `withModuleRoute` gate does not short-circuit to 404.
 *  - @/core/actions/context: stub buildUserContext so the route-adapter
 *    receives a deterministic user context (authOk) or rejects with
 *    'unauthenticated' (authFail), yielding the canonical 401.
 *
 * Each route test must wire `buildUserContext` inside its authOk /
 * authFail helpers (see e.g. src/__tests__/api/leads/kanban/route.test.ts).
 */

// Shared mock bodies — used by jest.mock factories in each route test.
export const manifestMock = {
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set<string>()),
  },
};

export const contextMock = {
  buildUserContext: jest.fn(),
  buildSystemContext: jest.fn(),
  buildDelegatedContext: jest.fn(),
};
