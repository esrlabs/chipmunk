import { nativeImage, clipboard, ipcMain } from 'electron';

import * as net from 'platform/types/net';

/**
 * Registers an IPC handler for writing data into the system clipboard.
 *
 * @remarks
 * This method is intended to be called in the **main process**.
 * It exposes the `clipboard:write` channel, which can then be invoked
 * from a renderer process via `ipcRenderer.invoke`.
 */
export function register() {
    ipcMain.handle(
        'clipboard:write',
        (_e, { mime, data }: { mime: string | undefined; data: ArrayBuffer }) => {
            const buffer = Buffer.from(data);
            if (typeof mime !== 'string') {
                clipboard.writeBuffer(net.CONTENT_TYPE_OCTET_STREAM, buffer);
            } else if (mime.startsWith('image/')) {
                const img = nativeImage.createFromBuffer(buffer);
                clipboard.writeImage(img);
            } else if (mime.startsWith('text/')) {
                clipboard.writeText(buffer.toString('utf8'));
            }
        },
    );
}
