# Local AI Host Integration

This repository currently supports a browser-only app plus a local installer helper script.

## What exists today

- `tools/install_local_ai.sh` installs Ollama and pulls `llama3.2`.
- `src/runtime.js` exposes `window.installLocalAi()`.
- `src/render_modals.js` adds an `Install local AI` button in the AI settings UI.
- `src/ai_bootstrap.js` provides a no-op fallback for browser-only environments.

## What is needed for in-app integration

A host environment must provide a real implementation for `window.__AI_BOOTSTRAP__`.
The host should expose a `runBootstrap()` function that can run shell commands or
invoke the installer helper.

### Example host contract

```js
window.__AI_BOOTSTRAP__ = {
  async runBootstrap() {
    return await invokeLocalInstaller();
  }
};
```

### Example Electron integration

1. Use `child_process.spawn` to run `tools/install_local_ai.sh`.
2. Capture stdout/stderr and return `{ ok: '...' }` or `{ error: '...' }`.
3. Expose the result to the renderer via `contextBridge`.

## Why the app still works without integration

- In a plain browser, the installer button falls back to `no_installer`.
- The shell script can still be run manually outside the browser.
- AI remains optional and the app degrades gracefully if Ollama is unavailable.
