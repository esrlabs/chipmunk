import { Base } from './action';
import { bridge } from '@service/bridge';
import { opener } from '@service/opener';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@tabs/sources/multiplefiles/component';
import { FileType } from '@platform/types/files';

export const ACTION_UUID = 'open_any_file';

export class Action extends Base {
    public group(): number {
        return 1;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open Any File(s)';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.any();
        if (files.length === 0) {
            return Promise.resolve();
        }
        if (files.length > 1) {
            session.add().tab({
                name: 'Multiple Files',
                active: true,
                closable: true,
                content: {
                    factory: TabSourceMultipleFiles,
                    inputs: { files: files },
                },
            });
            return Promise.resolve();
        } else {
            return (() => {
                switch (files[0].type) {
                    case FileType.Dlt:
                        return opener.file(files[0]).dlt();
                    case FileType.Pcap:
                        throw new Error(`Not supported`);
                    default:
                        return opener.file(files[0]).text();
                }
            })().then((_) => Promise.resolve());
        }
    }
}
