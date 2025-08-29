import { contextBridge, ipcRenderer, webUtils } from 'electron';

/**
 * Exposes a safe API into the renderer process under `window.electron`.
 *
 * @remarks
 * This API is defined in the preload script and isolated via
 * `contextBridge.exposeInMainWorld`, so the renderer does not have
 * direct access to Node.js or Electron internals.
 *
 * Namespaces:
 * - `ipc` - wrapper around `ipcRenderer` for sending and receiving messages.
 * - `webUtils` - exposes selected Electron utilities (e.g. file path resolution).
 * - `clipboard` - provides clipboard operations via IPC handled in the main process.
 */
contextBridge.exposeInMainWorld('electron', {
    ipc: {
        /**
         * Sends a message to the main process on the specified channel.
         */
        send: (channel: string, msg: unknown) => ipcRenderer.send(channel, msg),

        /**
         * Subscribes to messages on the specified channel.
         */
        subscribe: (channel: string, callback: (...args: unknown[]) => void) =>
            ipcRenderer.on(channel, callback),

        /**
         * Removes a specific listener from the specified channel.
         */
        unsubscribe: (channel: string, callback: (...args: unknown[]) => void) =>
            ipcRenderer.removeListener(channel, callback),

        /**
         * Removes all listeners from the specified channel.
         */
        unsubscribeAll: (channel: string) => ipcRenderer.removeAllListeners(channel),
    },
    webUtils: {
        /**
         * Returns the absolute filesystem path for a given File object.
         */
        getPathForFile: (file: File) => webUtils.getPathForFile(file),
    },
    clipboard: {
        /**
         * Writes data into the system clipboard via the main process.
         *
         * @param mime - MIME type of the data (for example `text/plain` or `image/png`).
         * @param data - Raw content as an ArrayBuffer.
         * @returns A promise that resolves when the data is written.
         */
        write: (mime: string, data: ArrayBuffer) =>
            ipcRenderer.invoke('clipboard:write', { mime, data }),
    },
});
