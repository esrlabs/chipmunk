import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { ui } from '@register/services';
import { bridge } from '@service/bridge';
import { stop } from '@ui/env/dom';
import { Action as FileAnyAction } from '@service/actions/file.any';

@SetupService(ui['dropfiles'])
export class Service extends Implementation {
    protected enabled: boolean = false;

    protected drop(event: DragEvent): boolean {
        if (!this.enabled) {
            return true;
        }
        const files: string[] = this.getFiles(event);
        stop(event);
        if (files.length === 0) {
            this.log().warn(`No files dropped.`);
            return false;
        }
        this.log().debug(`${files.length} file(s) has been dropped`);
        bridge
            .files()
            .getByPath(files)
            .then((files) => {
                if (files.length === 0) {
                    return;
                }
                const action = new FileAnyAction();
                if (files.length === 1) {
                    action.from(files[0]);
                } else {
                    action.multiple(files);
                }
            })
            .catch((err: Error) => {
                this.log().warn(`Fail get files due: ${err.message}`);
            });
        return false;
    }

    protected stop(event: MouseEvent): boolean {
        if (!this.enabled) {
            return true;
        }
        return stop(event);
    }

    protected getFiles(event: DragEvent): string[] {
        if (event.dataTransfer === null || event.dataTransfer === undefined) {
            return [];
        }
        const files = (() => {
            if (event.dataTransfer.files) {
                return Array.from(event.dataTransfer.files).map((f) =>
                    window.electron.webUtils.getPathForFile(f),
                );
            } else if (event.dataTransfer.items) {
                return (
                    Array.from(event.dataTransfer.items)
                        .map((item: DataTransferItem) => {
                            if (item.kind === 'file') {
                                return item.getAsFile();
                            } else {
                                return undefined;
                            }
                        })
                        .filter((f) => f !== undefined) as File[]
                ).map((f) => window.electron.webUtils.getPathForFile(f));
            } else {
                return [];
            }
        })();
        return files;
    }

    public override ready(): Promise<void> {
        this.stop = this.stop.bind(this);
        this.drop = this.drop.bind(this);
        document.addEventListener('dragover', this.stop);
        document.addEventListener('dragleave', this.stop);
        document.addEventListener('drop', this.drop);
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        document.removeEventListener('dragover', this.stop);
        document.removeEventListener('dragleave', this.stop);
        document.removeEventListener('drop', this.drop);
        return Promise.resolve();
    }

    public state(): {
        enable(): void;
        disable(): void;
    } {
        return {
            enable: (): void => {
                this.enabled = true;
            },
            disable: (): void => {
                this.enabled = false;
            },
        };
    }
}
export interface Service extends Interface {}
export const dropfiles = register(new Service());
