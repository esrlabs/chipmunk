import { ErrorState } from '@elements/autocomplete/error';
import { Subject } from '@platform/env/subscription';
import { bridge } from '@service/bridge';
import { EntityType } from '@platform/types/files';

export class CwdErrorState extends ErrorState {
    protected updated: Subject<void> = new Subject();
    protected error: string | undefined;

    public validate(): void {
        bridge
            .files()
            .stat(this.value)
            .then((info) => {
                if (info.type === EntityType.Directory) {
                    this.error = undefined;
                } else if (info.type === EntityType.File) {
                    this.error = `File cannot be used as CWD`;
                } else {
                    this.error = `Define path to folder (CWD)`;
                }
            })
            .catch((err: Error) => {
                this.error = err.message;
            })
            .finally(() => {
                this.updated.emit();
            });
    }

    public is(): boolean {
        return this.error !== undefined;
    }

    public msg(): string {
        return this.error === undefined ? '' : this.error;
    }

    public observer(): Subject<void> {
        return this.updated;
    }
}
