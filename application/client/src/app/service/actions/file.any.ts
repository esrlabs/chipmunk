import { Base } from './action';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { TabSourceMultipleFiles } from '@ui/tabs/multiplefiles/component';
import { File } from '@platform/types/files';
import { FileType } from '@platform/types/observe/types/file';

import * as Factory from '@platform/types/observe/factory';

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

    public from(file: File): void {
        switch (file.type) {
            case FileType.Binary:
            case FileType.PcapNG:
            case FileType.PcapLegacy:
                session
                    .initialize()
                    .configure(
                        new Factory.File().type(file.type).file(file.filename).asDlt().get(),
                    );
                break;
            case FileType.Text:
                session
                    .initialize()
                    .observe(
                        new Factory.File()
                            .type(Factory.FileType.Text)
                            .file(file.filename)
                            .asText()
                            .get(),
                    );
                break;
        }
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
