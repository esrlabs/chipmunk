import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { Events, Declarations } from '@service/ilc/events';
import { Channel } from '@service/ilc/events.channel';
import { Emitter } from '@service/ilc/events.emitter';
import { Services } from '@service/ilc/services';
import { Logger } from '@platform/log';
import { session, Session, UnboundTab } from '@service/session';
import { state } from '@service/state';
import { jobs } from '@service/jobs';
import { popup } from '@ui/service/popup';
import { notifications } from '@ui/service/notifications';
import { contextmenu } from '@ui/service/contextmenu';
import { layout } from '@ui/service/layout';
import { toolbar } from '@ui/service/toolbar';
import { sidebar } from '@ui/service/sidebar';
import { bridge } from '@service/bridge';
import { hotkeys } from '@service/hotkeys';
import { cli } from '@service/cli';
import { actions } from '@service/actions';
import { favorites } from '@service/favorites';
import { sys } from '@service/sys';

import { Subscriber } from '@platform/env/subscription';

export { Channel, Emitter, Declarations, Services };

export interface InternalAPI {
    channel: Channel;
    emitter: Emitter;
    services: Services;
    logger: Logger;
}

export interface Env {
    subscriber: Subscriber;
}

export interface Accessor {
    session: (cb: (session: Session) => void) => boolean;
    unbound: (cb: (session: UnboundTab) => void) => boolean;
}

export interface Life {
    destroy: (handler: () => void) => void;
}

export interface IlcInterface {
    log(): Logger;
    ilc(): InternalAPI;
    env(): Env;
    access(): Accessor;
    life(): Life;
}

// System services
@DependOn(session)
@DependOn(state)
@DependOn(jobs)
@DependOn(bridge)
@DependOn(hotkeys)
@DependOn(cli)
@DependOn(actions)
@DependOn(favorites)
@DependOn(sys)
// UI services
@DependOn(sidebar)
@DependOn(toolbar)
@DependOn(layout)
@DependOn(popup)
@DependOn(notifications)
@DependOn(contextmenu)
@SetupService(services['ilc'])
export class Service extends Implementation {
    private readonly _events: Events = new Events();

    public override destroy(): Promise<void> {
        this._events.destroy();
        return Promise.resolve();
    }

    public channel(owner: string, logger: Logger): Channel {
        return new Channel(owner, this._events, logger);
    }

    public emitter(owner: string, logger: Logger): Emitter {
        return new Emitter(owner, this._events, logger);
    }

    public services(owner: string, logger: Logger): Services {
        return new Services(owner, logger);
    }
}
export interface Service extends Interface {}
export const ilc = register(new Service());
