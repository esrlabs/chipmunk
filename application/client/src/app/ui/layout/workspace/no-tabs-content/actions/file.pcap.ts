import { Base } from './action';
import { bridge } from '@service/bridge';
// import { opener } from '@service/opener';

export const ACTION_UUID = 'open_pcap_file';

export class Action extends Base {
    public group(): number {
        return 0;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open PCAP File';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.pcap();
        if (files.length !== 1) {
            return Promise.resolve();
        }
        return Promise.reject(new Error(`Not implemented!`));
    }
}
