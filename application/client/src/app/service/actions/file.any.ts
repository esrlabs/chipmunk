import { Base } from './action';
import { bridge } from '@service/bridge';
import { opener } from '@service/opener';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@tabs/sources/multiplefiles/component';
import { FileType, File } from '@platform/types/files';

export const ACTION_UUID = 'open_any_file';

export class Action extends Base {
    public group(): number {
        return 1;
    }
    public uuid(): string {
        return ACTION_UUID;
    }

    public caption(): string {
        return 'Open File(s)';
    }

    public async apply(): Promise<void> {
        const files = await bridge.files().select.any();
        if (files.length === 0) {
            return Promise.resolve();
        }
        if (files.length > 1) {
            this.multiple(files);
            return Promise.resolve();
        } else {
            return this.from(files[0]);
        }
    }

    public from(file: File): Promise<void> {
        return (() => {
            switch (file.type) {
                case FileType.Dlt:
                    return opener.binary(file).dlt();
                case FileType.Pcap:
                    return opener.pcap(file).dlt();
                    // TODO: Ask about parser >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
                default:
                    return opener.text(file).text();
            }
        })().then((_) => Promise.resolve());
    }

    public multiple(files: File[]) {
        session.add().tab({
            name: 'Multiple Files',
            active: true,
            closable: true,
            content: {
                factory: TabSourceMultipleFiles,
                inputs: { files: files },
            },
        });
    }
}
