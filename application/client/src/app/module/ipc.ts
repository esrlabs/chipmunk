import { Packed } from '@platform/ipc/transport/index';

/**
 * Extends the global `window` object with the safe Electron API
 * exposed from the preload script.
 *
 * @remarks
 * This API provides a limited, secure surface for the renderer process.
 * It includes IPC communication, selected web utilities, and clipboard access.
 */
declare global {
    interface Window {
        /**
         * Namespaced Electron API exposed to the renderer.
         */
        electron: {
            ipc: IPC;
            webUtils: WebUtils;
            clipboard: Clipboard;
        };
    }
}

/**
 * Checks if the `electron` API is available on the current `window` context.
 *
 * @returns `true` if the API is defined, otherwise `false`.
 */
export function isAvailable(): boolean {
    return window.electron !== undefined && window.electron !== null;
}

/**
 * IPC communication interface exposed to the renderer.
 *
 * Provides methods for sending messages to the main process and
 * subscribing or unsubscribing from IPC channels.
 */
export interface IPC {
    /**
     * Sends a message to the main process over the specified channel.
     *
     * @param channel - IPC channel identifier.
     * @param msg - Serialized message payload.
     */
    send: (channel: string, msg: Packed) => void;

    /**
     * Subscribes a callback to events from the specified channel.
     *
     * @param channel - IPC channel identifier.
     * @param callback - Function invoked with event arguments.
     */
    subscribe: (channel: string, callback: (...args: any[]) => void) => void;

    /**
     * Removes a previously subscribed callback from the specified channel.
     *
     * @param channel - IPC channel identifier.
     * @param callback - Callback to be removed.
     */
    unsubscribe: (channel: string, callback: (...args: any[]) => void) => void;

    /**
     * Removes all listeners from the specified channel.
     *
     * @param channel - IPC channel identifier.
     */
    unsubscribeAll: (channel: string) => void;
}

/**
 * Utilities exposed from Electron's `webUtils`.
 */
export interface WebUtils {
    /**
     * Resolves the absolute filesystem path for a given File object.
     *
     * @param file - A File object obtained in the renderer.
     * @returns The absolute filesystem path.
     */
    getPathForFile(file: File): string;
}

/**
 * Clipboard interface exposed to the renderer.
 *
 * Provides write-only access to the system clipboard via IPC.
 */
export interface Clipboard {
    /**
     * Writes arbitrary data into the system clipboard.
     *
     * @param mime - MIME type of the data (e.g. `text/plain`, `image/png`).
     * @param data - Content as an ArrayBuffer.
     */
    write(mime: string, data: ArrayBuffer): void;
}
