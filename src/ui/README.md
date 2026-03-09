# UI Module Area

Planned home for DOM caching, rendering helpers, and overlay controllers.

Runtime extraction is active in `runtime-ui.js`, currently covering generic overlay show/hide helpers and initializer wiring for how-to-play and fallback settings overlay handlers.

Also extracted: settings overlay visibility/event wiring via `initializeSettingsOverlayBindings`.

Also extracted: settings presentation synchronization helpers (mode description, difficulty button active state, and review preference button state).

Also extracted: settings preference listener registration via `initializeSettingsPreferenceBindings`, with mutation/save callbacks injected from inline runtime.

Also extracted: player overlay listener registration via `initializePlayerOverlayBindings`, with player-state and persistence callbacks injected from inline runtime.

Also extracted: lifecycle/bootstrap wiring for page lifecycle save hooks and service-worker update prompt registration.

Also extracted: app startup bootstrap (`initializeAppDataBootstrap`) for DB init, data load, and welcome daily card render flow.

Also extracted: service-worker update prompt handler attachment (`attachServiceWorkerUpdatePromptHandlers`) used by runtime and inline registration paths.
