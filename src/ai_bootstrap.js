/*
MODULE: ai_bootstrap.js
LAYER: services/host adapter
PURPOSE: Expose a browser-safe local AI installer stub for optional native hosts.
USES: window.__AI_BOOTSTRAP__
INVARIANTS: Browser mode never claims to install software or access the filesystem.
LAST_STABILIZED: 2026-07-01
*/
/*
Optional host integration for local AI installation.

This file is a browser-safe stub. In a native host environment
(e.g. Electron or a wrapper with filesystem access), replace or extend
this implementation to expose a real installer via
window.__AI_BOOTSTRAP__.runBootstrap().
*/

window.__AI_BOOTSTRAP__ = window.__AI_BOOTSTRAP__ || {
  async runBootstrap() {
    return { error: 'no_installer' };
  },
};
