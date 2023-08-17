import { Entity } from './providers/entity';
import { Entries } from './providers/entries';
import { Providers } from './providers/providers';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Holder } from '@module/matcher/holder';
import { unique } from '@platform/env/sequence';
import { INoContentActions, IStatistics } from './providers/provider';
import { IMenuItem } from '@ui/service/contextmenu';

export type CloseHandler = () => void;

export class State extends Holder {
    public readonly update: Subject<void> = new Subject<void>();
    public readonly uuid: string = unique();
    public entries: Entries;

    public statistics: IStatistics[] = [];
    public loading: boolean = true;

    protected close: CloseHandler | undefined;
    protected readonly ilc: IlcInterface & ChangesDetector;
    protected readonly providers: Providers;

    constructor(ilc: IlcInterface & ChangesDetector) {
        super();
        this.ilc = ilc;
        this.entries = new Entries(this.uuid, ilc, this.matcher, this.update);
        this.providers = new Providers(ilc, this.matcher, this.entries);
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keyup',
                    window,
                    (event: KeyboardEvent) => {
                        if (event.key === 'ArrowDown') {
                            this.entries.move().down();
                        } else if (event.key === 'ArrowUp') {
                            this.entries.move().up();
                        } else if (event.key === 'Enter') {
                            const target = this.entries.getSelected();
                            if (target === undefined) {
                                return true;
                            }
                            this.action(target);
                            return true;
                        }
                        ilc.markChangesForCheck();
                        return true;
                    },
                ),
        );
        this.loading = true;
        this.providers
            .load()
            .then(() => {
                this.entries.defaultSelection();
                this.loading = false;
                this.statistics = this.providers.stat();
                this.update.emit();
            })
            .catch((err: Error) => {
                this.ilc.log().error(`Fail to load navigation entries with: ${err.message}`);
            });
    }

    public destroy() {
        this.providers.destroy();
    }

    public bind(close: CloseHandler) {
        this.close = close;
    }

    public isEmpty(): boolean {
        return this.entries.len() === 0;
    }

    public count(): number {
        return this.entries.len();
    }

    public action(entity: Entity): void {
        this.providers.action(entity.origin);
        this.close !== undefined && this.close();
    }

    public getContextMenu(entity: Entity): IMenuItem[] {
        return this.providers.getContextMenu(entity.origin);
    }

    public getNoContentActions(index: number): INoContentActions {
        return this.providers.getNoContentActions(index);
    }
}
