import * as clipboard from './clipboard';

/**
 * Registers all available IPC APIs that must be exposed
 * to the renderer process.
 *
 * @remarks
 * Call this function once in the **main process** during
 * application startup (e.g. after `app.whenReady()`).
 *
 * This function delegates to the individual API modules
 * (such as `clipboard.register()`), ensuring their IPC
 * channels are set up and ready for renderer use via
 * `ipcRenderer.invoke` / `contextBridge`.
 */
export function register() {
    clipboard.register();
}
