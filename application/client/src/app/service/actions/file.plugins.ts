import { Base } from './action';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { SessionOrigin } from '@service/session/origin';
import { TabSourceMultipleFiles } from '@ui/tabs/multiplefiles/component';

export const ACTION_UUID = 'open_file_parser_plugins';

export class Action extends Base {
    public override group(): number {
        return 0;
    }

    public override uuid(): string {
        return ACTION_UUID;
    }

    public override caption(): string {
        return 'Open file with parser plugins';
    }

    public override async apply(): Promise<void> {
        const files = await bridge.files().select.parserPlugin();
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
        } else {
            session.initialize().configure(SessionOrigin.file(files[0].filename));
        }
        return Promise.resolve();
    }
}
