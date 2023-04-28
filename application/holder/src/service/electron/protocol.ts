import { protocol } from 'electron';

import * as url from 'url';
import * as fs from 'fs';

export class Protocol {
    public register() {
        protocol.registerFileProtocol('attachment', this.attachment.bind(this));
    }

    protected attachment(
        request: Electron.ProtocolRequest,
        callback: (response: string | Electron.ProtocolResponse) => void,
    ): void {
        const path = request.url.slice('attachment://'.length);
        if (fs.existsSync(path)) {
            callback(url.fileURLToPath(`file://${path}`));
        } else {
            callback('attachment://file_does_not_exist');
        }
    }
}
