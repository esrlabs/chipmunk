import { protocol } from 'electron';

import * as url from 'url';

export class Protocol {
    public register() {
        protocol.registerFileProtocol('attachment', this.attachment.bind(this));
    }

    protected attachment(
        _request: Electron.ProtocolRequest,
        callback: (response: string | Electron.ProtocolResponse) => void,
    ): void {
        const filePath = url.fileURLToPath('');
        callback(filePath);
    }
}
