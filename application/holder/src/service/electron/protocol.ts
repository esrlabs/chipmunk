import { protocol } from 'electron';

import * as url from 'url';
import * as fs from 'fs';
import * as mime from 'mime-types';
import * as path from 'path';
import * as net from 'platform/types/net';

const PROTOCOL: string = 'attachment';

/**
 * Provides a custom `attachment:` protocol for serving local files
 * directly to the renderer process.
 *
 * @remarks
 * The main communication channel between renderer and backend remains IPC,
 * but attachments are delivered via direct links. For security reasons,
 * file paths are URL-encoded - this is especially important on Windows,
 * where backslashes must be preserved safely.
 */
export class Protocol {
    /**
     * Creates a new instance of the protocol handler and registers the
     * custom scheme as privileged.
     *
     * @remarks
     * The scheme is marked with `corsEnabled` and `stream` privileges,
     * allowing use with the Fetch API and streaming large files directly.
     * This must be called before `app.whenReady()`.
     */
    constructor() {
        protocol.registerSchemesAsPrivileged([
            {
                scheme: PROTOCOL,
                privileges: {
                    corsEnabled: true,
                    stream: true,
                },
            },
        ]);
    }

    /**
     * Registers the `attachment:` scheme handler with Electron.
     *
     * @remarks
     * Uses `protocol.handle` (Electron 20+) to bind the {@link Protocol.attachment}
     * method as the request handler.
     */
    public register() {
        protocol.handle(PROTOCOL, this.attachment.bind(this));
    }

    /**
     * Resolves an `attachment:` URL to a local file and returns it as a streamed response.
     *
     * @param request - Incoming request targeting the `attachment:` scheme.
     * @returns A promise that resolves to:
     * - `200 OK` with a streaming body if the file exists and is readable;
     * - `404 Not Found` if the file does not exist or is inaccessible.
     *
     * @remarks
     * - The URL is decoded with `decodeURIComponent`, then converted into a `file:`
     *   URL and resolved to a filesystem path using `url.fileURLToPath`. This preserves
     *   Windows backslashes and prevents scheme confusion.
     * - Files are streamed via `fs.createReadStream` to support large attachments
     *   without buffering them entirely into memory.
     * - The response includes `Content-Type`, `Content-Length`, and
     *   `Content-Disposition` headers, as well as `Accept-Ranges` and
     *   `Cache-Control: no-store` for predictable client behavior.
     * - Fetching `file://` directly is not supported by Node’s `fetch` (undici),
     *   hence files are read and streamed manually.
     */
    protected async attachment(request: Request): Promise<Response> {
        const filePath = url.fileURLToPath(
            new URL(decodeURIComponent(request.url.replace(/^attachment:/, 'file:'))),
        );
        try {
            const stat = await fs.promises.stat(filePath);
            if (!stat.isFile()) {
                return new Response('File not found', { status: 404 });
            }

            const stream = fs.createReadStream(filePath);
            const contentType =
                mime.contentType(path.basename(filePath)) || net.CONTENT_TYPE_OCTET_STREAM;

            return new Response(stream, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Length': String(stat.size),
                    'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
                    'Accept-Ranges': net.ACCEPT_RANGES_BYTES,
                    'Cache-Control': net.CACHE_CONTROL_NO_STORE,
                },
            });
        } catch {
            return new Response('File not found', { status: 404 });
        }
    }
}
