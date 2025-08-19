import { protocol } from 'electron';

import * as url from 'url';
import * as fs from 'fs';

export class Protocol {
    public register() {
        protocol.handle('attachment', this.attachment.bind(this));
    }

    protected async attachment(request: Request): Promise<Response> {
        const path = url.fileURLToPath(new URL(request.url.replace(/^attachment:/, 'file:')));
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
