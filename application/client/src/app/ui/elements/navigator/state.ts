import { Entity } from './providers/entity';
import { Entries, ICollection } from './providers/entries';
import { Providers } from './providers/providers';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Holder } from '@module/matcher/holder';
import { unique } from '@platform/env/sequence';
import { INoContentActions, IStatistics } from './providers/provider';
import { IMenuItem } from '@ui/service/contextmenu';
import { Observe } from '@platform/types/observe';
import { stop } from '@ui/env/dom';

const MOVE_SELECTION_DELAY = 150;

export type CloseHandler = () => void;

export class State extends Holder {
    public readonly uuid: string = unique();
    public entries: Entries;
    public empty: boolean = true;
    public filtered: ICollection[] = [];

    public statistics: IStatistics[] = [];
    public loading: boolean = true;

    protected close: CloseHandler | undefined;
    protected readonly movement: {
        timer: number;
    } = {
        timer: -1,
    };
    protected readonly providers: Providers;

    protected move(event: KeyboardEvent): boolean {
        clearTimeout(this.movement.timer);
        if (event.key === 'ArrowDown') {
            this.entries.move().down();
        } else if (event.key === 'ArrowUp') {
            this.entries.move().up();
        } else {
            return false;
        }
        this.ilc.detectChanges();
        this.movement.timer = setTimeout(() => {
            this.move(event);
        }, MOVE_SELECTION_DELAY) as unknown as number;
        return true;
    }
    constructor(
        protected readonly ilc: IlcInterface & ChangesDetector,
        protected readonly filterRefGetter: () => HTMLInputElement | undefined,
        protected readonly observe: Observe | undefined,
    ) {
        super();
        this.ilc = ilc;
        this.entries = new Entries(this.uuid, ilc, this.matcher);
        this.providers = new Providers(ilc, this.matcher, this.entries, this.observe);
        ilc.env().subscriber.register(
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keydown',
                    window,
                    (event: KeyboardEvent) => {
                        if (this.move(event) || event.key !== 'Enter') {
                            return true;
                        }
                        const target = this.entries.getSelected();
                        if (target === undefined) {
                            return true;
                        }
                        stop(event);
                        this.action(target);
                        return true;
                    },
                ),
            ilc
                .ilc()
                .services.ui.listener.listen<KeyboardEvent>(
                    'keyup',
                    window,
                    (_event: KeyboardEvent) => {
                        clearTimeout(this.movement.timer);
                        return true;
                    },
                ),
            this.entries.updated.subscribe(() => {
                this.filtered = this.entries.filtered();
                this.ilc.detectChanges();
            }),
        );
    }

    public destroy() {
        this.providers.destroy();
    }

    public load(): void {
        this.loading = true;
        this.providers
            .load()
            .then(() => {
                this.entries.defaultSelection();
                this.loading = false;
                this.statistics = this.providers.stat();
                this.empty = this.entries.len() === 0;
                this.entries.filter.bind(this.filterRefGetter()).focus();
                this.ilc.markChangesForCheck();
            })
            .catch((err: Error) => {
                this.ilc.log().error(`Fail to load navigation entries with: ${err.message}`);
            });
    }

    public bind(close: CloseHandler) {
        this.close = close;
    }

    public count(): number {
        return this.entries.len();
    }

    public action(entity: Entity): void {
        this.providers.action(entity.origin);
        this.close !== undefined && this.close();
    }

    public getContextMenu(entity: Entity): IMenuItem[] {
        return this.providers.getContextMenu(entity.origin, this.close);
    }

    public getNoContentActions(index: number): INoContentActions {
        return this.providers.getNoContentActions(index);
    }
}
