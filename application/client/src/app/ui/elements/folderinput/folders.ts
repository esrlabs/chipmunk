import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { bridge } from '@service/bridge';
import { Folder } from './folder';
import { Holder } from '@module/matcher/holder';

@SetupLogger()
export class FoldersList extends Holder {
    public items: Folder[] = [];
    public parent: string = '/';
    public observer!: Observable<Folder[]>;

    protected readonly control: UntypedFormControl;
    protected previous: string = '';
    protected delimiter: string = '';

    constructor(control: UntypedFormControl) {
        super();
        this.control = control;
        this.setLoggerName(`FolderListController`);
        this.assign();
        bridge
            .folders()
            .delimiter()
            .then((delimiter) => {
                this.delimiter = delimiter;
            })
            .catch((err: Error) => {
                this.log().error(`Fail to request delimiter: ${err.message}`);
            });
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
                return this.items.sort((a: Folder, b: Folder) => b.getScore() - a.getScore());
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
        this.items = await (
            await bridge.folders().ls([target])
        ).map((i) => new Folder(target, i, this.delimiter, this.matcher));
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
        const finish = (parent: string, query: string | undefined) => {
            this.matcher.search(query === undefined ? '' : query);
            this.parent = parent;
        };
        const info = candidate.trim() === '' ? undefined : await bridge.files().name(candidate);
        let suggestion = await suggest(candidate, this.parent);
        if (suggestion !== undefined) {
            finish(suggestion, info?.name);
            return Promise.resolve();
        }
        if (info === undefined) {
            return Promise.resolve();
        }
        suggestion = await suggest(info.parent, this.parent);
        if (suggestion !== undefined) {
            finish(suggestion, info.name);
        } else {
            finish('', '');
        }
        return Promise.resolve();
    }
}
export interface FoldersList extends LoggerInterface {}
