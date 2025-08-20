import { nativeImage, clipboard, ipcMain } from 'electron';

/**
 * Registers an IPC handler for writing data into the system clipboard.
 *
 * @remarks
 * This method is intended to be called in the **main process**.
 * It exposes the `clipboard:write` channel, which can then be invoked
 * from a renderer process via `ipcRenderer.invoke`.
 */
export function register() {
    ipcMain.handle('clipboard:write', (_e, { mime, data }) => {
        const buf = Buffer.from(data);
        if (mime.startsWith('image/')) {
            const img = nativeImage.createFromBuffer(buf);
            clipboard.writeImage(img);
            return;
        }
        if (mime.startsWith('text/')) {
            clipboard.writeText(buf.toString('utf8'));
            return;
        }
        clipboard.writeBuffer(mime || 'application/octet-stream', buf);
        return;
    });
}
