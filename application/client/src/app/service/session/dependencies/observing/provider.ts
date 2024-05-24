import { IComponentDesc } from '@elements/containers/dynamic/component';
import { Logger } from '@platform/log';
import { Session } from '@service/session/session';
import { ObserveSource } from '@service/session/dependencies/observing/source';
import { unique } from '@platform/env/sequence';
import { Subject, Subjects } from '@platform/env/subscription';
import { IMenuItem } from '@ui/service/contextmenu';
import { Observe } from '@platform/types/observe';
import { session } from '@service/session';
import { components } from '@env/decorators/initial';
import { popup, Vertical, Horizontal } from '@ui/service/popup';

import * as $ from '@platform/types/observe';

export interface ProviderConstructor {
    new (session: Session, logger: Logger): Provider;
}

export abstract class Provider {
    static overwrite(src: ObserveSource[], dest: ObserveSource[]) {
        src.filter((src) => src.observer === undefined).forEach((src) => {
            const index = dest.findIndex((s) => s.observe.uuid === src.observe.uuid);
            if (index !== -1) {
                dest.splice(index, 1, src);
            }
        });
    }
    public readonly session: Session;
    public readonly logger: Logger;
    public readonly subjects: Subjects<{
        updated: Subject<void>;
    }> = new Subjects({
        updated: new Subject<void>(),
    });
    public panels!: {
        list: {
            name: string;
            desc: string;
            comp: IComponentDesc;
        };
        nocontent: {
            name: string | undefined;
            desc: string | undefined;
            comp: IComponentDesc | undefined;
        };
    };
    public readonly uuid: string = unique();

    constructor(session: Session, logger: Logger) {
        this.session = session;
        this.logger = logger;
    }

    public destroy() {
        this.subjects.destroy();
    }

    public last(): Observe | undefined {
        const sources = this.sources();
        if (sources.length === 0) {
            return undefined;
        }
        const observe = sources[sources.length - 1];
        return observe.observe;
    }

    public recent() {
        const observe = this.last();
        if (observe === undefined) {
            return;
        }
        popup.open({
            component: {
                factory: components.get('app-navigator'),
                inputs: {
                    observe,
                },
            },
            position: {
                vertical: Vertical.top,
                horizontal: Horizontal.center,
            },
            closeOnKey: 'Escape',
            width: 450,
            uuid: 'app-recent-actions-popup-observed',
        });
    }

    public clone(observe: Observe): Promise<string> {
        if (!(observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            return Promise.reject(new Error(`Only Origin.Stream can be repeated`));
        }
        const last = this.last();
        if (last !== undefined) {
            observe.parser.change(last.parser.instance);
        }
        return this.session.stream.observe().start(observe.clone());
    }

    public openAsNewOrigin(observe: Observe): Promise<string> {
        const last = this.last();
        if (last !== undefined) {
            observe.parser.change(last.parser.instance);
        } else {
            return Promise.reject(new Error(`No data about current parser`));
        }
        return this.session.stream.observe().start(observe.clone());
    }

    public openAsNew(source: ObserveSource | Observe): Promise<string | undefined> {
        return session
            .initialize()
            .configure(source instanceof ObserveSource ? source.observe : source);
    }

    public setPanels(): Provider {
        this.panels = {
            list: {
                name: this.getPanels().list().name(),
                desc: this.getPanels().list().desc(),
                comp: this.getPanels().list().comp(),
            },
            nocontent: {
                name: this.getPanels().nocontent().name(),
                desc: this.getPanels().nocontent().desc(),
                comp: this.getPanels().nocontent().comp(),
            },
        };
        return this;
    }

    public isEmpty(): boolean {
        return this.sources().length === 0;
    }

    public abstract contextMenu(source: ObserveSource): IMenuItem[];

    public abstract update(sources: ObserveSource[]): Provider;

    public abstract sources(): ObserveSource[];

    public abstract getPanels(): {
        list(): {
            name(): string;
            desc(): string;
            comp(): IComponentDesc;
        };
        nocontent(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
    };

    public getNewSourceError(): Error | undefined {
        return undefined;
    }

    public count(): number {
        return this.sources().length;
    }
}
