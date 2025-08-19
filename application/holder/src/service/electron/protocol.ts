import { protocol } from 'electron';

import * as url from 'url';
import * as fs from 'fs';

/// The primary communication channel between the renderer and the backend is IPC.
/// However, attachments are delivered via direct links. For security reasons these
/// links are URL‑encoded, which is especially important to safely carry Windows
/// paths with backslashes.
export class Protocol {
    /**
     * Registers the custom `attachment:` scheme handler in the Electron main process.
     *
     * The handler serves local files referenced by `attachment://` URLs.
     * See {@link Protocol.attachment}.
     *
     * @remarks
     * This uses `protocol.handle` (Electron 20+) and binds the instance method as the
     * request handler.
     */
    public register() {
        protocol.handle('attachment', this.attachment.bind(this));
    }

    /**
     * Attachment handler that resolves an `attachment:` URL to a local file and
     * returns it as a `Response`.
     *
     * @param request - Incoming request targeting the `attachment:` scheme.
     * @returns A promise that resolves to:
     * - `200 OK` with the file content in the body when the file exists and can be read;
     * - `404 Not Found` when the file cannot be read (e.g., missing or inaccessible).
     *
     * @remarks
     * - The URL is first decoded (with `decodeURIComponent`) and converted to a `file:`
     *   URL, then to a filesystem path via `url.fileURLToPath`. This preserves Windows
     *   paths that contain backslashes and disallows accidental scheme confusion.
     * - If the path does not exist, the method rejects the promise with an Error.
     *   Any read errors are converted into a `404` HTTP-like response.
     * - Do not call `fetch(file://…)` in Node/Electron; Node’s `fetch` (undici)
     *   does not implement the `file:` scheme. Read the file directly, as below.
     */
    protected async attachment(request: Request): Promise<Response> {
        const path = url.fileURLToPath(
            new URL(decodeURIComponent(request.url.replace(/^attachment:/, 'file:'))),
        );
        if (!fs.existsSync(path)) {
            return Promise.reject(new Error(`File doesn't exist`));
        }
        try {
            const buffer = await fs.promises.readFile(path);
            return new Response(buffer);
        } catch (_err) {
            return new Response('File not found', { status: 404 });
        }
    }
}
