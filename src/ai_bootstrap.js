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
