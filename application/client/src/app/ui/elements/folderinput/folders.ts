import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { bridge } from '@service/bridge';

@SetupLogger()
export class FoldersList {
    public items: string[] = [];
    public parent: string = '/';
    public observer!: Observable<string[]>;

    protected readonly control: FormControl;
    protected previous: string = '';

    constructor(control: FormControl) {
        this.control = control;
        this.setLoggerName(`FolderListController`);
        this.assign();
    }

    public setParent() {
        this.update();
    }

    protected assign() {
        this.observer = this.control.valueChanges.pipe(
            startWith(''),
            map((_updated: string) => {
                this.update().catch((err: Error) => {
                    this.log().error(err.message);
                });
                return this.items;
            }),
        );
    }

    protected async update(): Promise<void> {
        const candidate = this.control.value;
        if (typeof candidate !== 'string') {
            return Promise.resolve();
        }
        await this.candidate(candidate);
        if (this.parent.trim() === '') {
            this.items = [];
            return Promise.resolve();
        }
        if (this.parent.trim() === '') {
            this.items = [];
            return Promise.resolve();
        }
        if (this.previous === this.parent) {
            return Promise.resolve();
        }
        const target = this.parent;
        this.items = await bridge.folders().ls(target);
        this.previous = target;
        this.assign();
    }

    protected async candidate(candidate: string): Promise<void> {
        async function suggest(candidate: string, current: string): Promise<string | undefined> {
            if (candidate === current) {
                return Promise.resolve(candidate);
            }
            if (candidate === '.' || candidate.trim() === '') {
                return Promise.resolve('');
            }
            if (await bridge.files().exists(candidate)) {
                return Promise.resolve(candidate);
            }
            return Promise.resolve(undefined);
        }
        let suggestion = await suggest(candidate, this.parent);
        if (suggestion !== undefined) {
            this.parent = suggestion;
            return Promise.resolve();
        }
        suggestion = await suggest(
            await (
                await bridge.files().name(candidate)
            ).parent,
            this.parent,
        );
        if (suggestion !== undefined) {
            this.parent = suggestion;
        } else {
            this.parent = '';
        }
        return Promise.resolve();
    }
}
export interface FoldersList extends LoggerInterface {}
